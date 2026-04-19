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
  active_shifts: number; avatar_url?: string; can_manage_rates: boolean
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

  const toggleManagerRates = async () => {
    try {
      const newValue = !me.allow_manager_rates
      await api.patch('/api/members/organisation/settings', { allow_manager_rates: newValue })
      setMe({ ...me, allow_manager_rates: newValue })
      toast.success(newValue ? 'Managers can now edit rates' : 'Managers restricted from editing rates')
    } catch { toast.error('Failed to update settings') }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen">
      <div className="flex items-center justify-between mb-10">
        <div className="animate-in fade-in slide-in-from-left duration-500">
          <h1 className="text-2xl font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>Team</h1>
          <p className="text-sm text-ink-tertiary mt-0.5">{members.length} members in your organisation</p>
        </div>
      </div>

      {me?.role === 'ADMIN' && (
        <div className="mb-10 p-6 rounded-[2rem] bg-gradient-to-r from-brand-500/5 to-transparent border border-brand-500/10 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3 text-brand-900">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20"><UserPlus size={18} /></div>
            <p className="text-sm font-semibold tracking-tight">Allow managers to set employee hourly rates</p>
          </div>
          <button onClick={toggleManagerRates} className={cn('relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-brand-500', me.allow_manager_rates ? 'bg-brand-500' : 'bg-surface-300')}>
            <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md', me.allow_manager_rates ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(m => (
          <div key={m.id} className="group bg-white rounded-[2rem] p-6 border border-surface-200/60 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-500">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-base flex-shrink-0 border border-brand-100 group-hover:scale-105 transition-transform">
                {getInitials(m.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-ink text-[0.95rem] tracking-tight truncate">{m.name}</h3>
                <p className="text-xs text-ink-tertiary truncate">{m.email}</p>
              </div>
              <span className={cn('badge py-1 px-3 text-[10px] font-bold uppercase tracking-wider', ROLE_COLORS[m.role])}>{m.role}</span>
            </div>

            <div className="space-y-3 text-xs text-ink-secondary mb-5">
              {m.phone && (
                <div className="flex items-center gap-2"><Phone size={13} className="text-ink-disabled" />{m.phone}</div>
              )}
              {m.active_shifts > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {m.active_shifts} active shift{m.active_shifts > 1 ? 's' : ''}
                </div>
              )}
              {(me?.role === 'ADMIN' || m.id === me?.id || (me?.role === 'MANAGER' && m.role === 'EMPLOYEE')) && m.hourly_rate && <div className="font-bold text-ink text-sm tracking-tight">${m.hourly_rate} / <span className="text-ink-tertiary font-medium">hour</span></div>}
            </div>

            {m.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {m.skills.slice(0,3).map((s, i) => (
                  <span key={i} className="badge bg-surface-100 text-ink-tertiary">{s}</span>
                ))}
                {m.skills.length > 3 && <span className="badge bg-surface-100 text-ink-disabled">+{m.skills.length-3}</span>}
              </div>
            )}

            {(me?.role === 'ADMIN' || (me?.role === 'MANAGER' && m.role === 'EMPLOYEE' && me?.can_manage_rates)) && m.id !== me.id && (
              <div className="flex gap-2">
                {me?.role === 'ADMIN' ? (
                  <select className="input text-xs py-1.5 flex-1" value={m.role} onChange={e => updateMember(m.id, { role: e.target.value })}>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <div className="flex-1 px-3 py-1.5 text-xs font-medium bg-surface-50 rounded-lg text-ink-secondary border border-surface-200 flex items-center">
                    {m.role}
                  </div>
                )}
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

            {me?.role === 'ADMIN' && m.role === 'MANAGER' && (
              <div className="mt-3 pt-3 border-t border-surface-100 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-ink-tertiary">Rate Management</span>
                <button 
                  onClick={() => updateMember(m.id, { can_manage_rates: !m.can_manage_rates })}
                  className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', m.can_manage_rates ? 'bg-brand-500' : 'bg-surface-300')}
                >
                  <span className={cn('inline-block h-3 w-3 transform rounded-full bg-white transition-transform', m.can_manage_rates ? 'translate-x-5' : 'translate-x-1')} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
