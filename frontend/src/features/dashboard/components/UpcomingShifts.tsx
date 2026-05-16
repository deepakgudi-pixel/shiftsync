'use client'
import { ArrowRightLeft } from 'lucide-react'
import { cn, fmtDateTime } from '@/lib/utils'
import type { DashboardShift, Member } from '@/features/dashboard/hooks/useDashboard'

type UpcomingShiftsProps = {
  shifts: DashboardShift[]
  member: Member | null
  onRequestSwap: (shift: DashboardShift) => void
}

export function UpcomingShifts({ shifts, member, onRequestSwap }: UpcomingShiftsProps) {
  return (
    <div className="bg-white border border-zinc-200 p-5 shadow-sm lg:col-span-1">
      <h2 className="text-[10px] font-bold text-black mb-6 uppercase tracking-[0.2em] border-l-2 border-black pl-3">
        {member?.role === 'EMPLOYEE' ? 'My Upcoming Shifts' : 'Upcoming Shifts'}
      </h2>
      <div className="space-y-3">
        {shifts.length === 0 && (
          <p className="text-[10px] font-bold text-zinc-400 text-center py-6 uppercase tracking-widest">
            No upcoming shifts
          </p>
        )}
        {shifts.map((s) => (
          <div
            key={s.id}
            className="p-4 bg-zinc-50 border border-zinc-100 hover:border-zinc-300 transition-all flex flex-col gap-3"
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
                  'text-[9px] font-bold uppercase px-2 py-1 tracking-tighter shrink-0',
                  s.status === 'ASSIGNED'
                    ? 'text-black bg-zinc-200'
                    : s.status === 'IN_PROGRESS'
                      ? 'text-white bg-black'
                      : 'text-zinc-400 bg-zinc-100'
                )}
              >
                {s.status.replace('_', ' ')}
              </span>
            </div>

            {member?.id === s.assignee_id && s.status === 'ASSIGNED' && (
              <button
                onClick={() => onRequestSwap(s)}
                className="w-full py-2 bg-white border border-zinc-200 text-black text-[9px] font-bold uppercase tracking-[0.2em] hover:bg-black hover:text-white hover:border-black transition-all flex items-center justify-center gap-2 shadow-sm"
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
