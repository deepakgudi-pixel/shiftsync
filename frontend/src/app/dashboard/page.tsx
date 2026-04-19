'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'


import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Calendar, AlertCircle, TrendingUp, Clock, DollarSign, Activity, Bell } from 'lucide-react'

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
  id: string; title: string; content: string; priority: string; created_at: string
}

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div className="card p-5 flex items-start gap-4 animate-slide-up">
    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
      <Icon size={18} strokeWidth={2} />
    </div>
    <div>
      <p className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>{value}</p>
      <p className="text-sm text-ink-tertiary mt-0.5">{label}</p>
      {sub && <p className="text-xs text-ink-disabled mt-0.5">{sub}</p>}
    </div>
  </div>
)

export default function DashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser()
  const api = useApi()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [member, setMember] = useState<any>(null)
  const socket = useSocket(member?.organisation_id, member?.id)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const load = async () => {
      try {
        const [me, ann] = await Promise.all([
          api.get('/api/members/me'),
          api.get('/api/organisations/announcements'),
        ])
        setMember(me.data)
        setAnnouncements(ann.data)

        if (me.data.role === 'ADMIN') {
          const [ana, sh] = await Promise.all([
            api.get('/api/analytics/overview'),
            api.get('/api/shifts', { params: { start: new Date().toISOString(), end: new Date(Date.now() + 7*24*60*60*1000).toISOString() } }),
          ])
          setAnalytics(ana.data)
          setShifts(sh.data.slice(0, 5))
        } else if (me.data.role === 'MANAGER') {
          const sh = await api.get('/api/shifts', { params: { start: new Date().toISOString(), end: new Date(Date.now() + 7*24*60*60*1000).toISOString() } })
          setShifts(sh.data.slice(0, 5))
          setAnalytics(null)
        } else {
          const sh = await api.get('/api/shifts', { params: { assigneeId: me.data.id, start: new Date().toISOString(), end: new Date(Date.now() + 7*24*60*60*1000).toISOString() } })
          setShifts(sh.data)
        }
      } catch (err) { console.error(err) }
    }
    load()
  }, [isLoaded, isSignedIn, api])

  useEffect(() => {
    if (!socket) return
    socket.on('shift:created', () => toast.success('New shift created'))
    socket.on('announcement:new', (ann: Announcement) => {
      setAnnouncements(prev => [ann, ...prev])
      toast('📢 ' + ann.title)
    })
    return () => { socket.off('shift:created'); socket.off('announcement:new') }
  }, [socket])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>
          {greeting}, {user?.firstName || 'there'} 👋
        </h1>
        <p className="text-ink-tertiary mt-1 text-sm">
          {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>

      {/* Stats — admin/manager only */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Members" value={analytics.totalMembers} color="bg-brand-50 text-brand-500" />
          <StatCard icon={Calendar} label="Shifts This Week" value={analytics.shiftsThisWeek} color="bg-purple-50 text-purple-500" />
          <StatCard icon={AlertCircle} label="Open Shifts" value={analytics.openShifts} sub="Need assignment" color="bg-amber-50 text-amber-500" />
          <StatCard icon={Activity} label="Active Now" value={analytics.activeNow} sub="Clocked in" color="bg-green-50 text-green-500" />
          <StatCard icon={TrendingUp} label="Completed (Month)" value={analytics.completedThisMonth} color="bg-teal-50 text-teal-500" />
          <StatCard icon={Clock} label="Hours (Month)" value={`${analytics.totalHours}h`} color="bg-rose-50 text-rose-500" />
          <StatCard icon={DollarSign} label="Labor Cost" value={`$${analytics.totalLaborCost.toLocaleString()}`} sub="This month" color="bg-emerald-50 text-emerald-500" />
          <StatCard icon={Bell} label="Open Swaps" value="—" sub="Review pending" color="bg-orange-50 text-orange-500" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        {analytics && (
          <div className="card p-5 lg:col-span-2">
            <h2 className="font-semibold text-ink mb-4" style={{fontFamily:'var(--font-bricolage)'}}>Shift Coverage This Month</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.shiftsByDay} barSize={24}>
                <XAxis dataKey="day" tick={{ fontSize:12, fill:'#8888aa' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:12, fill:'#8888aa' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius:'12px', border:'1px solid #e4e4f0', fontSize:'13px' }} />
                <Bar dataKey="total" fill="#e4e4f0" radius={[6,6,0,0]} name="Total" />
                <Bar dataKey="completed" fill="#4f6eff" radius={[6,6,0,0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
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
          <h2 className="font-semibold text-ink mb-4" style={{fontFamily:'var(--font-bricolage)'}}>Announcements</h2>
          {announcements.length === 0 && <p className="text-sm text-ink-tertiary">No announcements yet</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {announcements.slice(0,6).map(a => (
              <div key={a.id} className="p-4 rounded-xl border border-surface-200 hover:border-brand-200 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-ink">{a.title}</p>
                  <span className={cn('badge flex-shrink-0', a.priority === 'URGENT' ? 'bg-red-100 text-red-700' : a.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-ink-tertiary')}>
                    {a.priority}
                  </span>
                </div>
                <p className="text-xs text-ink-secondary line-clamp-2">{a.content}</p>
                <p className="text-xs text-ink-disabled mt-2">{fmtRelative(a.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
