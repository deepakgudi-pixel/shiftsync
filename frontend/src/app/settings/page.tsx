'use client'
import { useEffect, useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { Copy, Check, Users, Link, Building2, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const api = useApi()
  const [org, setOrg] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [me, orgData] = await Promise.all([
        api.get('/api/members/me'),
        api.get('/api/organisations/me'),
      ])
      setMember(me.data)
      setOrg(orgData.data)
    }
    load()
  }, [])

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
    <div className="p-6 max-w-[700px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-bricolage)' }}>
          Settings
        </h1>
        <p className="text-sm text-ink-tertiary mt-0.5">Manage your organisation and invite team members</p>
      </div>

      {/* Organisation Info */}
      <div className="card p-6 mb-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Building2 size={18} className="text-brand-500" />
          </div>
          <div>
            <h2 className="font-semibold text-ink" style={{ fontFamily: 'var(--font-bricolage)' }}>
              Organisation
            </h2>
            <p className="text-xs text-ink-tertiary">{org.member_count} members</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-tertiary uppercase tracking-wide block mb-1.5">
              Organisation Name
            </label>
            <div className="input bg-surface-50 text-ink font-medium cursor-default">
              {org.name}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-tertiary uppercase tracking-wide block mb-1.5">
              Organisation ID
            </label>
            <div className="flex gap-2">
              <div className="input bg-surface-50 text-ink-secondary font-mono text-sm flex-1 truncate cursor-default">
                {org.id}
              </div>
              <button
                onClick={() => copy(org.id, 'orgId')}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-100 text-sm font-medium text-ink transition-all active:scale-95"
              >
                {copied === 'orgId' ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                {copied === 'orgId' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-ink-tertiary mt-1.5">
              Share this ID with team members so they can join your organisation
            </p>
          </div>
        </div>
      </div>

      {/* Invite Section */}
      {member.role === 'ADMIN' && (
        <div className="card p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Users size={18} className="text-purple-500" />
            </div>
            <div>
              <h2 className="font-semibold text-ink" style={{ fontFamily: 'var(--font-bricolage)' }}>
                Invite Team Members
              </h2>
              <p className="text-xs text-ink-tertiary">Share these details with your team</p>
            </div>
          </div>

          {/* Invite card — shareable */}
          <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-5 mb-4">
            <p className="text-sm font-semibold text-brand-700 mb-3">📋 Share this with your team:</p>
            <div className="bg-white rounded-lg p-4 text-sm text-ink-secondary space-y-1.5 font-mono border border-brand-100">
              <p>1. Go to: <span className="text-brand-600 font-semibold">{onboardingLink}</span></p>
              <p>2. Sign up and choose <span className="font-semibold text-ink">"Join Existing"</span></p>
              <p>3. Enter Organisation ID:</p>
              <p className="text-brand-700 font-bold text-base pl-4">{org.id}</p>
            </div>
          </div>

          {/* Copy buttons */}
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => copy(
                `Join my organisation on ShiftSync!\n\n1. Go to: ${onboardingLink}\n2. Sign up and choose "Join Existing"\n3. Enter Organisation ID: ${org.id}`,
                'invite'
              )}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-brand-500 text-white font-medium text-sm hover:bg-brand-600 active:scale-95 transition-all shadow-brand"
            >
              {copied === 'invite' ? <Check size={16} /> : <Share2 size={16} />}
              {copied === 'invite' ? 'Invite message copied!' : 'Copy Full Invite Message'}
            </button>

            <button
              onClick={() => copy(org.id, 'orgId2')}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-ink font-medium text-sm hover:bg-surface-100 active:scale-95 transition-all"
            >
              {copied === 'orgId2' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied === 'orgId2' ? 'Copied!' : 'Copy Organisation ID Only'}
            </button>
          </div>
        </div>
      )}

      {/* My Profile */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Users size={18} className="text-green-500" />
          </div>
          <div>
            <h2 className="font-semibold text-ink" style={{ fontFamily: 'var(--font-bricolage)' }}>
              My Profile
            </h2>
            <p className="text-xs text-ink-tertiary">{member.role}</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Name', value: member.name },
            { label: 'Email', value: member.email },
            { label: 'Role', value: member.role },
            { label: 'Member since', value: new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-surface-100 last:border-0">
              <span className="text-sm text-ink-tertiary">{label}</span>
              <span className="text-sm font-medium text-ink">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}