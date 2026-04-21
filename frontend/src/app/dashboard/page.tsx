'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Calendar, AlertCircle, TrendingUp, Clock, DollarSign, Activity, Bell, Plus, X, Trash2, User } from 'lucide-react'

import toast from 'react-hot-toast'
import { useApi } from '@/hooks/useApi'
import { useSocket } from '@/hooks/useSocket'
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
  id: string; title: string; start_time: string; end_time: string
  status: string; color: string; assignee_name?: string; location?: string
}

interface Announcement {
  id: string; title: string; content: string; priority: string; created_at: string; target_name?: string; target_member_id?: string
}

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div className="group relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-white to-surface-50 p-7 backdrop-blur-2xl border border-white/60 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-12px_rgba(79,110,255,0.15)] hover:-translate-y-1.5 transition-all duration-700 ease-out animate-slide-up">
    <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/0 via-brand-500/0 to-brand-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    <div className="flex items-center gap-5 relative z-10">
      <div className={cn('w-14 h-14 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)] transition-all duration-700 group-hover:scale-110 group-hover:rotate-6', color)}>
        <Icon size={26} strokeWidth={2.5} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-tertiary mb-0.5 opacity-60">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-black tracking-tighter text-ink leading-none" style={{fontFamily:'var(--font-bricolage)'}}>{value}</p>
          {sub && <p className="text-[11px] font-bold text-ink-disabled lowercase">{sub}</p>}
        </div>
      </div>
    </div>
    <div className="absolute -right-6 -bottom-6 opacity-[0.04] group-hover:opacity-[0.1] group-hover:scale-110 transition-all duration-1000">
      <Icon size={120} />
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
  const [member, setMember] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const socket = useSocket(member?.organisation_id, member?.id)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'NORMAL', targetMemberId: '' })
  const [annLoading, setAnnLoading] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const load = async () => {
      try {
        const [meRes, annRes] = await Promise.all([
          api.get('/api/members/me'),
          api.get('/api/organisations/announcements'),
        ])

        const me = meRes.data;
        setMember(me);
        setAnnouncements(annRes.data);

        const weekParams = { 
          start: new Date().toISOString(), 
          end: new Date(Date.now() + 7*24*60*60*1000).toISOString() 
        };

        if (me.role === 'ADMIN') {
          const [ana, sh, teamRes] = await Promise.all([
            api.get('/api/analytics/overview'),
            api.get('/api/shifts', { params: weekParams }),
            api.get('/api/members')
          ])
          setAnalytics(ana.data)
          setShifts(sh.data.slice(0, 5))
          setTeam(teamRes.data)
        } else if (me.role === 'MANAGER') {
          const sh = await api.get('/api/shifts', { params: weekParams })
          setShifts(sh.data.slice(0, 5))
          setAnalytics(null)
        } else {
          const sh = await api.get('/api/shifts', { params: { ...weekParams, assigneeId: me.id } })
          setShifts(sh.data)
        }
      } catch (err: any) {
        // If member not found — new user signed in instead of signed up
        if (err.response?.status === 404) {
          router.push('/onboarding')
          return
        }
        console.error(err)
      } finally { 
        setLoading(false) 
      }
    }
    load()
  }, [isLoaded, isSignedIn, api])

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
    return () => { socket.off('shift:created'); socket.off('announcement:new'); socket.off('announcement:deleted') }
  }, [socket, member])

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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-5 md:p-8 max-w-[1400px] mx-auto min-h-screen selection:bg-brand-100">
      {/* Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="animate-in fade-in slide-in-from-left duration-700">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 border border-emerald-100/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live System
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-ink tracking-tight mb-3" style={{fontFamily:'var(--font-bricolage)'}}>
            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-violet-600">{user?.firstName || 'there'}</span> 👋
          </h1>
          <p className="text-ink-tertiary font-semibold flex items-center gap-2.5 opacity-80">
            <Calendar size={18} className="text-brand-500" />
            {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats — admin only */}
      {(analytics || loading) && (member?.role === 'ADMIN') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
          {loading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />) : (
            <>
              <StatCard icon={Users} label="Total Members" value={analytics?.totalMembers} color="bg-indigo-50 text-indigo-600" />
              <StatCard icon={Calendar} label="Active Shifts" value={analytics?.shiftsThisWeek} color="bg-violet-50 text-violet-600" />
              <StatCard icon={AlertCircle} label="Open Slots" value={analytics?.openShifts} sub="Critical status" color="bg-rose-50 text-rose-600" />
              <StatCard icon={Activity} label="Live Now" value={analytics?.activeNow} sub="Current visibility" color="bg-emerald-50 text-emerald-600" />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        {(analytics || loading) && (member?.role === 'ADMIN') && (
          <div className="bg-white/70 backdrop-blur-3xl border border-white/60 p-6 md:p-10 rounded-[3rem] lg:col-span-2 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_70px_-15px_rgba(79,110,255,0.08)] transition-all duration-700 group">
            {loading ? <Skeleton className="h-[300px] w-full" /> : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                  <div>
                    <h2 className="text-2xl font-black text-ink tracking-tight" style={{fontFamily:'var(--font-bricolage)'}}>Workforce Velocity</h2>
                    <p className="text-xs font-bold text-ink-tertiary uppercase tracking-widest opacity-60 mt-1">Shift completion efficiency</p>
                  </div>
                  <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-brand-200" /><div className="w-3 h-3 rounded-full bg-brand-500" /></div>
                </div>
                <div className="h-[240px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.shiftsByDay} barSize={36}>
                      <XAxis dataKey="day" tick={{ fontSize:11, fontWeight:700, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:11, fontWeight:700, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(79, 110, 255, 0.05)'}} contentStyle={{ borderRadius:'20px', border:'none', boxShadow:'0 10px 40px rgba(0,0,0,0.1)', fontSize:'13px' }} />
                      <Bar dataKey="total" fill="#f1f5f9" radius={[12,12,0,0]} name="Total" />
                      <Bar dataKey="completed" fill="#4f6eff" radius={[12,12,0,0]} name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* Upcoming Shifts */}
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-4" style={{fontFamily:'var(--font-bricolage)'}}>
            {member?.role === 'EMPLOYEE' ? 'My Upcoming Shifts' : 'Upcoming Shifts'}
          </h2>
          <div className="space-y-3">
            {shifts.length === 0 && (
              <p className="text-sm text-ink-tertiary text-center py-6">No upcoming shifts</p>
            )}
            {shifts.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{background: s.color || '#4f6eff'}} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{s.title}</p>
                  <p className="text-xs text-ink-tertiary mt-0.5">{fmtDateTime(s.start_time)}</p>
                  {s.assignee_name && <p className="text-xs text-ink-disabled mt-0.5">{s.assignee_name}</p>}
                </div>
                <span className={cn('badge text-xs', s.status === 'ASSIGNED' ? 'bg-brand-100 text-brand-700' : s.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                  {s.status.replace('_',' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Announcements</h2>
            {member?.role === 'ADMIN' && (
              <button onClick={() => setShowAnnModal(true)} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2">
                <Plus size={14} /> Post Announcement
              </button>
            )}
          </div>
          
          {announcements.length === 0 && <p className="text-sm text-ink-tertiary">No announcements yet</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {announcements.slice(0,6).map(a => (
              <div key={a.id} className="p-4 rounded-xl border border-surface-200 hover:border-brand-200 transition-colors relative group">
                {member?.role === 'ADMIN' && (
                  <button onClick={() => handleDeleteAnnouncement(a.id)} className="absolute top-2 right-2 p-1.5 text-ink-disabled hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-ink">{a.title}</p>
                  <span className={cn('badge flex-shrink-0', a.priority === 'URGENT' ? 'bg-red-100 text-red-700' : a.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-ink-tertiary')}>
                    {a.priority}
                  </span>
                </div>
                {a.target_name && (
                  <div className="flex items-center gap-1 text-[10px] text-brand-600 font-bold uppercase mb-2">
                    <User size={10} /> To: {a.target_name}
                  </div>
                )}
                <p className="text-xs text-ink-secondary line-clamp-2">{a.content}</p>
                <p className="text-xs text-ink-disabled mt-2">{fmtRelative(a.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Announcement Modal */}
      {showAnnModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowAnnModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Post Announcement</h2>
              <button onClick={() => setShowAnnModal(false)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>
            <form onSubmit={handlePostAnnouncement} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-ink-secondary block mb-1.5">Title</label>
                <input className="input" placeholder="Organization-wide update..." value={annForm.title} onChange={e => setAnnForm(f => ({...f, title: e.target.value}))} required />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-secondary block mb-1.5">Priority</label>
                <div className="flex gap-2">
                  {['NORMAL', 'HIGH', 'URGENT'].map(p => (
                    <button key={p} type="button" onClick={() => setAnnForm(f => ({...f, priority: p}))}
                      className={cn('flex-1 py-2 text-xs font-medium rounded-lg border transition-all', 
                        annForm.priority === p ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-surface-200 text-ink-tertiary hover:border-brand-100')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-secondary block mb-1.5">Visibility</label>
                <select 
                  className="input" 
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
                <label className="text-sm font-medium text-ink-secondary block mb-1.5">Content</label>
                <textarea className="input min-h-[120px] py-2" placeholder="Write your message here..." value={annForm.content} onChange={e => setAnnForm(f => ({...f, content: e.target.value}))} required />
              </div>
              <div className="pt-2">
                <button type="submit" className="btn-primary w-full" disabled={annLoading}>
                  {annLoading ? 'Posting...' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}