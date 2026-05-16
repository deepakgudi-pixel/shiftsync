'use client'
import { ArrowRightLeft } from 'lucide-react'
import type { DashboardSwapRequest } from '@/features/dashboard/hooks/useDashboard'

type SwapRequestsProps = {
  swaps: DashboardSwapRequest[]
  loading: boolean
  onAction: (swapId: string, shiftId: string, status: string) => void
}

export function SwapRequests({ swaps, loading, onAction }: SwapRequestsProps) {
  if (swaps.length === 0 && !loading) return null

  return (
    <div className="bg-white border border-zinc-200 p-5 shadow-sm lg:col-span-3">
      <h2 className="text-[10px] font-bold text-black mb-6 uppercase tracking-[0.2em] border-l-2 border-black pl-3">
        Pending Swap Requests
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {swaps.map((sw) => (
          <div
            key={sw.id}
            className="p-4 bg-zinc-50 border border-zinc-100 group flex flex-col justify-between"
          >
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-black uppercase tracking-widest truncate max-w-[80px]">
                  {sw.requester_name}
                </span>
                <ArrowRightLeft size={10} className="text-zinc-400 flex-shrink-0" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[80px]">
                  {sw.target_name || 'Open Pool'}
                </span>
              </div>
              <p className="text-[11px] font-bold text-black uppercase tracking-widest">{sw.shift_title}</p>
              {sw.reason && (
                <p className="text-[9px] text-zinc-500 mt-2 line-clamp-2 italic leading-relaxed">
                  &quot;{sw.reason}&quot;
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 mt-auto">
              <button
                onClick={() => onAction(sw.id, sw.shift_id, 'APPROVED')}
                className="flex-1 py-2 bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
              >
                Approve
              </button>
              <button
                onClick={() => onAction(sw.id, sw.shift_id, 'REJECTED')}
                className="flex-1 py-2 border border-zinc-200 text-black text-[9px] font-bold uppercase tracking-widest hover:bg-zinc-50 transition-all"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
