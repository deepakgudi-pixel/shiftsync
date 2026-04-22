'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useApi } from '@/hooks/useApi'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Users, Clock, DollarSign, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-surface-200 animate-pulse rounded-xl", className)} />
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
    <div className="p-6 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-ink tracking-tight">Analytics Dashboard</h1>
        <p className="text-sm font-bold text-ink-tertiary uppercase tracking-widest opacity-60 mt-1">Workforce performance metrics</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { icon: Users, label: 'Total Members', value: analytics.totalMembers, color: 'bg-brand-50 text-brand-600' },
          { icon: Clock, label: 'Hours Tracked', value: `${analytics.totalHours}h`, color: 'bg-violet-50 text-violet-600' },
          { icon: DollarSign, label: 'Labor Cost', value: `$${analytics.totalLaborCost.toLocaleString()}`, color: 'bg-green-50 text-green-600' },
          { icon: TrendingUp, label: 'Efficiency', value: analytics.completedThisMonth, color: 'bg-amber-50 text-amber-600' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white/80 border border-white/60 p-6 rounded-[2rem] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)] flex items-center gap-5 hover:shadow-[0_15px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-500">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm', color)}>
              <Icon size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-ink-tertiary opacity-60 mb-1">{label}</p>
              <p className="text-3xl font-black text-ink tracking-tight leading-none">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shifts by day */}
        <div className="bg-white/80 border border-white/60 p-8 rounded-[2.5rem] shadow-sm">
          <h2 className="text-xl font-black text-ink tracking-tight mb-8">Weekly Distribution</h2>
          <div className="h-[200px] md:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.shiftsByDay} barSize={28}>
              <XAxis dataKey="day" tick={{fontSize:12,fill:'#8888aa'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:12,fill:'#8888aa'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e4e4f0',fontSize:'13px'}} />
              <Bar dataKey="total" fill="#e4e4f0" radius={[6,6,0,0]} name="Total" />
              <Bar dataKey="completed" fill="#4f6eff" radius={[6,6,0,0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Coverage rate */}
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-4">Coverage Rate by Day (%)</h2>
          <div className="h-[200px] md:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={coverageData}>
              <XAxis dataKey="day" tick={{fontSize:12,fill:'#8888aa'}} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{fontSize:12,fill:'#8888aa'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e4e4f0',fontSize:'13px'}} formatter={(v: any) => [`${v}%`, 'Coverage']} />
              <Line type="monotone" dataKey="coverage" stroke="#4f6eff" strokeWidth={2.5} dot={{fill:'#4f6eff',r:5}} activeDot={{r:7}} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Summary stats */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-ink mb-4">Quick Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Open Shifts', value: analytics.openShifts, note: 'Need assignment', color: 'text-amber-500' },
              { label: 'Active Right Now', value: analytics.activeNow, note: 'Clocked in', color: 'text-green-500' },
              { label: 'Shifts This Week', value: analytics.shiftsThisWeek, note: 'Scheduled', color: 'text-brand-500' },
            ].map(item => (
              <div key={item.label} className="text-center p-4 rounded-xl bg-surface-50">
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-sm font-medium text-ink mt-1">{item.label}</p>
                <p className="text-xs text-ink-tertiary">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
