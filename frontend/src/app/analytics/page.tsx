'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useApi } from '@/hooks/useApi'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Users, Clock, DollarSign, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-zinc-100 animate-pulse rounded-none", className)} />
)

export default function AnalyticsPage() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const api = useApi()
  const [analytics, setAnalytics] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const load = async () => {
      try {
        const [meRes, analyticsRes] = await Promise.allSettled([
          api.get('/api/members/me'),
          api.get('/api/analytics/overview')
        ]);

        if (meRes.status === 'rejected' && meRes.reason.response?.status === 404) {
          router.push('/onboarding')
          return
        }
        
        if (meRes.status === 'fulfilled') setMember(meRes.value.data)
        if (analyticsRes.status === 'fulfilled') {
          setAnalytics(analyticsRes.value.data);
        } 
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isLoaded, isSignedIn, api, router])

  if (loading) {
    return (
      <div className="p-6 max-w-[1200px]">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <Skeleton className="h-[240px] w-full" />
          </div>
          <div className="card p-5">
            <Skeleton className="h-[240px] w-full" />
          </div>
          <div className="card p-5 lg:col-span-2">
            <Skeleton className="h-[120px] w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (member?.role !== 'ADMIN') {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h1 className="text-xl font-bold text-ink mb-2">Access Restricted</h1>
        <p className="text-ink-tertiary">Only administrators can view the analytics dashboard.</p>
      </div>
    )
  }

  if (!analytics) return <div className="p-6 text-ink-tertiary">No data available.</div>

  const coverageData = analytics.shiftsByDay.map((d: any) => ({
    ...d,
    coverage: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
  }))

  const COLORS = ['#4f6eff','#7c3aed','#059669','#d97706']

  return (
    <div className="p-5 md:p-8 max-w-[1200px] mx-auto min-h-screen">
      <div className="mb-10 border-b border-zinc-200 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">Analytics</h1>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">Workforce performance metrics</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
        {[
          { icon: Users, label: 'Total Members', value: analytics.totalMembers },
          { icon: Clock, label: 'Hours Tracked', value: `${analytics.totalHours}h` },
          { icon: DollarSign, label: 'Labor Cost', value: `$${analytics.totalLaborCost.toLocaleString()}` },
          { icon: TrendingUp, label: 'Completed Shifts', value: analytics.completedThisMonth },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white border border-zinc-200 p-6 rounded-none shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-zinc-50 border border-zinc-100">
                <Icon size={16} className="text-black" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
            </div>
            <p className="text-3xl font-bold text-black tracking-tight leading-none">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shifts by day */}
        <div className="bg-white border border-zinc-200 p-6 md:p-8 rounded-none shadow-sm">
          <h2 className="text-lg font-bold text-black uppercase tracking-widest mb-8 border-l-2 border-black pl-3">Shift Distribution</h2>
          <div className="h-[200px] md:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.shiftsByDay} barSize={28}>
              <XAxis dataKey="day" tick={{fontSize:10, fontWeight: 700, fill:'#a1a1aa'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:10, fontWeight: 700, fill:'#a1a1aa'}} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'rgba(0, 0, 0, 0.02)'}} contentStyle={{backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: '0', fontSize: '12px'}} />
              <Bar dataKey="total" fill="#f4f4f5" radius={0} name="Total" />
              <Bar dataKey="completed" fill="#18181b" radius={0} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Coverage rate */}
        <div className="bg-white border border-zinc-200 p-6 md:p-8 rounded-none shadow-sm">
          <h2 className="text-lg font-bold text-black uppercase tracking-widest mb-8 border-l-2 border-black pl-3">Coverage Rate (%)</h2>
          <div className="h-[200px] md:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={coverageData}>
              <XAxis dataKey="day" tick={{fontSize:10, fontWeight: 700, fill:'#a1a1aa'}} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{fontSize:10, fontWeight: 700, fill:'#a1a1aa'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{backgroundColor: '#fff', border: '1px solid #e4e4e7', borderRadius: '0', fontSize: '12px'}} formatter={(v: any) => [`${v}%`, 'Coverage']} />
              <Line type="monotone" dataKey="coverage" stroke="#18181b" strokeWidth={2} dot={{fill:'#18181b',r:4}} activeDot={{r:6}} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Summary stats */}
        <div className="bg-white border border-zinc-200 p-6 md:p-8 rounded-none lg:col-span-2 shadow-sm">
          <h2 className="text-lg font-bold text-black uppercase tracking-widest mb-8 border-l-2 border-black pl-3">Quick Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Open Shifts', value: analytics.openShifts, note: 'Need assignment' },
              { label: 'Active Right Now', value: analytics.activeNow, note: 'Clocked in' },
              { label: 'Shifts This Week', value: analytics.shiftsThisWeek, note: 'Scheduled' },
            ].map(item => (
              <div key={item.label} className="text-center p-6 bg-zinc-50 border border-zinc-100">
                <p className="text-3xl font-bold text-black">{item.value}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">{item.label}</p>
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter mt-1">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
