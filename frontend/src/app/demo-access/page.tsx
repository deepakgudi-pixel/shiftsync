'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk, useSignIn, useUser } from '@clerk/nextjs'
import { ArrowRight } from 'lucide-react'

type DemoUser = {
  role: string
  name: string
  email: string
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'ADMIN': 'Full system access, org settings, audit logs',
  'MANAGER': 'Schedule team, approve swaps, run payroll',
  'EMPLOYEE': 'Clock in/out, request swaps, view payslips'
}

const getApiBase = () => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  if (configured) return configured

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000'
  }

  return ''
}

const PENDING_DEMO_EMAIL_KEY = 'shiftsync-demo-email'

const readJsonSafely = async (response: Response) => {
  const raw = await response.text()

  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    if (!response.ok) {
      throw new Error(
        raw.startsWith('<')
          ? 'Demo access is not configured on this deployment yet. Check the backend API URL and enable demo access on the backend.'
          : raw || 'Unexpected response from demo access endpoint'
      )
    }

    throw new Error('Unexpected non-JSON response from demo access endpoint')
  }
}

export default function DemoAccessPage() {
  const router = useRouter()
  const { signOut } = useClerk()
  const { isLoaded, signIn, setActive } = useSignIn()
  const { isSignedIn, user } = useUser()
  const apiBase = getApiBase()
  const [users, setUsers] = useState<DemoUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch(`${apiBase}/api/dev/demo-users`)
        const data = await readJsonSafely(response)

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load demo accounts')
        }

        setUsers(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load demo accounts')
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
  }, [apiBase])

  const activateDemoUser = useCallback((email: string) => {
    if (!isLoaded || !signIn || !setActive) return

    setPendingEmail(email)
    setError(null)

    setIsSubmitting(true)

    ;(async () => {
      try {
        const ticketResponse = await fetch(`${apiBase}/api/dev/demo-ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

        const ticketData = await readJsonSafely(ticketResponse)

        if (!ticketResponse.ok) {
          throw new Error(ticketData?.error || 'Failed to create demo access ticket')
        }

        const result = await signIn.create({
          strategy: 'ticket',
          ticket: ticketData.ticket,
        })

        if (result.status !== 'complete' || !result.createdSessionId) {
          throw new Error('Demo sign-in did not complete')
        }

        await setActive({ session: result.createdSessionId })
        window.sessionStorage.removeItem(PENDING_DEMO_EMAIL_KEY)
        window.location.replace('/dashboard')
      } catch (err: any) {
        setError(err?.errors?.[0]?.longMessage || err.message || 'Failed to sign in with demo account')
        setPendingEmail(null)
        setIsSubmitting(false)
      }
    })()
  }, [apiBase, isLoaded, router, setActive, signIn])

  useEffect(() => {
    const currentEmail = user?.primaryEmailAddress?.emailAddress
    if (!isSignedIn || !currentEmail) return

    const pendingDemoEmail = pendingEmail || window.sessionStorage.getItem(PENDING_DEMO_EMAIL_KEY)
    if (!pendingDemoEmail) return

    if (pendingDemoEmail === currentEmail) {
      window.sessionStorage.removeItem(PENDING_DEMO_EMAIL_KEY)
      window.location.replace('/dashboard')
    }
  }, [isSignedIn, pendingEmail, user])

  useEffect(() => {
    if (!isLoaded || !signIn || !setActive || isSignedIn) return

    const pendingEmail = window.sessionStorage.getItem(PENDING_DEMO_EMAIL_KEY)
    if (!pendingEmail) return

    window.sessionStorage.removeItem(PENDING_DEMO_EMAIL_KEY)
    activateDemoUser(pendingEmail)
  }, [activateDemoUser, isLoaded, isSignedIn, setActive, signIn])

  const signInWithDemoUser = async (email: string) => {
    if (!isLoaded) return

    if (isSignedIn && user?.primaryEmailAddress?.emailAddress === email) {
      router.push('/dashboard')
      return
    }

    if (isSignedIn) {
      window.sessionStorage.setItem(PENDING_DEMO_EMAIL_KEY, email)
      await signOut({ redirectUrl: '/demo-access' })
      return
    }

    activateDemoUser(email)
  }

  const resetDemo = async () => {
    if (!confirm('Reset demo to original state? All changes will be lost.')) return
    try {
      const res = await fetch(`${apiBase}/api/dev/reset-demo`, { method: 'POST' })
      const data = await readJsonSafely(res)
      if (!res.ok) throw new Error(data?.error || 'Failed to reset demo')
      alert('Demo reset successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to reset demo')
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="w-full max-w-4xl relative z-10 border border-white/10 bg-zinc-900/50 backdrop-blur-xl">
        <div className="p-8 md:p-12 border-b border-white/10">
          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">Demo Access</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Open the seeded demo workspace</h1>
            <p className="text-sm text-white/60 max-w-2xl">
              Choose one of the prepared demo accounts below. If another account is already signed in, ShiftSync will switch sessions cleanly and take you straight to the dashboard.
            </p>
          </div>
        </div>

        {error && (
          <div className="mx-8 md:mx-12 mt-8 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {loadingUsers ? (
          <div className="p-8 md:p-12 text-[10px] font-bold uppercase tracking-widest text-white/40">Loading demo accounts...</div>
        ) : (
          <div className="divide-y divide-white/10">
            {users.map((user, i) => {
              const active = pendingEmail === user.email && isSubmitting
              return (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => signInWithDemoUser(user.email)}
                  disabled={!isLoaded || active}
                  className="w-full text-left p-8 md:p-12 hover:bg-white/[0.03] transition-colors disabled:opacity-60 group flex items-center justify-between gap-6"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Role {String(i + 1).padStart(2, '0')}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                        {active ? 'Signing in...' : 'Use account'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">{user.name}</h2>
                    <p className="text-sm text-white/55 break-all mb-2">{user.email}</p>
                    <p className="text-xs text-white/40">{ROLE_DESCRIPTIONS[user.role] || ''}</p>
                  </div>
                  <ArrowRight size={16} className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              )
            })}
          </div>
        )}

        <div className="p-8 md:p-12 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/sign-in')}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors"
          >
            Back to regular sign-in
          </button>
          <button
            type="button"
            onClick={resetDemo}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors"
          >
            Reset demo data
          </button>
        </div>
      </div>
    </div>
  )
}
