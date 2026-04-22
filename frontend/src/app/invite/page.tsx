'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { Copy, Check, Users, Building2, Share2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const api = useApi()
  const router = useRouter()
  const [org, setOrg] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [me, orgData] = await Promise.all([
          api.get('/api/members/me'),
          api.get('/api/organisations/me'),
        ])
        setMember(me.data)
        setOrg(orgData.data)
      } catch (err: any) {
        if (err.response?.status === 404) router.push('/onboarding')
      }
    }
    load()
  }, [api, router])

  const copy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(null), 2000)
  }

  const onboardingLink = `${window.location.origin}/onboarding`

  if (!org || !member) return (
    <div className="p-8 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Initialising registry...</div>
  )

  return (
    <div className="p-5 md:p-8 max-w-[800px] mx-auto min-h-screen">
      <div className="mb-10 border-b border-zinc-200 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-black tracking-tight mb-2">
          Invite
        </h1>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">Manage your organisation and invite team members</p>
      </div>

      {/* Organisation Info */}
      <div className="bg-white border border-zinc-200 p-6 md:p-8 rounded-none shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-black" />
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em] border-l-2 border-black pl-3">
              Organisation
            </h2>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{org.member_count} members registered</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">
              Organisation Name
            </label>
            <div className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2 text-sm text-black font-bold uppercase tracking-widest cursor-default">
              {org.name}
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">
              Organisation Registry ID
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-zinc-50 border border-zinc-200 px-4 py-2 text-xs font-mono text-zinc-500 truncate min-w-0 cursor-default uppercase tracking-widest">
                {org.id}
              </div>
              <button
                onClick={() => copy(org.id, 'orgId')}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-2 border border-zinc-200 bg-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all active:scale-95"
              >
                {copied === 'orgId' ? <Check size={14} className="text-black" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copied === 'orgId' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mt-3 font-bold uppercase tracking-widest leading-relaxed">
              Share this ID with team members so they can join your organisation.
            </p>
          </div>
        </div>
      </div>

     
      {/* My Profile */}
      <div className="bg-white border border-zinc-200 p-6 md:p-8 rounded-none shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-black" />
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-black uppercase tracking-[0.2em] border-l-2 border-black pl-3">
              Personal Profile
            </h2>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">System clearance: {member.role}</p>
          </div>
        </div>

        <div className="space-y-1">
          {[
            { label: 'Name', value: member.name },
            { label: 'Email', value: member.email },
            { label: 'Role', value: member.role },
            { label: 'Registered', value: new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase() },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 border-b border-zinc-100 last:border-0 gap-2">
              <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">{label}</span>
              <span className="text-[11px] font-black text-black uppercase tracking-widest truncate">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}