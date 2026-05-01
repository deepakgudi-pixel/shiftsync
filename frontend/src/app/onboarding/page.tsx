'use client'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const checkOnboarded = async () => {
      try {
        await api.get('/api/members/me')
        router.push('/dashboard')
      } catch (err) {
        // Not onboarded, stay here
      }
    }
    if (user) checkOnboarded()
  }, [user, api, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const trimmedOrgName = orgName.trim()
    const trimmedOrgId = orgId.trim()

    if (mode === 'create' && !trimmedOrgName) {
      toast.error('Organisation name is required')
      return
    }
    if (mode === 'join' && !trimmedOrgId) {
      toast.error('Organisation ID is required')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/members/onboard', {
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName || 'User',
        ...(mode === 'create' ? { organisationName: trimmedOrgName } : { organisationId: trimmedOrgId }),
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
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Futuristic Background Grid */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-none p-8 w-full max-w-md animate-slide-up relative z-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-white flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="8" width="10" height="4" fill="black"/>
              <rect x="2" y="16" width="16" height="4" fill="black" fillOpacity="0.7"/>
              <rect x="16" y="8" width="10" height="12" fill="black" fillOpacity="0.5"/>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-white text-sm uppercase tracking-widest">Welcome to ShiftSync</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-0.5">Set up your workspace</p>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 mb-8">
          {(['create', 'join'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-white text-black' : 'text-white/40 hover:text-white/60'}`}>
              {m === 'create' ? 'Create Organisation' : 'Join Existing'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'create' ? (
            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block mb-2">Organisation Name</label>
              <input className="w-full bg-white/[0.03] border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 transition-all" placeholder="e.g. Acme Retail Corp" value={orgName} onChange={e => setOrgName(e.target.value)} required />
            </div>
          ) : (
            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block mb-2">Organisation ID</label>
              <input className="w-full bg-white/[0.03] border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 transition-all font-mono" placeholder="ID from admin settings" value={orgId} onChange={e => setOrgId(e.target.value)} required />
              <p className="text-[10px] text-white/20 mt-3 leading-relaxed">Ask your admin for the organisation ID from their settings page.</p>
            </div>
          )}
          <button type="submit" className="w-full h-12 bg-white text-black font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 active:scale-95 transition-all mt-4 disabled:opacity-60 disabled:cursor-not-allowed" disabled={loading}>
            {loading ? 'Setting up...' : mode === 'create' ? 'Create & Continue' : 'Join & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
