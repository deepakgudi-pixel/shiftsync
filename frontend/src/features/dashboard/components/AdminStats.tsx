'use client'
import { Users, Calendar, AlertCircle, Activity } from 'lucide-react'
import type { DashboardAnalytics } from '@/features/dashboard/hooks/useDashboard'

type StatCardProps = {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}

const StatCard = ({ icon: Icon, label, value, sub }: StatCardProps) => (
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
  <div className={`bg-surface-100 animate-pulse rounded-2xl ${className}`} />
)

type AdminStatsProps = {
  analytics: DashboardAnalytics | null
  loading: boolean
}

export function AdminStats({ analytics, loading }: AdminStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
      {loading
        ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)
        : (
            <>
              <StatCard icon={Users} label="Total Members" value={analytics?.totalMembers} />
              <StatCard icon={Calendar} label="Active Shifts" value={analytics?.shiftsThisWeek} />
              <StatCard icon={AlertCircle} label="Open Slots" value={analytics?.openShifts} sub="Critical" />
              <StatCard icon={Activity} label="Live Now" value={analytics?.activeNow} />
            </>
          )}
    </div>
  )
}
