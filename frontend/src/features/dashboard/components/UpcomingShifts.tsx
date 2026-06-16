'use client'
import { ArrowRightLeft, CalendarClock } from 'lucide-react'
import { cn, fmtDateTime } from '@/lib/utils'
import type { DashboardShift, Member } from '@/features/dashboard/hooks/useDashboard'

type UpcomingShiftsProps = {
  shifts: DashboardShift[]
  member: Member | null
  onRequestSwap: (shift: DashboardShift) => void
}

export function UpcomingShifts({ shifts, member, onRequestSwap }: UpcomingShiftsProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card lg:col-span-1">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">
            {member?.role === 'EMPLOYEE' ? 'My Upcoming Shifts' : 'Upcoming Shifts'}
          </h2>
          <p className="mt-1 text-[10px] font-medium text-zinc-400">Next scheduled work blocks</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
          <CalendarClock size={16} />
        </div>
      </div>
      <div className="space-y-3">
        {shifts.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              No upcoming shifts
            </p>
          </div>
        )}
        {shifts.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-black truncate uppercase tracking-widest">{s.title}</p>
                <p className="text-[9px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">
                  {fmtDateTime(s.start_time)}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase',
                  s.status === 'ASSIGNED'
                    ? 'bg-blue-50 text-blue-700'
                    : s.status === 'IN_PROGRESS'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-100 text-zinc-400'
                )}
              >
                {s.status.replace('_', ' ')}
              </span>
            </div>

            {member?.id === s.assignee_id && s.status === 'ASSIGNED' && (
              <button
                onClick={() => onRequestSwap(s)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-black shadow-sm transition-all hover:border-black hover:bg-black hover:text-white"
              >
                <ArrowRightLeft size={12} />
                Request Swap
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
