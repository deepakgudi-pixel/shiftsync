'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { DashboardAnalytics } from '@/features/dashboard/hooks/useDashboard'

type AnalyticsChartProps = {
  analytics: DashboardAnalytics | null
  loading: boolean
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`bg-surface-100 animate-pulse rounded-2xl ${className}`} />
)

export function AnalyticsChart({ analytics, loading }: AnalyticsChartProps) {
  return (
    <div className="bg-white border border-zinc-200 p-6 md:p-10 rounded-none lg:col-span-2 shadow-sm">
      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-lg font-bold text-black uppercase tracking-widest">Workforce Velocity</h2>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                Recent shift distribution and completion flow
              </p>
            </div>
          </div>
          <div className="h-[240px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.shiftsByDay} barSize={36}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e4e4e7',
                    borderRadius: '0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="total" fill="#f4f4f5" radius={0} name="Total" />
                <Bar dataKey="completed" fill="#18181b" radius={0} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
