'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'

type DemoUser = {
  role: string
  name: string
  email: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function DemoAccessPage() {
  const router = useRouter()
  const { isLoaded, signIn, setActive } = useSignIn()
  const [users, setUsers] = useState<DemoUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/dev/demo-users`)
        const data = await response.json()

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
  }, [])

  const signInWithDemoUser = (email: string) => {
    if (!isLoaded || !signIn || !setActive) return

    setPendingEmail(email)
    setError(null)

    startTransition(async () => {
      try {
        const ticketResponse = await fetch(`${API_BASE}/api/dev/demo-ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

        const ticketData = await ticketResponse.json()

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
        router.push('/dashboard')
      } catch (err: any) {
        setError(err?.errors?.[0]?.longMessage || err.message || 'Failed to sign in with demo account')
        setPendingEmail(null)
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="w-full max-w-3xl relative z-10 border border-white/10 bg-zinc-900/90 backdrop-blur-xl p-8 md:p-10">
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-3">Local Demo Access</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Skip Clerk’s new-device prompt for local walkthroughs</h1>
          <p className="text-sm text-white/60 max-w-2xl">
            This page is development-only. It creates a short-lived Clerk sign-in ticket for one of the seeded demo users and turns it into a real session in the browser.
          </p>
        </div>

        {error && (
          <div className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {loadingUsers ? (
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Loading demo accounts...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {users.map((user) => {
              const active = pendingEmail === user.email && isPending
              return (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => signInWithDemoUser(user.email)}
                  disabled={!isLoaded || active}
                  className="text-left border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-colors p-5 disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{user.role}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                      {active ? 'Signing in...' : 'Use account'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mb-1">{user.name}</h2>
                  <p className="text-sm text-white/55 break-all">{user.email}</p>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={() => router.push('/sign-in')}
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors"
          >
            Back to regular sign-in
          </button>
        </div>
      </div>
    </div>
  )
}
