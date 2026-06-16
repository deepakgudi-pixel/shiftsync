'use client'
import { Users, Calendar, AlertCircle, Activity, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardAnalytics } from '@/features/dashboard/hooks/useDashboard'

type StatCardProps = {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  tone: 'blue' | 'green' | 'amber' | 'zinc'
}

const toneStyles = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  zinc: 'bg-zinc-100 text-zinc-900 border-zinc-200',
}

const StatCard = ({ icon: Icon, label, value, sub, tone }: StatCardProps) => (
  <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-md border', toneStyles[tone])}>
        <Icon size={17} />
      </div>
      <TrendingUp size={14} className="mt-1 text-zinc-300" />
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold text-black">{value ?? 0}</p>
        {sub && <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{sub}</p>}
      </div>
    </div>
  </div>
)

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`rounded-lg bg-surface-100 animate-pulse ${className}`} />
)

type AdminStatsProps = {
  analytics: DashboardAnalytics | null
  loading: boolean
}

export function AdminStats({ analytics, loading }: AdminStatsProps) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {loading
        ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)
        : (
            <>
              <StatCard icon={Users} label="Total Members" value={analytics?.totalMembers} tone="blue" />
              <StatCard icon={Calendar} label="Active Shifts" value={analytics?.shiftsThisWeek} tone="green" />
              <StatCard icon={AlertCircle} label="Open Slots" value={analytics?.openShifts} sub="Critical" tone="amber" />
              <StatCard icon={Activity} label="Live Now" value={analytics?.activeNow} tone="zinc" />
            </>
          )}
    </div>
  )
}
