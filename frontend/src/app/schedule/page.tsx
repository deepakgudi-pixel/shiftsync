'use client'
import { useEffect, useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { useUser } from '@clerk/nextjs'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'


import { Plus, X, ChevronDown } from 'lucide-react'

import toast from 'react-hot-toast'
import { useApi } from '@/hooks/useApi'
import { useSocket } from '@/hooks/useSocket'
import { cn, fmtTime, fmtDateTime, STATUS_COLORS } from '@/lib/utils'

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'en-US': enUS } })

interface Shift {
  id: string; title: string; start_time: string; end_time: string
  status: string; color: string; assignee_name?: string; assignee_id?: string
  location?: string; notes?: string
}

interface Member { id: string; name: string; role: string }

const COLORS = ['#4f6eff','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#be185d']

export default function SchedulePage() {
  const { isLoaded, isSignedIn } = useUser()
  const api = useApi()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [member, setMember] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Shift | null>(null)
  const [form, setForm] = useState({ title:'', startTime:'', endTime:'', location:'', notes:'', color:'#4f6eff', assigneeId:'' })
  const [loading, setLoading] = useState(false)
  const socket = useSocket(member?.organisation_id, member?.id)

  const loadShifts = useCallback(async (start?: Date, end?: Date) => {
    try {
      const s = start || new Date(Date.now() - 30*24*60*60*1000)
      const e = end || new Date(Date.now() + 60*24*60*60*1000)
      const r = await api.get('/api/shifts', { params: { start: s.toISOString(), end: e.toISOString() } })
      setShifts(r.data)
    } catch (err) { console.error(err) }
  }, [api])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const init = async () => {
      try {
        const [me, mem] = await Promise.all([api.get('/api/members/me'), api.get('/api/members')])
        setMember(me.data)
        setMembers(mem.data)
        await loadShifts()
      } catch (err) {
        console.error('Error initializing schedule:', err)
      }
    }
    init()
  }, [isLoaded, isSignedIn, api, loadShifts])

  useEffect(() => {
    if (!socket) return
    socket.on('shift:created', (s: Shift) => setShifts(p => [...p, s]))
    socket.on('shift:updated', (s: Shift) => setShifts(p => p.map(x => x.id === s.id ? s : x)))
    socket.on('shift:deleted', ({ id }: {id:string}) => setShifts(p => p.filter(x => x.id !== id)))
    return () => { socket.off('shift:created'); socket.off('shift:updated'); socket.off('shift:deleted') }
  }, [socket])

  const events = shifts.map(s => ({
    id: s.id, title: s.assignee_name ? `${s.title} — ${s.assignee_name}` : s.title,
    start: new Date(s.start_time), end: new Date(s.end_time),
    resource: s,
  }))

  const handleSlotSelect = ({ start, end }: any) => {
    if (member?.role === 'EMPLOYEE') return
    const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16)
    setForm(f => ({ ...f, startTime: fmt(start), endTime: fmt(end) }))
    setSelected(null)
    setShowModal(true)
  }

  const handleEventClick = (e: any) => {
    setSelected(e.resource)
    setShowModal(true)
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setLoading(true)
    try {
      if (selected) {
        await api.put(`/api/shifts/${selected.id}`, { ...form, startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() })
        toast.success('Shift updated')
      } else {
        await api.post('/api/shifts', { ...form, startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() })
        toast.success('Shift created')
      }
      setShowModal(false)
      await loadShifts()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed')
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    try {
      await api.delete(`/api/shifts/${selected.id}`)
      toast.success('Shift deleted')
      setShowModal(false)
      await loadShifts()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Schedule</h1>
          <p className="text-sm text-ink-tertiary mt-0.5">Manage and view all shifts</p>
        </div>
        {member?.role !== 'EMPLOYEE' && (
          <button className="btn-primary flex items-center gap-2" onClick={() => { setSelected(null); setForm({title:'',startTime:'',endTime:'',location:'',notes:'',color:'#4f6eff',assigneeId:''}); setShowModal(true) }}>
            <Plus size={16} /> New Shift
          </button>
        )}
      </div>

      <div style={{ height: 'calc(100vh - 180px)' }}>
        <Calendar
          localizer={localizer} events={events}
          defaultView="week" selectable={member?.role !== 'EMPLOYEE'}
          onSelectSlot={handleSlotSelect} onSelectEvent={handleEventClick}
          eventPropGetter={(e) => ({ style: { backgroundColor: e.resource?.color || '#4f6eff', color: 'white' } })}
          onRangeChange={(range: any) => {
            if (Array.isArray(range)) loadShifts(range[0], range[range.length-1])
            else loadShifts(range.start, range.end)
          }}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>
                {selected ? 'Shift Details' : 'Create Shift'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>

            {selected && member?.role === 'EMPLOYEE' ? (
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{background: selected.color}} />
                  <h3 className="font-semibold text-ink">{selected.title}</h3>
                  <span className={cn('badge ml-auto', STATUS_COLORS[selected.status])}>{selected.status}</span>
                </div>
                {[
                  ['Start', fmtDateTime(selected.start_time)],
                  ['End', fmtTime(selected.end_time)],
                  selected.location && ['Location', selected.location],
                  selected.notes && ['Notes', selected.notes],
                ].filter(Boolean).map(([k, v]: any) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-ink-tertiary">{k}</span>
                    <span className="text-ink font-medium">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-ink-secondary block mb-1.5">Title *</label>
                  <input className="input" placeholder="Morning Shift" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required defaultValue={selected?.title} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-ink-secondary block mb-1.5">Start *</label>
                    <input type="datetime-local" className="input" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-ink-secondary block mb-1.5">End *</label>
                    <input type="datetime-local" className="input" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} required />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-secondary block mb-1.5">Assign To</label>
                  <select className="input" value={form.assigneeId} onChange={e => setForm(f => ({...f, assigneeId: e.target.value}))}>
                    <option value="">Unassigned (Open)</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-secondary block mb-1.5">Location</label>
                  <input className="input" placeholder="Warehouse A, Floor 2..." value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-secondary block mb-2">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button type="button" key={c} onClick={() => setForm(f => ({...f, color: c}))}
                        className={cn('w-7 h-7 rounded-full transition-transform', form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-brand-400' : 'hover:scale-110')}
                        style={{background: c}} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {selected && (
                    <button type="button" onClick={handleDelete} className="btn-secondary text-red-500 hover:bg-red-50">Delete</button>
                  )}
                  <button type="submit" className="btn-primary flex-1" disabled={loading}>
                    {loading ? 'Saving...' : selected ? 'Update Shift' : 'Create Shift'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
