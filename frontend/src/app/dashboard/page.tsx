'use client'
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Calendar, AlertCircle, TrendingUp, Clock, DollarSign, Activity, Bell, Plus, X, Trash2, User, ArrowRightLeft, MessageSquare } from 'lucide-react'

import toast from 'react-hot-toast'
import { useApi } from '@/hooks/useApi'
import { SOCKET_RESYNC_EVENT, useSocket } from '@/hooks/useSocket'
import { cn, fmtDateTime, fmtRelative } from '@/lib/utils'

interface Analytics {
  totalMembers: number
  shiftsThisWeek: number
  openShifts: number
  completedThisMonth: number
  activeNow: number
  totalHours: number
  totalLaborCost: number
  shiftsByDay: { day: string; total: number; completed: number }[]
}

interface Shift {
  id: string; title: string; start_time: string; end_time: string; assignee_id?: string
  status: string; color: string; assignee_name?: string; location?: string; organisation_id: string
}

interface Announcement {
  id: string; title: string; content: string; priority: string; created_at: string; target_name?: string; target_member_id?: string
}

interface SwapRequest {
  id: string
  shift_id: string
  shift_title: string
  requester_id: string
  requester_name: string
  target_id: string | null
  target_name: string | null
  reason: string
  status: string
  created_at: string
}

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-zinc-50 border border-zinc-100">
        <Icon size={16} className="text-black" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
    <div className="flex items-baseline gap-2">
      <p className="text-3xl font-bold text-black tracking-tight">{value}</p>
      {sub && <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{sub}</p>}
    </div>
  </div>
)

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-surface-100 animate-pulse rounded-2xl", className)} />
)

export default function DashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const api = useApi()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [member, setMember] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const socket = useSocket(member?.organisation_id, member?.id)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'NORMAL', targetMemberId: '' })
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [swapForm, setSwapForm] = useState({ reason: '', targetId: '' })
  const [annLoading, setAnnLoading] = useState(false)

  const loadDashboard = useCallback(async (showInitialLoader = false) => {
    if (!isSignedIn) return

    if (showInitialLoader) {
      setLoading(true)
    }

    try {
      const [meRes, annRes] = await Promise.all([
        api.get('/api/members/me'),
        api.get('/api/organisations/announcements'),
      ])

      const me = meRes.data
      setMember(me)
      setAnnouncements(annRes.data)

      const weekParams = {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }

      if (me.role === 'ADMIN') {
        const [ana, sh, teamRes, swapRes] = await Promise.all([
          api.get('/api/analytics/overview'),
          api.get('/api/shifts', { params: weekParams }),
          api.get('/api/members'),
          api.get('/api/shifts/swaps/pending'),
        ])
        setAnalytics(ana.data)
        setShifts(sh.data.slice(0, 5))
        setTeam(teamRes.data)
        setSwaps(swapRes.data)
      } else if (me.role === 'MANAGER') {
        const [sh, teamRes, swapRes] = await Promise.all([
          api.get('/api/shifts', { params: weekParams }),
          api.get('/api/members'),
          api.get('/api/shifts/swaps/pending'),
        ])
        setShifts(sh.data.slice(0, 5))
        setTeam(teamRes.data)
        setSwaps(swapRes.data)
        setAnalytics(null)
      } else {
        const [sh, teamRes] = await Promise.all([
          api.get('/api/shifts', { params: { ...weekParams, assigneeId: me.id } }),
          api.get('/api/members'),
        ])
        setShifts(sh.data)
        setTeam(teamRes.data)
        setAnalytics(null)
        setSwaps([])
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        router.push('/onboarding')
        return
      }
      console.error(err)
    } finally {
      if (showInitialLoader) {
        setLoading(false)
      }
    }
  }, [api, isSignedIn, router])

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    loadDashboard(true)
  }, [isLoaded, isSignedIn, loadDashboard, router])

  useEffect(() => {
    if (!socket) return
    socket.on('shift:created', () => toast.success('New shift created'))
    socket.on('announcement:new', (ann: Announcement) => {
      if (ann.target_member_id && ann.target_member_id !== member?.id && member?.role !== 'ADMIN') return
      setAnnouncements(prev => [ann, ...prev])
      toast('📢 ' + ann.title)
    })
    socket.on('announcement:deleted', ({ id }: { id: string }) => {
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    })
    socket.on('swap:requested', (swap: SwapRequest) => {
      if (member?.role === 'ADMIN' || member?.role === 'MANAGER') {
        setSwaps(prev => [swap, ...prev])
      }
      toast('🔄 New swap request: ' + swap.shift_title)
    })
    socket.on('swap:processed', ({ id }: { id: string }) => {
      setSwaps(prev => prev.filter(s => s.id !== id))
    })
    socket.on('shift:updated', (updated: Shift) => {
      setShifts(prev => prev.map(s => s.id === updated.id ? updated : s))
    })

    return () => { 
      socket.off('shift:created'); 
      socket.off('announcement:new'); 
      socket.off('announcement:deleted');
      socket.off('swap:requested');
      socket.off('swap:processed');
      socket.off('shift:updated');
    }
  }, [socket, member])

  useEffect(() => {
    if (!member?.organisation_id) return

    const handleResync = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.orgId !== member.organisation_id || detail?.memberId !== member.id) return
      loadDashboard(false).catch(() => {})
    }

    window.addEventListener(SOCKET_RESYNC_EVENT, handleResync)
    return () => window.removeEventListener(SOCKET_RESYNC_EVENT, handleResync)
  }, [member, loadDashboard])

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnnLoading(true)
    try {
      await api.post('/api/organisations/announcements', annForm)
      setShowAnnModal(false)
      setAnnForm({ title: '', content: '', priority: 'NORMAL', targetMemberId: '' })
      toast.success('Announcement posted')
    } catch {
      toast.error('Failed to post announcement')
    } finally { setAnnLoading(false) }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await api.delete(`/api/organisations/announcements/${id}`)
      toast.success('Announcement removed')
    } catch { toast.error('Failed to remove') }
  }

  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShift) return
    try {
      await api.post(`/api/shifts/${selectedShift.id}/swap`, swapForm)
      setShowSwapModal(false)
      setSwapForm({ reason: '', targetId: '' })
      toast.success('Swap request submitted')
    } catch {
      toast.error('Failed to submit request')
    }
  }

  const handleSwapAction = async (swapId: string, shiftId: string, status: string) => {
    try {
      await api.patch(`/api/shifts/${shiftId}/swap/${swapId}`, { status })
      setSwaps(prev => prev.filter(s => s.id !== swapId))
      toast.success(`Swap request ${status.toLowerCase()}`)
    } catch {
      toast.error('Failed to process swap request')
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-5 md:p-8 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-10 border-b border-zinc-200 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">
          {greeting}, <span className="text-zinc-500">{user?.firstName || 'there'}</span>
        </h1>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Calendar size={14} />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
        </p>
      </div>

      {/* Stats — admin only */}
      {(analytics || loading) && (member?.role === 'ADMIN') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
          {loading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />) : (
            <>
              <StatCard icon={Users} label="Total Members" value={analytics?.totalMembers} />
              <StatCard icon={Calendar} label="Active Shifts" value={analytics?.shiftsThisWeek} />
              <StatCard icon={AlertCircle} label="Open Slots" value={analytics?.openShifts} sub="Critical" />
              <StatCard icon={Activity} label="Live Now" value={analytics?.activeNow} />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        {(analytics || loading) && (member?.role === 'ADMIN') && (
          <div className="bg-white border border-zinc-200 p-6 md:p-10 rounded-none lg:col-span-2 shadow-sm">
            {loading ? <Skeleton className="h-[300px] w-full" /> : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                  <div>
                    <h2 className="text-lg font-bold text-black uppercase tracking-widest">Workforce Velocity</h2>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Recent shift distribution and completion flow</p>
                  </div>
                </div>
                <div className="h-[240px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.shiftsByDay} barSize={36}>
                      <XAxis dataKey="day" tick={{ fontSize:10, fontWeight: 700, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fontWeight: 700, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(0, 0, 0, 0.02)'}} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: '0', fontSize: '12px' }} />
                      <Bar dataKey="total" fill="#f4f4f5" radius={0} name="Total" />
                      <Bar dataKey="completed" fill="#18181b" radius={0} name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* Upcoming Shifts */}
        <div className="bg-white border border-zinc-200 p-5 shadow-sm lg:col-span-1">
          <h2 className="text-[10px] font-bold text-black mb-6 uppercase tracking-[0.2em] border-l-2 border-black pl-3">
            {member?.role === 'EMPLOYEE' ? 'My Upcoming Shifts' : 'Upcoming Shifts'}
          </h2>
          <div className="space-y-3">
            {shifts.length === 0 && (
              <p className="text-[10px] font-bold text-zinc-400 text-center py-6 uppercase tracking-widest">No upcoming shifts</p>
            )}
            {shifts.map(s => (
              <div key={s.id} className="p-4 bg-zinc-50 border border-zinc-100 hover:border-zinc-300 transition-all flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-black truncate uppercase tracking-widest">{s.title}</p>
                    <p className="text-[9px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">{fmtDateTime(s.start_time)}</p>
                  </div>
                  <span className={cn('text-[9px] font-bold uppercase px-2 py-1 tracking-tighter shrink-0', s.status === 'ASSIGNED' ? 'text-black bg-zinc-200' : s.status === 'IN_PROGRESS' ? 'text-white bg-black' : 'text-zinc-400 bg-zinc-100')}>
                    {s.status.replace('_',' ')}
                  </span>
                </div>

                {member?.id === s.assignee_id && s.status === 'ASSIGNED' && (
                  <button 
                    onClick={() => { setSelectedShift(s); setShowSwapModal(true); }}
                    className="w-full py-2 bg-white border border-zinc-200 text-black text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-black hover:text-white hover:border-black transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <ArrowRightLeft size={12} />
                    Request Swap
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Swap Requests — admin/manager only */}
        {(swaps.length > 0 || loading) && (member?.role === 'ADMIN' || member?.role === 'MANAGER') && (
          <div className="bg-white border border-zinc-200 p-5 shadow-sm lg:col-span-3">
            <h2 className="text-[10px] font-bold text-black mb-6 uppercase tracking-[0.2em] border-l-2 border-black pl-3">
              Pending Swap Requests
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {swaps.map(sw => (
                <div key={sw.id} className="p-4 bg-zinc-50 border border-zinc-100 group flex flex-col justify-between">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-black uppercase tracking-widest truncate max-w-[80px]">{sw.requester_name}</span>
                      <ArrowRightLeft size={10} className="text-zinc-400 flex-shrink-0" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[80px]">{sw.target_name || 'Open Pool'}</span>
                    </div>
                    <p className="text-[11px] font-bold text-black uppercase tracking-widest">{sw.shift_title}</p>
                    {sw.reason && <p className="text-[9px] text-zinc-500 mt-2 line-clamp-2 italic leading-relaxed">"{sw.reason}"</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-auto">
                    <button onClick={() => handleSwapAction(sw.id, sw.shift_id, 'APPROVED')} className="flex-1 py-2 bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">
                      Approve
                    </button>
                    <button onClick={() => handleSwapAction(sw.id, sw.shift_id, 'REJECTED')} className="flex-1 py-2 border border-zinc-200 text-black text-[9px] font-bold uppercase tracking-widest hover:bg-zinc-50 transition-all">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Announcements */}
        <div className="bg-white border border-zinc-200 p-5 lg:col-span-3 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em] border-l-2 border-black pl-3">Announcements</h2>
            {member?.role === 'ADMIN' && (
              <button onClick={() => setShowAnnModal(true)} className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                <Plus size={12} className="inline mr-1" /> Create Post
              </button>
            )}
          </div>
          
          {announcements.length === 0 && <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No active announcements</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {announcements.slice(0,6).map(a => (
              <div key={a.id} className="p-4 border border-zinc-100 bg-zinc-50 relative group hover:border-zinc-300 transition-all">
                {member?.role === 'ADMIN' && (
                  <button onClick={() => handleDeleteAnnouncement(a.id)} className="absolute top-2 right-2 p-1 text-zinc-300 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-[11px] font-bold text-black uppercase tracking-widest leading-tight">{a.title}</p>
                  <span className={cn('text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter', 
                    a.priority === 'URGENT' ? 'bg-black text-white' : 
                    a.priority === 'HIGH' ? 'bg-zinc-200 text-black' : 
                    'bg-white text-zinc-400 border border-zinc-100')}>
                    {a.priority}
                  </span>
                </div>
                {a.target_name && (
                  <div className="flex items-center gap-1 text-[10px] text-brand-600 font-bold uppercase mb-2">
                    <User size={10} /> To: {a.target_name}
                  </div>
                )}
                <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2 mb-3">{a.content}</p>
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{fmtRelative(a.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Announcement Modal */}
      {showAnnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowAnnModal(false)}>
          <div className="bg-white border border-zinc-200 w-full max-w-md animate-slide-up relative shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">New Announcement</h2>
              <button onClick={() => setShowAnnModal(false)} className="text-zinc-400 hover:text-black transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handlePostAnnouncement} className="p-5 space-y-4">
              <div>
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Subject</label>
                <input className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors" placeholder="Announcement title..." value={annForm.title} onChange={e => setAnnForm(f => ({...f, title: e.target.value}))} required />
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Priority</label>
                <div className="flex gap-2">
                  {['NORMAL', 'HIGH', 'URGENT'].map(p => (
                    <button key={p} type="button" onClick={() => setAnnForm(f => ({...f, priority: p}))}
                      className={cn('flex-1 py-2 text-[9px] font-black uppercase tracking-widest border transition-all', 
                        annForm.priority === p ? 'bg-black text-white border-black' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-400')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Recipient</label>
                <select 
                  className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors appearance-none" 
                  value={annForm.targetMemberId} 
                  onChange={e => setAnnForm(f => ({...f, targetMemberId: e.target.value}))}
                >
                  <option value="">Global (Everyone)</option>
                  <optgroup label="Direct Message">
                    {team.filter(t => t.id !== member?.id).map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Content</label>
                <textarea className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors min-h-[100px]" placeholder="Write message here..." value={annForm.content} onChange={e => setAnnForm(f => ({...f, content: e.target.value}))} required />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full py-4 bg-black text-white font-black uppercase tracking-[0.3em] text-[10px] hover:bg-zinc-800 transition-colors" disabled={annLoading}>
                  {annLoading ? 'POSTING...' : 'POST ANNOUNCEMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Swap Request Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowSwapModal(false)}>
          <div className="bg-white border border-zinc-200 w-full max-w-md animate-slide-up relative shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <div>
                <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">Request Shift Swap</h2>
                <p className="text-[9px] text-zinc-400 uppercase tracking-widest mt-1">{selectedShift?.title}</p>
              </div>
              <button onClick={() => setShowSwapModal(false)} className="text-zinc-400 hover:text-black transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleRequestSwap} className="p-5 space-y-4">
              <div>
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Colleague (Optional)</label>
                <select 
                  className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors appearance-none" 
                  value={swapForm.targetId} 
                  onChange={e => setSwapForm(f => ({...f, targetId: e.target.value}))}
                >
                  <option value="">Open Pool (Assign to anyone)</option>
                  {team.filter(t => t.id !== member?.id).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Reason for Request</label>
                <textarea className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors min-h-[80px]" placeholder="Explain why you need a swap..." value={swapForm.reason} onChange={e => setSwapForm(f => ({...f, reason: e.target.value}))} required />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full py-4 bg-black text-white font-black uppercase tracking-[0.3em] text-[10px] hover:bg-zinc-800 transition-colors">
                  SUBMIT SWAP REQUEST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
