'use client'
import { useEffect, useState, useRef } from 'react'
import { useApi } from '@/hooks/useApi'
import { useSocket } from '@/hooks/useSocket'
import { getInitials, fmtTime } from '@/lib/utils'
import { Send } from 'lucide-react'

export default function MessagesPage() {
  const api = useApi()
  const [members, setMembers] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const socket = useSocket(me?.organisation_id, me?.id)

  useEffect(() => {
    const load = async () => {
      const [meR, memR] = await Promise.all([api.get('/api/members/me'), api.get('/api/members')])
      setMe(meR.data)
      setMembers(memR.data.filter((m: any) => m.id !== meR.data.id))
    }
    load()
  }, [])

  useEffect(() => {
    if (!active) return
    api.get('/api/messages', { params: { withMemberId: active.id } }).then(r => setMessages(r.data))
  }, [active])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!socket) return
    socket.on('message:new', (msg: any) => {
      if (msg.sender_id === active?.id || msg.receiver_id === active?.id) {
        setMessages(p => [...p, msg])
      }
    })
    return () => { socket.off('message:new') }
  }, [socket, active])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !active) return
    await api.post('/api/messages', { receiverId: active.id, content: text })
    setText('')
    const r = await api.get('/api/messages', { params: { withMemberId: active.id } })
    setMessages(r.data)
  }

  return (
    <div className="flex h-screen">
      {/* Members list */}
      <div className="w-64 border-r border-surface-200 bg-white flex flex-col">
        <div className="p-4 border-b border-surface-100">
          <h2 className="font-semibold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {members.map(m => (
            <button key={m.id} onClick={() => setActive(m)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all mb-0.5 ${active?.id === m.id ? 'bg-brand-50' : 'hover:bg-surface-100'}`}>
              <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-xs flex-shrink-0">
                {getInitials(m.name)}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${active?.id === m.id ? 'text-brand-700' : 'text-ink'}`}>{m.name}</p>
                <p className="text-xs text-ink-tertiary truncate">{m.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {active ? (
          <>
            <div className="p-4 border-b border-surface-200 bg-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-xs">
                {getInitials(active.name)}
              </div>
              <div>
                <p className="font-semibold text-ink text-sm">{active.name}</p>
                <p className="text-xs text-ink-tertiary">{active.role}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_id === me?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${msg.sender_id === me?.id ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-white border border-surface-200 text-ink rounded-bl-sm'}`}>
                    <p>{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.sender_id === me?.id ? 'text-brand-200' : 'text-ink-disabled'}`}>{fmtTime(msg.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="p-4 border-t border-surface-200 bg-white flex gap-3">
              <input className="input flex-1" placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)} />
              <button type="submit" className="btn-primary px-4" disabled={!text.trim()}>
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-tertiary">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                <Send size={20} className="text-ink-disabled" />
              </div>
              <p className="text-sm">Select a team member to message</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
