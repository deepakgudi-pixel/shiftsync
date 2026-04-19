'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'

import { Search, UserPlus, MoreHorizontal, Mail, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApi } from '@/hooks/useApi'
import { cn, getInitials, ROLE_COLORS,  } from '@/lib/utils'

interface Member {
  id: string; name: string; email: string; role: string
  phone?: string; skills: string[]; hourly_rate?: number
  active_shifts: number; avatar_url?: string
}

export default function TeamPage() {
  const { isLoaded, isSignedIn } = useUser()
  const api = useApi()
  const [members, setMembers] = useState<Member[]>([])
  const [me, setMe] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const load = async () => {
      try {
        const [mem, me] = await Promise.all([api.get('/api/members'), api.get('/api/members/me')])
        setMembers(mem.data)
        setMe(me.data)
      } catch (err) {
        console.error('Error loading team:', err)
      }
    }
    load()
  }, [isLoaded, isSignedIn, api])

  const filtered = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = filter === 'ALL' || m.role === filter
    return matchSearch && matchRole
  })

  const updateMember = async (memberId: string, updates: Partial<Member>) => {
    try {
      const res = await api.patch(`/api/members/${memberId}`, updates)
      setMembers(p => p.map(m => m.id === memberId ? { ...m, ...res.data } : m))
      toast.success('Member updated')
    } catch { toast.error('Failed to update member') }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Team</h1>
          <p className="text-sm text-ink-tertiary mt-0.5">{members.length} members in your organisation</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-disabled" />
          <input className="input pl-9" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-xl bg-surface-100 p-1 gap-0.5">
          {['ALL','ADMIN','MANAGER','EMPLOYEE'].map(r => (
            <button key={r} onClick={() => setFilter(r)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', filter === r ? 'bg-white shadow-sm text-ink' : 'text-ink-secondary hover:text-ink')}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(m => (
          <div key={m.id} className="card p-5 hover:shadow-card-hover transition-all duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm flex-shrink-0">
                {getInitials(m.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-ink text-sm truncate">{m.name}</h3>
                <p className="text-xs text-ink-tertiary truncate">{m.email}</p>
              </div>
              <span className={cn('badge', ROLE_COLORS[m.role])}>{m.role}</span>
            </div>

            <div className="space-y-2 text-xs text-ink-secondary mb-4">
              {m.phone && (
                <div className="flex items-center gap-2"><Phone size={13} className="text-ink-disabled" />{m.phone}</div>
              )}
              {m.active_shifts > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {m.active_shifts} active shift{m.active_shifts > 1 ? 's' : ''}
                </div>
              )}
              {(me?.role === 'ADMIN' || m.id === me?.id) && m.hourly_rate && <div>${m.hourly_rate}/hr</div>}
            </div>

            {m.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {m.skills.slice(0,3).map((s, i) => (
                  <span key={i} className="badge bg-surface-100 text-ink-tertiary">{s}</span>
                ))}
                {m.skills.length > 3 && <span className="badge bg-surface-100 text-ink-disabled">+{m.skills.length-3}</span>}
              </div>
            )}

            {me?.role === 'ADMIN' && m.id !== me.id && (
              <div className="flex gap-2">
                <select className="input text-xs py-1.5 flex-1" value={m.role} onChange={e => updateMember(m.id, { role: e.target.value })}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-tertiary text-[10px]">$</span>
                  <input 
                    type="number" 
                    className="input text-xs py-1.5 pl-5" 
                    placeholder="Rate"
                    defaultValue={m.hourly_rate}
                    onBlur={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val !== m.hourly_rate) updateMember(m.id, { hourly_rate: val });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
