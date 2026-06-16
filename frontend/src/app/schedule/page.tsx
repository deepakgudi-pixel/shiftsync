'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Activity, AlertCircle, CalendarDays, Clock, Filter, MapPin, Plus, Search, Timer, User, X } from 'lucide-react'

import toast from 'react-hot-toast'
import { useApi } from '@/hooks/useApi'
import { SOCKET_RESYNC_EVENT, useSocket } from '@/hooks/useSocket'
import { cn, fmtTime, fmtDateTime, STATUS_COLORS } from '@/lib/utils'
import type { ApiError, Shift, Member } from '@/types'
import { useAppLayout } from '@/components/layout/AppLayout'

const COLORS = ['#4f6eff','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#be185d']

const COLUMNS: { id: Shift['status']; label: string; shortLabel: string; tone: string; dot: string }[] = [
  { id: 'OPEN', label: 'Open Shifts', shortLabel: 'Open', tone: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  { id: 'ASSIGNED', label: 'Assigned', shortLabel: 'Assigned', tone: 'border-blue-200 bg-blue-50 text-blue-800', dot: 'bg-blue-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', shortLabel: 'Live', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  { id: 'COMPLETED', label: 'Completed', shortLabel: 'Done', tone: 'border-zinc-200 bg-zinc-100 text-zinc-700', dot: 'bg-zinc-500' },
]

const getShiftHours = (shift: Shift) => {
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60))
}

const getDateLabel = (value: string) => {
  return new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function SchedulePage() {
  const { isLoaded, isSignedIn } = useUser()
  const api = useApi()
  const { setPageLoading: setGlobalPageLoading } = useAppLayout()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [member, setMember] = useState<Member | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Shift | null>(null)
  const [form, setForm] = useState({ title:'', startTime:'', endTime:'', location:'', notes:'', color:'#4f6eff', assigneeId:'' })
  const [activeTab, setActiveTab] = useState('OPEN')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('ALL')
  const socket = useSocket(member?.organisation_id, member?.id)

  const canManageShifts = member?.role === 'ADMIN' || member?.role === 'MANAGER'

  const filteredShifts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return shifts
      .filter((shift) => {
        if (assigneeFilter === 'OPEN') return !shift.assignee_id
        if (assigneeFilter !== 'ALL' && shift.assignee_id !== assigneeFilter) return false
        if (!normalizedSearch) return true

        return [
          shift.title,
          shift.location,
          shift.notes,
          shift.assignee_name,
          shift.status,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch))
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [assigneeFilter, search, shifts])

  const shiftsByStatus = useMemo(() => {
    return COLUMNS.reduce<Record<Shift['status'], Shift[]>>((acc, column) => {
      const columnShifts = filteredShifts.filter((shift) => shift.status === column.id)
      acc[column.id] = column.id === 'COMPLETED'
        ? [...columnShifts].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        : columnShifts
      return acc
    }, {
      OPEN: [],
      ASSIGNED: [],
      IN_PROGRESS: [],
      COMPLETED: [],
    })
  }, [filteredShifts])

  const totalScheduledHours = useMemo(() => {
    return filteredShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0)
  }, [filteredShifts])

  const nextShift = useMemo(() => {
    const now = Date.now()
    return shifts
      .filter((shift) => new Date(shift.start_time).getTime() >= now && shift.status !== 'COMPLETED')
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
  }, [shifts])

  useEffect(() => {
    setGlobalPageLoading(pageLoading)
    return () => setGlobalPageLoading(false)
  }, [pageLoading, setGlobalPageLoading])

  const resetForm = () => {
    setSelected(null)
    setForm({ title:'', startTime:'', endTime:'', location:'', notes:'', color:'#4f6eff', assigneeId:'' })
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const loadShifts = useCallback(async (start?: Date, end?: Date) => {
    try {
      const s = start || new Date(Date.now() - 7*24*60*60*1000)
      const e = end || new Date(Date.now() + 30*24*60*60*1000)
      const r = await api.get('/api/shifts', { params: { start: s.toISOString(), end: e.toISOString() } })
      setShifts(r.data)
    } catch {
      toast.error('Failed to load shifts')
    }
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
      } catch {
        toast.error('Failed to load the roster')
      } finally {
        setPageLoading(false)
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

  useEffect(() => {
    if (!member?.organisation_id) return

    const handleResync = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.orgId !== member.organisation_id || detail?.memberId !== member.id) return
      loadShifts().catch(() => {})
    }

    window.addEventListener(SOCKET_RESYNC_EVENT, handleResync)
    return () => window.removeEventListener(SOCKET_RESYNC_EVENT, handleResync)
  }, [member, loadShifts])

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
    const start = new Date(form.startTime)
    const end = new Date(form.endTime)

    if (!form.title.trim()) {
      toast.error('Shift title is required')
      return
    }
    if (!form.startTime || !form.endTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error('Enter a valid start and end time')
      return
    }
    if (end <= start) {
      toast.error('Shift end time must be after the start time')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        assigneeId: form.assigneeId === '' ? null : form.assigneeId
      }

      if (selected) {
        await api.put(`/api/shifts/${selected.id}`, payload, {
          headers: { 'If-Match': String(selected.version) },
        })
        toast.success('Shift updated')
      } else {
        await api.post('/api/shifts', payload)
        toast.success('Shift created')
      }
      closeModal()
      await loadShifts()
    } catch (err) {
      const error = err as ApiError
      if (error.response?.data?.error === 'SHIFT_VERSION_CONFLICT') {
        toast.error(error.response.data.message || 'This shift changed. Refreshing roster...')
        await loadShifts()
        closeModal()
        return
      }
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (error.response?.data?.lockedFields?.length
          ? `Locked after clock-in: ${error.response.data.lockedFields.join(', ')}`
          : null) ||
        'Failed to save shift'
      toast.error(message)
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    try {
      await api.delete(`/api/shifts/${selected.id}`)
      toast.success('Shift deleted')
      closeModal()
      await loadShifts()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="min-h-screen p-5 md:p-8">
      <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-6 md:p-8">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                <CalendarDays size={13} />
                Live roster
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {shiftsByStatus.IN_PROGRESS.length} active now
              </span>
            </div>
            <h1 className="text-3xl font-bold text-black md:text-4xl">Schedule</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Coordinate open coverage, assigned shifts, live operations, and completed work from one roster board.
            </p>
          </div>

          <div className="border-t border-zinc-200 bg-zinc-950 p-6 text-white lg:border-l lg:border-t-0 md:p-8">
            <p className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              <Timer size={14} />
              Next Shift
            </p>
            {nextShift ? (
              <div>
                <p className="text-lg font-bold">{nextShift.title}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {getDateLabel(nextShift.start_time)} at {fmtTime(nextShift.start_time)}
                  {nextShift.location ? ` · ${nextShift.location}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No upcoming shift in the current roster window.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700">
            <CalendarDays size={17} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Roster Window</p>
          <p className="mt-2 text-3xl font-bold text-black">{filteredShifts.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-amber-100 bg-amber-50 text-amber-700">
            <AlertCircle size={17} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Needs Coverage</p>
          <p className="mt-2 text-3xl font-bold text-black">{shiftsByStatus.OPEN.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700">
            <Activity size={17} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Live Now</p>
          <p className="mt-2 text-3xl font-bold text-black">{shiftsByStatus.IN_PROGRESS.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-900">
            <Clock size={17} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Scheduled Hours</p>
          <p className="mt-2 text-3xl font-bold text-black">{Math.round(totalScheduledHours)}</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              className="h-11 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black focus:bg-white"
              placeholder="Search shifts, locations, notes, assignees..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <select
                className="h-11 min-w-[210px] appearance-none rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-8 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600 outline-none transition-colors focus:border-black focus:bg-white"
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="ALL">All assignees</option>
                <option value="OPEN">Open only</option>
                {members.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
            {canManageShifts && (
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-black px-5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-zinc-800 active:scale-95"
                onClick={() => { resetForm(); setShowModal(true) }}
              >
                <Plus size={14} /> New Shift
              </button>
            )}
          </div>
        </div>
      </div>

      {pageLoading && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400 shadow-card">
          Loading roster...
        </div>
      )}

      {!pageLoading && (
      <>
      <div className="mb-6 grid grid-cols-4 gap-2 rounded-lg border border-zinc-200 bg-white p-1 shadow-card md:hidden">
        {COLUMNS.map(col => (
          <button
            key={col.id}
            onClick={() => setActiveTab(col.id)}
            className={cn(
              'rounded-md px-2 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-200',
              activeTab === col.id ? 'bg-black text-white' : 'text-zinc-400'
            )}
          >
            {col.shortLabel}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 overflow-x-auto pb-6 md:flex-row">
        {COLUMNS.map(col => (
          <section key={col.id} className={cn(
            'flex w-full flex-shrink-0 flex-col rounded-lg border border-zinc-200 bg-white shadow-card md:h-[calc(100vh-360px)] md:min-h-[560px] md:w-80 xl:w-[360px]',
            activeTab !== col.id ? 'hidden md:flex' : 'flex'
          )}>
            <div className="border-b border-zinc-100 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={cn('h-2.5 w-2.5 rounded-full', col.dot)} />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">{col.label}</h2>
                </div>
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-bold', col.tone)}>
                  {shiftsByStatus[col.id].length}
                </span>
              </div>
            </div>
            
            <div className="min-h-[420px] flex-1 space-y-3 overflow-y-auto p-4 md:min-h-0">
              {shiftsByStatus[col.id].length === 0 && (
                <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {search || assigneeFilter !== 'ALL'
                      ? 'No matching shifts'
                      : col.id === 'OPEN'
                        ? 'No open shifts'
                        : `No ${col.label.toLowerCase()}`}
                  </p>
                </div>
              )}
              {shiftsByStatus[col.id].map(s => (
                <button key={s.id} type="button" onClick={() => handleEventClick(s)}
                  className="group w-full rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-card">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">{getDateLabel(s.start_time)}</p>
                      <h3 className="truncate text-sm font-bold text-black">{s.title}</h3>
                    </div>
                    <div className="h-8 w-1.5 flex-shrink-0 rounded-full" style={{background: s.color}} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 text-zinc-500">
                      <Clock size={14} className="text-zinc-400" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{fmtTime(s.start_time)} - {fmtTime(s.end_time)}</span>
                    </div>
                    {s.location && (
                      <div className="flex items-center gap-2.5 text-zinc-500">
                        <MapPin size={14} className="text-zinc-400" />
                        <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em]">{s.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 border-t border-zinc-200 pt-3">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200">
                        <User size={12} className="text-zinc-500" />
                      </div>
                      <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{s.assignee_name || 'Unassigned'}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="relative flex max-h-[92vh] w-full max-w-xl animate-slide-up flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 p-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">{selected ? selected.status.replace('_', ' ') : 'Create roster item'}</p>
                <h2 className="mt-1 text-base font-bold text-black">{selected ? 'Shift Details' : 'New Shift'}</h2>
              </div>
              <button onClick={closeModal} className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-black" aria-label="Close shift modal"><X size={18} /></button>
            </div>

            {selected && member?.role === 'EMPLOYEE' ? (
              <div className="space-y-4 overflow-y-auto p-5">
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="h-9 w-1.5 rounded-full" style={{background: selected.color}} />
                  <h3 className="font-semibold text-ink">{selected.title}</h3>
                  <span className={cn('badge ml-auto', STATUS_COLORS[selected.status])}>{selected.status}</span>
                </div>
                {[
                  ['Start', fmtDateTime(selected.start_time)],
                  ['End', fmtTime(selected.end_time)],
                  selected.location && ['Location', selected.location],
                  selected.notes && ['Notes', selected.notes],
                ].filter((item): item is [string, string] => Boolean(item)).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 rounded-md border border-zinc-100 bg-white px-3 py-2 text-sm">
                    <span className="text-ink-tertiary">{k}</span>
                    <span className="text-right font-medium text-ink">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5">
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Subject *</label>
                  <input className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white" placeholder="e.g. Morning Logistics" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Start *</label>
                    <input type="datetime-local" className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">End *</label>
                    <input type="datetime-local" className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} required />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Assign Recipient</label>
                  <select className="w-full appearance-none rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white" value={form.assigneeId} onChange={e => setForm(f => ({...f, assigneeId: e.target.value}))}>
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
                  <input className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white" placeholder="e.g. Warehouse A" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Instructions</label>
                  <textarea className="min-h-[90px] w-full rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black focus:bg-white" placeholder="Add details..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Color Tag</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button type="button" key={c} onClick={() => setForm(f => ({...f, color: c}))}
                        className={cn('h-7 w-7 rounded-full border border-zinc-200 transition-transform', form.color === c ? 'scale-110 ring-2 ring-black ring-offset-2' : 'hover:scale-105')}
                        style={{background: c}} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  {selected && (
                    <button type="button" onClick={handleDelete} className="rounded-md border border-red-200 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-600 transition-colors hover:bg-red-50">Delete</button>
                  )}
                  <button type="submit" className="flex-1 rounded-md bg-black py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading}>
                    {loading ? 'Saving...' : selected ? 'Update Shift' : 'Create Shift'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
