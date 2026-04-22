'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
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
      } catch (err: any) {
        if (err.response?.status === 404) router.push('/onboarding')
        else console.error('Error loading team:', err)
      }
    }
    load()
  }, [isLoaded, isSignedIn, api, router])

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
    <div className="p-5 md:p-8 max-w-[1400px] mx-auto min-h-screen">
      <div className="mb-10 border-b border-zinc-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">Team</h1>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">{members.length} active members</p>
        </div>
      </div>

      {me?.role === 'ADMIN' && (
        <div className="mb-10 p-6 bg-white border border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black flex items-center justify-center text-white"><UserPlus size={18} /></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black">Allow managers to set employee hourly rates</p>
          </div>
          <button onClick={toggleManagerRates} className={cn('relative inline-flex h-6 w-11 items-center rounded-none transition-all duration-300', me.allow_manager_rates ? 'bg-black' : 'bg-zinc-200')}>
            <span className={cn('inline-block h-4 w-4 transform bg-white transition-transform', me.allow_manager_rates ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1 md:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="w-full bg-white border border-zinc-200 pl-9 pr-4 py-2 text-sm text-black focus:border-black outline-none transition-colors" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-zinc-100 p-1 gap-1 overflow-x-auto no-scrollbar">
          {['ALL','ADMIN','MANAGER','EMPLOYEE'].map(r => (
            <button key={r} onClick={() => setFilter(r)}
              className={cn('px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all', filter === r ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-700')}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(m => (
          <div key={m.id} className="group bg-white p-6 border border-zinc-200 shadow-sm hover:border-zinc-300 transition-all duration-300">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-zinc-50 border border-zinc-100 flex items-center justify-center text-black font-bold text-base flex-shrink-0 group-hover:bg-zinc-100 transition-colors">
                {getInitials(m.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-black text-[13px] uppercase tracking-widest truncate">{m.name}</h3>
                <p className="text-[11px] text-zinc-400 truncate font-medium">{m.email}</p>
              </div>
              <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 tracking-tighter', m.role === 'ADMIN' ? 'bg-black text-white' : m.role === 'MANAGER' ? 'bg-zinc-200 text-black' : 'bg-zinc-100 text-zinc-500')}>
                {m.role}
              </span>
            </div>

            <div className="space-y-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-5">
              {m.phone && (
                <div className="flex items-center gap-2"><Phone size={13} className="text-zinc-300" />{m.phone}</div>
              )}
              {m.active_shifts > 0 && (
                <div className="flex items-center gap-2 text-emerald-600">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {m.active_shifts} active shift{m.active_shifts > 1 ? 's' : ''}
                </div>
              )}
              {(me?.role === 'ADMIN' || m.id === me?.id || (me?.role === 'MANAGER' && m.role === 'EMPLOYEE')) && m.hourly_rate && (
                <div className="font-bold text-black text-sm tracking-tight">${m.hourly_rate} / <span className="text-zinc-400 font-medium text-[10px]">HOUR</span></div>
              )}
            </div>

            {m.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {m.skills.slice(0,3).map((s, i) => (
                  <span key={i} className="px-2 py-0.5 bg-zinc-50 text-zinc-400 border border-zinc-100 text-[9px] font-bold uppercase tracking-tighter">{s}</span>
                ))}
                {m.skills.length > 3 && <span className="px-2 py-0.5 bg-white text-zinc-300 border border-zinc-100 text-[9px] font-bold uppercase tracking-tighter">+{m.skills.length-3}</span>}
              </div>
            )}

            {(me?.role === 'ADMIN' || (me?.role === 'MANAGER' && m.role === 'EMPLOYEE' && me?.can_manage_rates)) && m.id !== me.id && (
              <div className="flex gap-2 pt-4 border-t border-zinc-100">
                {me?.role === 'ADMIN' ? (
                  <select className="flex-1 bg-zinc-50 border border-zinc-200 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black focus:border-black outline-none appearance-none" value={m.role} onChange={e => updateMember(m.id, { role: e.target.value })}>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <div className="flex-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-zinc-50 text-zinc-500 border border-zinc-200">
                    {m.role}
                  </div>
                )}
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] font-bold">$</span>
                  <input 
                    type="number" 
                    className="w-full bg-zinc-50 border border-zinc-200 py-1.5 pl-5 pr-2 text-[10px] font-bold text-black focus:border-black outline-none" 
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
              <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400">Rate Management</span>
                <button 
                  onClick={() => updateMember(m.id, { can_manage_rates: !m.can_manage_rates })}
                  className={cn('relative inline-flex h-5 w-9 items-center rounded-none transition-colors', m.can_manage_rates ? 'bg-black' : 'bg-zinc-200')}
                >
                  <span className={cn('inline-block h-3 w-3 transform bg-white transition-transform', m.can_manage_rates ? 'translate-x-5' : 'translate-x-1')} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
