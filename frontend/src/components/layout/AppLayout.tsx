'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Sidebar from "@/components/layout/Sidebar"
import { Menu } from 'lucide-react'

export const AppLayoutContext = createContext<{
  setPageLoading: (loading: boolean) => void
} | null>(null)

export function useAppLayout() {
  const context = useContext(AppLayoutContext)
  return context || { setPageLoading: () => {} }
}

interface AppLayoutProps {
  children: React.ReactNode
  variant?: 'default' | 'light'
}

export default function AppLayout({ children, variant = 'default' }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)

  useEffect(() => {
    // If the page is still loading its backend data, hold the loader
    if (pageLoading) return

    // Minimum display time to avoid flashing loaders on rapid APIs
    const fadeTimer = setTimeout(() => {
      setFadeOut(true)
    }, 350)

    const removeTimer = setTimeout(() => {
      setIsLoading(false)
    }, 650)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [pageLoading])

  // Safety Timeout: Force loader to unmount after 2.5s to prevent lock-outs
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setFadeOut(true)
      setTimeout(() => {
        setIsLoading(false)
      }, 300)
    }, 2500)

    return () => clearTimeout(safetyTimer)
  }, [])

  const wrapperClass = variant === 'light'
    ? 'flex min-h-screen bg-zinc-50 selection:bg-black selection:text-white'
    : 'flex min-h-screen'

  return (
    <AppLayoutContext.Provider value={{ setPageLoading }}>
      <div className={wrapperClass}>
        <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-900 border-b border-white/5 z-30 flex items-center px-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="ml-2 font-bold text-white tracking-widest uppercase text-xs">Relay</span>
        </header>

        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <main className="relative flex-1 pt-14 md:pt-0 md:ml-[240px] min-h-screen">
          {isLoading && (
            <div
              className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] transition-opacity duration-300 ease-out ${
                fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <div className="relative flex items-center justify-center w-24 h-24">
                {/* Outer Ring: spins counter-clockwise */}
                <div className="absolute inset-0 rounded-full border-t border-b border-l border-white/5 border-t-white animate-spin-reverse" />
                
                {/* Inner Ring: spins slow clockwise */}
                <div className="absolute inset-2 rounded-full border-r border-l border-t border-white/5 border-r-white/60 animate-spin" style={{ animationDuration: '3s' }} />
                
                {/* Pulsating Logo in Center */}
                <div className="z-10 animate-pulse flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                    <rect x="2" y="8" width="10" height="4" fill="white" />
                    <rect x="2" y="16" width="16" height="4" fill="white" fillOpacity="0.7" />
                    <rect x="16" y="8" width="10" height="12" fill="white" fillOpacity="0.5" />
                  </svg>
                </div>
              </div>
              <span className="mt-4 text-[9px] font-bold tracking-[0.3em] text-white/40 uppercase animate-pulse">
                Loading Relay
              </span>
            </div>
          )}
          {children}
        </main>
      </div>
    </AppLayoutContext.Provider>
  )
}
