'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk, useSignIn, useUser } from '@clerk/nextjs'
import { ArrowRight, BadgeCheck, BriefcaseBusiness, RotateCcw, ShieldCheck, Sparkles, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ApiError } from '@/types'

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

const ROLE_ICONS: Record<string, React.ElementType> = {
  'ADMIN': ShieldCheck,
  'MANAGER': BriefcaseBusiness,
  'EMPLOYEE': Users
}

const getApiBase = () => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')
  if (configured) return configured

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000'
  }

  return ''
}

const PENDING_DEMO_EMAIL_KEY = 'relay-demo-email'

type DemoAccessResponse = {
  error?: string
  ticket?: string
}

const getErrorMessage = (err: unknown, fallback: string) => {
  const error = err as ApiError
  return error.errors?.[0]?.longMessage || error.message || fallback
}

const readJsonSafely = async <T,>(response: Response): Promise<T> => {
  const raw = await response.text()

  try {
    return raw ? JSON.parse(raw) : {} as T
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
        const data = await readJsonSafely<DemoUser[] | DemoAccessResponse>(response)

        if (!response.ok) {
          const errorData = data as DemoAccessResponse
          throw new Error(errorData.error || 'Failed to load demo accounts')
        }

        setUsers(data as DemoUser[])
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load demo accounts'))
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

        const ticketData = await readJsonSafely<DemoAccessResponse>(ticketResponse)

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
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to sign in with demo account'))
        setPendingEmail(null)
        setIsSubmitting(false)
      }
    })()
  }, [apiBase, isLoaded, setActive, signIn])

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
      const data = await readJsonSafely<DemoAccessResponse>(res)
      if (!res.ok) throw new Error(data?.error || 'Failed to reset demo')
      toast.success('Demo reset successfully!')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset demo'))
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] p-4 text-white">
      {/* Background grid */}
      <div
        className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-zinc-950/75 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="grid border-b border-white/10 lg:grid-cols-[1fr_320px]">
          <div className="p-8 md:p-12">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <Sparkles size={13} className="text-white/60" />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">Guided Demo Access</p>
            </div>
            <h1 className="max-w-2xl text-3xl font-bold md:text-5xl">
              Open a production-like workforce workspace.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
              Pick a role and Relay will sign you into a seeded organisation with schedules, attendance, payroll, announcements, and audit history ready to explore.
            </p>
          </div>
          <div className="border-t border-white/10 bg-white/[0.03] p-8 lg:border-l lg:border-t-0 md:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                <BadgeCheck size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">First run</p>
                <p className="mt-1 text-sm font-semibold text-white">No password setup needed</p>
              </div>
            </div>
            <div className="mt-8 space-y-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
              <p>Seeded accounts</p>
              <p>Clean session switching</p>
              <p>Resettable demo state</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-8 mt-8 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 md:mx-12">
            {error}
          </div>
        )}

        {loadingUsers ? (
          <div className="grid gap-3 p-8 md:p-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {users.map((user, i) => {
              const active = pendingEmail === user.email && isSubmitting
              const RoleIcon = ROLE_ICONS[user.role] || Users
              return (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => signInWithDemoUser(user.email)}
                  disabled={!isLoaded || active}
                  className="group flex w-full items-center justify-between gap-6 p-6 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-60 md:p-8"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/60 transition-colors group-hover:border-white/20 group-hover:text-white">
                      <RoleIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Role {String(i + 1).padStart(2, '0')}</span>
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">
                          {active ? 'Signing in' : user.role}
                        </span>
                      </div>
                      <h2 className="mb-1 text-xl font-bold text-white">{user.name}</h2>
                      <p className="mb-2 break-all text-sm text-white/55">{user.email}</p>
                      <p className="text-xs text-white/40">{ROLE_DESCRIPTIONS[user.role] || ''}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <button
            type="button"
            onClick={() => router.push('/sign-in')}
            className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white"
          >
            Back to regular sign-in
          </button>
          <button
            type="button"
            onClick={resetDemo}
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 transition-colors hover:text-white"
          >
            <RotateCcw size={13} />
            Reset demo data
          </button>
        </div>
      </div>
    </div>
  )
}
