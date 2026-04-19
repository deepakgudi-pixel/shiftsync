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
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto h-[calc(100vh-56px)] md:h-auto flex flex-col overflow-hidden">
      {/* Header - Compact & Responsive */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-shrink-0">
        <div className="animate-in fade-in slide-in-from-left duration-500 min-w-0">
          <h1 className="text-3xl font-black text-ink tracking-tight truncate" style={{fontFamily:'var(--font-bricolage)'}}>Roster</h1>
          <p className="text-[11px] font-bold text-ink-tertiary uppercase tracking-widest opacity-60 mt-1">Live coordination center</p>
        </div>
        {(member?.role === 'ADMIN' || member?.role === 'MANAGER') && (
          <button 
            className="btn-primary flex items-center justify-center gap-2 py-3 px-5 text-sm font-black tracking-tight rounded-2xl shadow-[0_8px_20px_-6px_rgba(79,110,255,0.4)] hover:shadow-[0_12px_25px_-6px_rgba(79,110,255,0.5)] active:scale-95 transition-all flex-shrink-0" 
            onClick={() => { setSelected(null); setForm({title:'',startTime:'',endTime:'',location:'',notes:'',color:'#4f6eff',assigneeId:''}); setShowModal(true) }}
          >
            <Plus size={16} /> <span className="hidden sm:inline">New Shift</span><span className="sm:hidden">New</span>
          </button>
        )}
      </div>

      {/* Mobile Column Tabs */}
      <div className="md:hidden flex p-1 bg-surface-100 rounded-xl mb-4 flex-shrink-0">
        {COLUMNS.map(col => (
          <button
            key={col.id}
            onClick={() => setActiveTab(col.id)}
            className={cn(
              "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200",
              activeTab === col.id ? "bg-white shadow-sm text-ink" : "text-ink-tertiary"
            )}
          >
            {col.id === 'IN_PROGRESS' ? 'Active' : col.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="flex-1 flex gap-4 md:gap-6 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar scroll-smooth min-h-0">
        {COLUMNS.map(col => (
          <div key={col.id} className={cn(
            "w-full md:w-80 flex-shrink-0 flex flex-col bg-surface-100/40 rounded-[2.5rem] border border-surface-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]",
            activeTab !== col.id ? "hidden md:flex" : "flex"
          )}>
            <div className="p-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full ring-4 ring-offset-2', col.color.replace('bg-', 'ring-'), 'ring-opacity-20')} />
                <h2 className="font-black text-ink text-[12px] uppercase tracking-widest opacity-80">{col.label}</h2>
                <span className="text-[10px] text-ink-tertiary font-black bg-white px-2.5 py-1 rounded-full border border-surface-200/60 shadow-sm">
                  {shifts.filter(s => s.status === col.id).length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scroll-smooth">
              {shifts.filter(s => s.status === col.id).map(s => (
                <button key={s.id} onClick={() => handleEventClick(s)}
                  className="w-full text-left bg-white p-5 rounded-3xl border border-surface-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:border-brand-300 hover:-translate-y-1 active:scale-[0.98] transition-all duration-500 group">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <h3 className="font-black text-ink text-[0.95rem] leading-snug group-hover:text-brand-600 transition-colors">{s.title}</h3>
                    <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{background: s.color}} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 text-ink-tertiary">
                      <Clock size={15} className="opacity-50" />
                      <span className="text-[11px] font-black uppercase tracking-widest">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                    </div>
                    {s.location && (
                      <div className="flex items-center gap-2.5 text-ink-tertiary">
                        <MapPin size={15} className="opacity-50" />
                        <span className="text-xs font-semibold truncate">{s.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 pt-3 border-t border-surface-100">
                      <div className="w-6 h-6 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0">
                        <User size={12} className="text-ink-tertiary" />
                      </div>
                      <span className="text-[11px] font-black text-ink-secondary uppercase tracking-widest">{s.assignee_name || 'Open Slot'}</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-ink text-base md:text-lg" style={{fontFamily:'var(--font-bricolage)'}}>
                {selected ? 'Shift Details' : 'Create Shift'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={18} /></button>
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
                  <label className="text-sm font-medium text-ink-secondary block mb-1.5">Title *</label>
              <input className="input" placeholder="Morning Shift" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
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
                    {members
                      .filter(m => member?.role === 'ADMIN' || m.role === 'EMPLOYEE')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-secondary block mb-1.5">Location</label>
                  <input className="input" placeholder="Warehouse A, Floor 2..." value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
                </div>
                <div>
              <label className="text-sm font-medium text-ink-secondary block mb-1.5">Notes</label>
              <textarea className="input min-h-[80px] py-2" placeholder="Additional details..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
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
