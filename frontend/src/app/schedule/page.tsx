'use client'
import { useEffect, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Plus, X, Clock, MapPin, User } from 'lucide-react'

import toast from 'react-hot-toast'
import { useApi } from '@/hooks/useApi'
import { useSocket } from '@/hooks/useSocket'
import { cn, fmtTime, fmtDateTime, STATUS_COLORS } from '@/lib/utils'

interface Shift {
  id: string; title: string; start_time: string; end_time: string
  status: string; color: string; assignee_name?: string; assignee_id?: string
  location?: string; notes?: string
}

interface Member { id: string; name: string; role: string }

const COLORS = ['#4f6eff','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#be185d']

const COLUMNS = [
  { id: 'OPEN', label: 'Open Shifts', color: 'bg-amber-500' },
  { id: 'ASSIGNED', label: 'Assigned', color: 'bg-brand-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-emerald-500' },
  { id: 'COMPLETED', label: 'Completed', color: 'bg-surface-400' },
]

export default function SchedulePage() {
  const { isLoaded, isSignedIn } = useUser()
  const api = useApi()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [member, setMember] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Shift | null>(null)
  const [form, setForm] = useState({ title:'', startTime:'', endTime:'', location:'', notes:'', color:'#4f6eff', assigneeId:'' })
  const [activeTab, setActiveTab] = useState('OPEN')
  const [loading, setLoading] = useState(false)
  const socket = useSocket(member?.organisation_id, member?.id)

  const loadShifts = useCallback(async (start?: Date, end?: Date) => {
    try {
      const s = start || new Date(Date.now() - 7*24*60*60*1000)
      const e = end || new Date(Date.now() + 30*24*60*60*1000)
      const r = await api.get('/api/shifts', { params: { start: s.toISOString(), end: e.toISOString() } })
      setShifts(r.data)
    } catch (err) { console.error(err) }
  }, [api])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const init = async () => {
      try {
        const [me, mem] = await Promise.all([
          api.get('/api/members/me'),
          api.get('/api/members')
        ])
        setMember(me.data);
        setMembers(mem.data);
        
        // Load initial shifts with optimized range
        await loadShifts();
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

  const handleEventClick = (s: Shift) => {
    const fmt = (d: string) => {
      const date = new Date(d)
      return new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,16)
    }
    setForm({
      title: s.title,
      startTime: fmt(s.start_time),
      endTime: fmt(s.end_time),
      location: s.location || '',
      notes: s.notes || '',
      color: s.color,
      assigneeId: s.assignee_id || ''
    })
    setSelected(s)
    setShowModal(true)
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        assigneeId: form.assigneeId === '' ? null : form.assigneeId
      }

      if (selected) {
        await api.put(`/api/shifts/${selected.id}`, payload)
        toast.success('Shift updated')
      } else {
        await api.post('/api/shifts', payload)
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
    <div className="p-5 md:p-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Header - Compact & Responsive */}
      <div className="mb-10 border-b border-zinc-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">Roster</h1>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">Live coordination center</p>
        </div>
        {(member?.role === 'ADMIN' || member?.role === 'MANAGER') && (
          <button 
            className="px-6 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 flex items-center gap-2" 
            onClick={() => { setSelected(null); setForm({title:'',startTime:'',endTime:'',location:'',notes:'',color:'#4f6eff',assigneeId:''}); setShowModal(true) }}
          >
            <Plus size={14} /> New Shift
          </button>
        )}
      </div>

      {/* Mobile Column Tabs */}
      <div className="md:hidden flex p-1 bg-zinc-100 mb-6">
        {COLUMNS.map(col => (
          <button
            key={col.id}
            onClick={() => setActiveTab(col.id)}
            className={cn(
              "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-200",
              activeTab === col.id ? "bg-white text-black" : "text-zinc-400"
            )}
          >
            {col.id === 'IN_PROGRESS' ? 'Active' : col.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6 overflow-x-auto pb-6">
        {COLUMNS.map(col => (
          <div key={col.id} className={cn(
            "w-full md:w-80 flex-shrink-0 flex flex-col bg-white border border-zinc-200 shadow-sm",
            activeTab !== col.id ? "hidden md:flex" : "flex"
          )}>
            <div className="p-5 flex items-center justify-between border-b border-zinc-100">
              <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em] border-l-2 border-black pl-3">{col.label}</h2>
              <span className="text-[10px] text-zinc-400 font-bold bg-zinc-50 px-2 py-0.5 border border-zinc-200">
                {shifts.filter(s => s.status === col.id).length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px]">
              {shifts.filter(s => s.status === col.id).map(s => (
                <button key={s.id} onClick={() => handleEventClick(s)}
                  className="w-full text-left bg-zinc-50 p-5 border border-zinc-100 hover:border-zinc-300 transition-all duration-300 group">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <h3 className="font-bold text-black text-[11px] uppercase tracking-widest leading-snug truncate">{s.title}</h3>
                    <div className="w-2.5 h-2.5 flex-shrink-0 border border-zinc-200" style={{background: s.color}} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 text-zinc-400">
                      <Clock size={15} className="opacity-50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                    </div>
                    {s.location && (
                      <div className="flex items-center gap-2.5 text-zinc-400">
                        <MapPin size={15} className="opacity-50" />
                        <span className="text-[10px] font-bold uppercase truncate">{s.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 pt-3 border-t border-zinc-200">
                      <div className="w-6 h-6 bg-zinc-200 flex items-center justify-center flex-shrink-0">
                        <User size={12} className="text-zinc-500" />
                      </div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{s.assignee_name || 'Unassigned'}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white border border-zinc-200 w-full max-w-md animate-slide-up relative shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">{selected ? 'Shift Details' : 'New Shift'}</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-black transition-colors"><X size={18} /></button>
            </div>

            {selected && member?.role === 'EMPLOYEE' ? (
              <div className="p-5 space-y-3 overflow-y-auto">
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
              <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Subject *</label>
                  <input className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors" placeholder="e.g. Morning Logistics" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Start *</label>
                    <input type="datetime-local" className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">End *</label>
                    <input type="datetime-local" className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} required />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Assign Recipient</label>
                  <select className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors appearance-none" value={form.assigneeId} onChange={e => setForm(f => ({...f, assigneeId: e.target.value}))}>
                    <option value="">Unassigned (Open)</option>
                    {members
                      .filter(m => member?.role === 'ADMIN' || m.role === 'EMPLOYEE')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Location</label>
                  <input className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors" placeholder="e.g. Warehouse A" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Instructions</label>
                  <textarea className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors min-h-[80px]" placeholder="Add details..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Color Tag</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button type="button" key={c} onClick={() => setForm(f => ({...f, color: c}))}
                        className={cn('w-7 h-7 border border-zinc-200 transition-transform', form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-black' : 'hover:scale-110')}
                        style={{background: c}} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  {selected && (
                    <button type="button" onClick={handleDelete} className="px-4 py-3 border border-zinc-200 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors">Delete</button>
                  )}
                  <button type="submit" className="flex-1 py-4 bg-black text-white font-black uppercase tracking-[0.3em] text-[10px] hover:bg-zinc-800 transition-colors" disabled={loading}>
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
