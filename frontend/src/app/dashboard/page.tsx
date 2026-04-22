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
  <div className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-zinc-50 border border-zinc-100">
        <Icon size={16} className="text-black" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
    <div className="flex-1">
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold text-black tracking-tight">{value}</p>
          {sub && <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{sub}</p>}
        </div>
      </div>
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
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }

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
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Shift completion efficiency</p>
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
        <div className="bg-white border border-zinc-200 p-5 shadow-sm">
          <h2 className="text-[10px] font-bold text-black mb-6 uppercase tracking-[0.2em] border-l-2 border-black pl-3">
            {member?.role === 'EMPLOYEE' ? 'My Upcoming Shifts' : 'Upcoming Shifts'}
          </h2>
          <div className="space-y-3">
            {shifts.length === 0 && (
              <p className="text-[10px] font-bold text-zinc-400 text-center py-6 uppercase tracking-widest">No upcoming shifts</p>
            )}
            {shifts.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 bg-zinc-50 border border-zinc-100 hover:border-zinc-300 transition-all group">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-black truncate uppercase tracking-widest">{s.title}</p>
                  <p className="text-[9px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wider">{fmtDateTime(s.start_time)}</p>
                </div>
                <span className={cn('text-[9px] font-bold uppercase px-2 py-0.5 tracking-tighter', s.status === 'ASSIGNED' ? 'text-black bg-zinc-200' : s.status === 'IN_PROGRESS' ? 'text-white bg-black' : 'text-zinc-400 bg-zinc-100')}>
                  {s.status.replace('_',' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

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
    </div>
  )
}