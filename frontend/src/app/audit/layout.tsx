'use client'

import { useState } from 'react'
import Sidebar from "@/components/layout/Sidebar";
import { Menu } from 'lucide-react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-surface-200 z-30 flex items-center px-4">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-2 text-ink-secondary hover:text-ink"
        >
          <Menu size={20} />
        </button>
        <span className="ml-2 font-bold text-ink" style={{fontFamily:'var(--font-bricolage)'}}>ShiftSync</span>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 pt-14 md:pt-0 md:ml-[240px] min-h-screen">
        {children}
      </main>
    </div>
  )
}