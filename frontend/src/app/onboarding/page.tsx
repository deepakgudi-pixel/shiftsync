'use client'
import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useApi } from '@/hooks/useApi'
import toast from 'react-hot-toast'

export default function OnboardingPage() {
  const { user } = useUser()
  const router = useRouter()
  const api = useApi()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      await api.post('/api/members/onboard', {
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName || 'User',
        ...(mode === 'create' ? { organisationName: orgName } : { organisationId: orgId }),
      })
      toast.success(mode === 'create' ? 'Organisation created!' : 'Joined organisation!')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-purple-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="8" width="10" height="4" rx="2" fill="white"/>
              <rect x="2" y="16" width="16" height="4" rx="2" fill="white" fillOpacity="0.7"/>
              <rect x="16" y="8" width="10" height="12" rx="2" fill="white" fillOpacity="0.5"/>
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-ink" style={{fontFamily: 'var(--font-bricolage)'}}>Welcome to ShiftSync</h1>
            <p className="text-sm text-ink-tertiary">Set up your workspace</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-surface-100 p-1 mb-6">
          {(['create', 'join'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-white shadow-sm text-ink' : 'text-ink-secondary'}`}>
              {m === 'create' ? 'Create Organisation' : 'Join Existing'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' ? (
            <div>
              <label className="text-sm font-medium text-ink-secondary block mb-1.5">Organisation Name</label>
              <input className="input" placeholder="e.g. Acme Retail Corp" value={orgName} onChange={e => setOrgName(e.target.value)} required />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-ink-secondary block mb-1.5">Organisation ID</label>
              <input className="input" placeholder="Paste the ID from your admin" value={orgId} onChange={e => setOrgId(e.target.value)} required />
              <p className="text-xs text-ink-tertiary mt-1">Ask your admin for the organisation ID from their settings page</p>
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Setting up...' : mode === 'create' ? 'Create & Continue' : 'Join & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
