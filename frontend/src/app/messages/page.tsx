'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useApi } from '@/hooks/useApi'
import { SOCKET_RESYNC_EVENT, useSocket } from '@/hooks/useSocket'
import { getInitials, fmtTime, cn } from '@/lib/utils'
import { Send, ArrowLeft } from 'lucide-react'

export default function MessagesPage() {
  const api = useApi()
  const [members, setMembers] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const socket = useSocket(me?.organisation_id, me?.id)

  const loadConversation = useCallback(async (targetMemberId: string) => {
    const response = await api.get('/api/messages', { params: { withMemberId: targetMemberId } })
    setMessages(response.data)
  }, [api])

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
    loadConversation(active.id)
  }, [active, loadConversation])

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

  useEffect(() => {
    if (!me?.organisation_id || !active?.id) return

    const handleResync = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.orgId !== me.organisation_id || detail?.memberId !== me.id) return
      loadConversation(active.id).catch(() => {})
    }

    window.addEventListener(SOCKET_RESYNC_EVENT, handleResync)
    return () => window.removeEventListener(SOCKET_RESYNC_EVENT, handleResync)
  }, [me, active, loadConversation])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !active) return
    await api.post('/api/messages', { receiverId: active.id, content: text })
    setText('')
    await loadConversation(active.id)
  }

  return (
    <div className="flex h-[calc(100vh-56px)] md:h-screen">
      {/* Members list */}
      <div className={cn("w-full md:w-64 border-r border-zinc-200 bg-white flex flex-col", active ? "hidden md:flex" : "flex")}>
        <div className="p-5 border-b border-zinc-100">
          <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em] border-l-2 border-black pl-3">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {members.map(m => (
            <button key={m.id} onClick={() => setActive(m)}
              className={`w-full flex items-center gap-3 p-3 rounded-none text-left transition-all mb-1 ${active?.id === m.id ? 'bg-black text-white' : 'hover:bg-zinc-50'}`}>
              <div className={cn("w-9 h-9 flex items-center justify-center font-bold text-[10px] flex-shrink-0 uppercase tracking-tighter", active?.id === m.id ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-500")}>
                {getInitials(m.name)}
              </div>
              <div className="min-w-0">
                <p className={cn("text-[11px] font-bold uppercase tracking-widest truncate", active?.id === m.id ? "text-white" : "text-black")}>{m.name}</p>
                <p className={cn("text-[9px] font-bold uppercase tracking-wider truncate", active?.id === m.id ? "text-zinc-500" : "text-zinc-400")}>{m.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={cn("flex-1 flex flex-col bg-zinc-50", !active ? "hidden md:flex" : "flex")}>
        {active ? (
          <>
            <div className="p-4 border-b border-zinc-200 bg-white flex items-center gap-3">
              <button onClick={() => setActive(null)} className="md:hidden p-2 -ml-2 text-zinc-400">
                <ArrowLeft size={20} />
              </button>
              <div className="w-9 h-9 bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-[10px] uppercase tracking-tighter">
                {getInitials(active.name)}
              </div>
              <div>
                <p className="font-bold text-black text-[11px] uppercase tracking-widest">{active.name}</p>
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{active.role}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_id === me?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2.5 rounded-none text-[11px] font-medium ${msg.sender_id === me?.id ? 'bg-black text-white' : 'bg-white border border-zinc-200 text-black'}`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={cn("text-[9px] font-bold uppercase tracking-widest mt-2", msg.sender_id === me?.id ? "text-zinc-500" : "text-zinc-400")}>{fmtTime(msg.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="p-4 border-t border-zinc-200 bg-white flex gap-3">
              <input className="flex-1 bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors" placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)} />
              <button type="submit" className="px-6 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50" disabled={!text.trim()}>
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center mx-auto mb-4 border border-zinc-200">
                <Send size={20} className="text-zinc-300" />
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Select a team member to message</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
