'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { Copy, Check, Users, Link, Building2, Share2 } from 'lucide-react'
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
    <div className="p-6 text-ink-tertiary text-sm">Loading...</div>
  )

  return (
    <div className="p-4 md:p-8 max-w-[700px] mx-auto">
      <div className="mb-6 md:mb-8 animate-in fade-in slide-in-from-left duration-500">
        <h1 className="text-xl md:text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-bricolage)' }}>
          Settings
        </h1>
        <p className="text-xs md:text-sm text-ink-tertiary mt-1 font-medium">Manage your organisation and invite team members</p>
      </div>

      {/* Organisation Info */}
      <div className="card p-4 md:p-6 mb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-brand-500" />
          </div>
          <div>
            <h2 className="font-bold text-ink text-sm md:text-base" style={{ fontFamily: 'var(--font-bricolage)' }}>
              Organisation
            </h2>
            <p className="text-xs text-ink-tertiary">{org.member_count} members</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-ink-disabled uppercase tracking-widest block mb-1.5">
              Organisation Name
            </label>
            <div className="input bg-surface-50 text-ink font-semibold text-sm cursor-default">
              {org.name}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-ink-disabled uppercase tracking-widest block mb-1.5">
              Organisation ID
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-50 border border-surface-200 rounded-xl px-3 py-2.5 text-xs font-mono text-ink-secondary truncate min-w-0 cursor-default">
                {org.id}
              </div>
              <button
                onClick={() => copy(org.id, 'orgId')}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-xs md:text-sm font-bold text-ink transition-all active:scale-95"
              >
                {copied === 'orgId' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                <span className="hidden sm:inline">{copied === 'orgId' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[10px] md:text-xs text-ink-tertiary mt-2 font-medium">
              Share this ID with team members so they can join your organisation
            </p>
          </div>
        </div>
      </div>

      {/* Invite Section */}
      {member.role === 'ADMIN' && (
        <div className="card p-4 md:p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-purple-500" />
            </div>
            <div>
              <h2 className="font-bold text-ink text-sm md:text-base" style={{ fontFamily: 'var(--font-bricolage)' }}>
                Invite Team Members
              </h2>
              <p className="text-xs text-ink-tertiary">Share these details with your team</p>
            </div>
          </div>

          {/* Invite card — shareable */}
          <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-4 md:p-5 mb-5">
            <p className="text-xs md:text-sm font-bold text-brand-700 mb-3 flex items-center gap-2">
              <Share2 size={14} /> Share with your team:
            </p>
            <div className="bg-white rounded-xl p-3 md:p-4 text-xs md:text-sm text-ink-secondary space-y-2 font-mono border border-brand-100/50 shadow-sm">
              <p className="leading-relaxed">1. Go to: <span className="text-brand-600 font-bold break-all">{onboardingLink}</span></p>
              <p className="leading-relaxed">2. Sign up and choose <span className="font-bold text-ink">"Join Existing"</span></p>
              <p className="leading-relaxed">3. Enter ID:</p>
              <p className="text-brand-700 font-bold text-sm md:text-base pl-3 border-l-2 border-brand-200 ml-1">{org.id}</p>
            </div>
          </div>

          {/* Copy buttons */}
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => copy(
                `Join my organisation on ShiftSync!\n\n1. Go to: ${onboardingLink}\n2. Sign up and choose "Join Existing"\n3. Enter Organisation ID: ${org.id}`,
                'invite'
              )}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-brand-500 text-white font-bold text-xs md:text-sm hover:bg-brand-600 active:scale-95 transition-all shadow-md shadow-brand-500/20"
            >
              {copied === 'invite' ? <Check size={16} /> : <Share2 size={16} />}
              {copied === 'invite' ? 'Invite message copied!' : 'Copy Full Invite Message'}
            </button>

            <button
              onClick={() => copy(org.id, 'orgId2')}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-ink font-bold text-xs md:text-sm hover:bg-surface-50 active:scale-95 transition-all"
            >
              {copied === 'orgId2' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied === 'orgId2' ? 'Copied!' : 'Copy Organisation ID Only'}
            </button>
          </div>
        </div>
      )}

      {/* My Profile */}
      <div className="card p-4 md:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-green-500" />
          </div>
          <div>
            <h2 className="font-bold text-ink text-sm md:text-base" style={{ fontFamily: 'var(--font-bricolage)' }}>
              My Profile
            </h2>
            <p className="text-xs text-ink-tertiary">{member.role}</p>
          </div>
        </div>

        <div className="space-y-1 md:space-y-3">
          {[
            { label: 'Name', value: member.name },
            { label: 'Email', value: member.email },
            { label: 'Role', value: member.role },
            { label: 'Member since', value: new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-2 border-b border-surface-100 last:border-0 gap-1 sm:gap-4">
              <span className="text-[10px] md:text-sm uppercase sm:normal-case tracking-widest sm:tracking-normal font-bold sm:font-normal text-ink-disabled sm:text-ink-tertiary">{label}</span>
              <span className="text-sm font-bold sm:font-medium text-ink break-all sm:break-normal">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}