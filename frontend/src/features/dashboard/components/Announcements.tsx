'use client'
import { Plus, Trash2, User } from 'lucide-react'
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
    <div className="bg-white border border-zinc-200 p-5 lg:col-span-3 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em] border-l-2 border-black pl-3">
          Announcements
        </h2>
        {member?.role === 'ADMIN' && (
          <button
            onClick={onCreatePost}
            className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors"
          >
            <Plus size={12} className="inline mr-1" /> Create Post
          </button>
        )}
      </div>

      {announcements.length === 0 && (
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          No active announcements
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {announcements.slice(0, 6).map((a) => (
          <div
            key={a.id}
            className="p-4 border border-zinc-100 bg-zinc-50 relative group hover:border-zinc-300 transition-all"
          >
            {member?.role === 'ADMIN' && (
              <button
                onClick={() => onDelete(a.id)}
                className="absolute top-2 right-2 p-1 text-zinc-300 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            )}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[11px] font-bold text-black uppercase tracking-widest leading-tight">{a.title}</p>
              <span
                className={cn(
                  'text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter',
                  a.priority === 'URGENT'
                    ? 'bg-black text-white'
                    : a.priority === 'HIGH'
                      ? 'bg-zinc-200 text-black'
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
