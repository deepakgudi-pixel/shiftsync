'use client'
import { Plus, Trash2, User, Megaphone } from 'lucide-react'
import { cn, fmtRelative } from '@/lib/utils'
import type { DashboardAnnouncement, Member } from '@/features/dashboard/hooks/useDashboard'

type AnnouncementsProps = {
  announcements: DashboardAnnouncement[]
  member: Member | null
  onDelete: (id: string) => void
  onCreatePost: () => void
}

export function Announcements({ announcements, member, onDelete, onCreatePost }: AnnouncementsProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card lg:col-span-3">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
            <Megaphone size={16} />
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">
              Announcements
            </h2>
            <p className="mt-1 text-[10px] font-medium text-zinc-400">Org-wide updates and role-targeted notes</p>
          </div>
        </div>
        {member?.role === 'ADMIN' && (
          <button
            onClick={onCreatePost}
            className="flex items-center gap-1.5 rounded-md bg-black px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white transition-colors hover:bg-zinc-800"
          >
            <Plus size={12} /> Create
          </button>
        )}
      </div>

      {announcements.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            No active announcements
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {announcements.slice(0, 6).map((a) => (
          <div
            key={a.id}
            className="group relative rounded-lg border border-zinc-100 bg-zinc-50 p-4 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-sm"
          >
            {member?.role === 'ADMIN' && (
              <button
                onClick={() => onDelete(a.id)}
                className="absolute right-2 top-2 rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-black group-hover:opacity-100"
                aria-label={`Delete announcement ${a.title}`}
              >
                <Trash2 size={14} />
              </button>
            )}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[11px] font-bold text-black uppercase tracking-widest leading-tight">{a.title}</p>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[8px] font-black uppercase',
                  a.priority === 'URGENT'
                    ? 'bg-red-600 text-white'
                    : a.priority === 'HIGH'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-white text-zinc-400 border border-zinc-100'
                )}
              >
                {a.priority}
              </span>
            </div>
            {a.target_name && (
              <div className="flex items-center gap-1 text-[10px] text-brand-600 font-bold uppercase mb-2">
                <User size={10} /> To: {a.target_name}
              </div>
            )}
            <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2 mb-3">{a.content}</p>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
              {fmtRelative(a.created_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
