'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { LayoutDashboard, Calendar, Users, Clock, DollarSign, BarChart3, MessageSquare, FileText, Send, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApi } from '@/hooks/useApi'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/team', icon: Users, label: 'Team' },
  { href: '/attendance', icon: Clock, label: 'Attendance' },
  { href: '/payroll', icon: DollarSign, label: 'Payroll' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/messages', icon: MessageSquare, label: 'Messages' },
  { href: '/audit', icon: FileText, label: 'Audit Log' },
  { href: '/invite', icon: Send, label: 'Invite' },
]

const DEMO_EMAILS = new Set([
  'demo.admin.northstar+clerk_test@example.com',
  'demo.manager.northstar+clerk_test@example.com',
  'demo.leah.northstar+clerk_test@example.com',
  'demo.nina.northstar+clerk_test@example.com',
  'demo.owen.northstar+clerk_test@example.com',
])

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const api = useApi()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [member, setMember] = useState<any>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const userEmail = user?.primaryEmailAddress?.emailAddress || ''
  const isDemoUser = DEMO_EMAILS.has(userEmail)
  const isAdmin = member?.role === 'ADMIN'
  const signOutRedirect = isDemoUser ? '/demo-access' : '/sign-in'

  useEffect(() => {
    let cancelled = false

    const loadMember = async () => {
      try {
        const res = await api.get('/api/members/me')
        if (!cancelled) setMember(res.data)
      } catch {
        if (!cancelled) setMember(null)
      }
    }

    loadMember()
    return () => {
      cancelled = true
    }
  }, [api])

  const handleSignOut = async () => {
    onClose?.()
    router.replace(`${signOutRedirect}?signing_out=1`)
    await signOut({ redirectUrl: signOutRedirect })
  }

  const handleDeleteOrganisation = async () => {
    setIsDeleting(true)
    try {
      await api.delete('/api/organisations/me')
      setShowDeleteModal(false)
      toast.success('Organisation deleted')
      router.replace(`${signOutRedirect}?org_deleted=1`)
      await signOut({ redirectUrl: signOutRedirect })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete organisation')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setShowDeleteModal(false)
          }}
        >
          <div className="w-full max-w-md border border-white/10 bg-zinc-900 p-6 shadow-2xl shadow-black/40">
            <div className="mb-5 flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center border border-red-500/30 bg-red-500/10 text-red-300">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300/80">Danger Zone</p>
                <h2 className="mt-2 text-lg font-bold uppercase tracking-widest text-white">Delete Organisation</h2>
              </div>
            </div>

            <p className="text-sm leading-6 text-zinc-300">
              This will permanently delete your organisation, team members, shifts, attendance records, payroll data, messages, notifications, and audit history.
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              This action cannot be undone.
            </p>

            <div className="mt-6 grid gap-3 border border-white/5 bg-black/20 p-4 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
              <p>Delete organisation workspace</p>
              <p>Remove all associated operational records</p>
              <p>Sign the current admin out immediately after completion</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOrganisation}
                disabled={isDeleting}
                className="bg-red-500 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Organisation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 h-full w-[240px] bg-zinc-900 border-r border-white/5 flex flex-col z-50 transition-transform duration-300 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <rect x="2" y="8" width="10" height="4" fill="black"/>
                <rect x="2" y="16" width="16" height="4" fill="black" fillOpacity="0.7"/>
                <rect x="16" y="8" width="10" height="12" fill="black" fillOpacity="0.5"/>
              </svg>
            </div>
            <span className="font-bold text-white text-sm tracking-widest uppercase">ShiftSync</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-none text-[10px] font-bold uppercase tracking-widest transition-all duration-150',
                  active ? 'bg-white text-black' : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName || 'User'}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                {(user?.firstName || user?.fullName || 'U').slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.fullName || 'User'}</p>
              <p className="text-[10px] font-medium text-zinc-500 truncate">{userEmail}</p>
            </div>
          </div>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                disabled={isDemoUser}
                className="mt-3 w-full border border-red-500/20 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-zinc-500 disabled:hover:bg-transparent"
              >
                Delete Organisation
              </button>
              {isDemoUser && (
                <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Disabled in the shared demo workspace
                </p>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 w-full border border-white/10 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
