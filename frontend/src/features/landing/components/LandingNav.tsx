'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

export function LandingNav() {
  const { isSignedIn } = useUser()

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/[0.05] bg-zinc-900/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <rect x="2" y="8" width="10" height="4" fill="black" />
                <rect x="2" y="16" width="16" height="4" fill="black" fillOpacity="0.7" />
                <rect x="16" y="8" width="10" height="12" fill="black" fillOpacity="0.5" />
              </svg>
            </div>
            <span className="font-bold text-white text-sm tracking-[0.3em] uppercase">ShiftSync</span>
          </div>
          <div className="hidden sm:flex items-center gap-8">
            <Link
              href={isSignedIn ? '/dashboard' : '/sign-up'}
              className="bg-white text-black px-6 py-2 rounded-none text-[9px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95"
            >
              {isSignedIn ? 'Dashboard' : 'Get Started'}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
