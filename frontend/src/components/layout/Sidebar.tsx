'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { LayoutDashboard, Calendar, Users, Clock, DollarSign, BarChart3, MessageSquare, Settings, FileText } from 'lucide-react'
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
  { href: '/settings', icon: Settings, label: 'Settings' },  // 👈 add this
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useUser()

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" 
          onClick={onClose} 
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 h-full w-[240px] bg-zinc-900 border-r border-white/5 flex flex-col z-50 transition-transform duration-300 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link 
              key={href} 
              href={href}
              onClick={onClose}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-none text-[10px] font-bold uppercase tracking-widest transition-all duration-150',
                active ? 'bg-white text-black' : 'text-zinc-500 hover:bg-white/5 hover:text-white'
              )}>
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-8 h-8' } }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{user?.fullName || 'User'}</p>
            <p className="text-[10px] font-medium text-zinc-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}
