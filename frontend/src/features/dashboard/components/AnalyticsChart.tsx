'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { DashboardAnalytics } from '@/features/dashboard/hooks/useDashboard'

type AnalyticsChartProps = {
  analytics: DashboardAnalytics | null
  loading: boolean
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`rounded-lg bg-surface-100 animate-pulse ${className}`} />
)

export function AnalyticsChart({ analytics, loading }: AnalyticsChartProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-card lg:col-span-2 md:p-8">
      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold uppercase tracking-[0.16em] text-black">Workforce Velocity</h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Recent shift distribution and completion flow
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live Ops
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
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 12px 32px rgba(13,13,26,0.08)',
                  }}
                />
                <Bar dataKey="total" fill="#e4e4e7" radius={[6, 6, 0, 0]} name="Total" />
                <Bar dataKey="completed" fill="#18181b" radius={[6, 6, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
