'use client'
import { X } from 'lucide-react'
import type { Member, DashboardShift, SwapForm } from '@/features/dashboard/hooks/useDashboard'

type SwapModalProps = {
  selectedShift: DashboardShift | null
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  form: SwapForm
  onFormChange: (form: SwapForm) => void
  team: Member[]
  currentMemberId?: string
}

export function SwapModal({
  selectedShift,
  onClose,
  onSubmit,
  form,
  onFormChange,
  team,
  currentMemberId,
}: SwapModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-modal-title"
        className="bg-white border border-zinc-200 w-full max-w-md animate-slide-up relative shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <div>
            <h2 id="swap-modal-title" className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">
              Request Shift Swap
            </h2>
            <p className="text-[9px] text-zinc-400 uppercase tracking-widest mt-1">{selectedShift?.title}</p>
          </div>
          <button
            aria-label="Close swap request form"
            onClick={onClose}
            className="text-zinc-400 hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label
              htmlFor="swap-colleague"
              className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2"
            >
              Colleague (Optional)
            </label>
            <select
              id="swap-colleague"
              className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors appearance-none"
              value={form.targetId}
              onChange={(e) => onFormChange({ ...form, targetId: e.target.value })}
            >
              <option value="">Open Pool (Assign to anyone)</option>
              {team
                .filter((t) => t.id !== currentMemberId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.role})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="swap-reason"
              className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2"
            >
              Reason for Request
            </label>
            <textarea
              id="swap-reason"
              className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors min-h-[80px]"
              placeholder="Explain why you need a swap..."
              value={form.reason}
              onChange={(e) => onFormChange({ ...form, reason: e.target.value })}
              required
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 bg-black text-white font-black uppercase tracking-[0.3em] text-[10px] hover:bg-zinc-800 transition-colors"
            >
              SUBMIT SWAP REQUEST
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
