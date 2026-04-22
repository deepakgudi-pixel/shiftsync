'use client'

import { useState } from 'react'
import Sidebar from "@/components/layout/Sidebar";
import { Menu } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-zinc-50 selection:bg-black selection:text-white">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-900 border-b border-white/5 z-30 flex items-center px-4">
        <button 
          onClick={() => setIsSidebarOpen(true)} 
          className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
        >
          <Menu size={20} />
        </button>
        <span className="ml-2 font-bold text-white tracking-widest uppercase text-xs">ShiftSync</span>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 pt-14 md:pt-0 md:ml-[240px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
