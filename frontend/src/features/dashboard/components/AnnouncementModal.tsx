'use client'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member, AnnouncementForm } from '@/features/dashboard/hooks/useDashboard'

type AnnouncementModalProps = {
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  form: AnnouncementForm
  onFormChange: (form: AnnouncementForm) => void
  team: Member[]
  currentMemberId?: string
}

export function AnnouncementModal({
  onClose,
  onSubmit,
  loading,
  form,
  onFormChange,
  team,
  currentMemberId,
}: AnnouncementModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ann-modal-title"
        className="bg-white border border-zinc-200 w-full max-w-md animate-slide-up relative shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <h2 id="ann-modal-title" className="text-[10px] font-bold text-black uppercase tracking-[0.2em]">
            New Announcement
          </h2>
          <button
            aria-label="Close announcement form"
            onClick={onClose}
            className="text-zinc-400 hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="ann-title" className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">
              Subject
            </label>
            <input
              id="ann-title"
              className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors"
              placeholder="Announcement title..."
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Priority</label>
            <div className="flex gap-2">
              {['NORMAL', 'HIGH', 'URGENT'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onFormChange({ ...form, priority: p })}
                  className={cn(
                    'flex-1 py-2 text-[9px] font-black uppercase tracking-widest border transition-all',
                    form.priority === p
                      ? 'bg-black text-white border-black'
                      : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-400'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Recipient</label>
            <select
              className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors appearance-none"
              value={form.targetMemberId}
              onChange={(e) => onFormChange({ ...form, targetMemberId: e.target.value })}
            >
              <option value="">Global (Everyone)</option>
              <optgroup label="Direct Message">
                {team
                  .filter((t) => t.id !== currentMemberId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] block mb-2">Content</label>
            <textarea
              className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black focus:border-black outline-none transition-colors min-h-[100px]"
              placeholder="Write message here..."
              value={form.content}
              onChange={(e) => onFormChange({ ...form, content: e.target.value })}
              required
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 bg-black text-white font-black uppercase tracking-[0.3em] text-[10px] hover:bg-zinc-800 transition-colors"
              disabled={loading}
            >
              {loading ? 'POSTING...' : 'POST ANNOUNCEMENT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
