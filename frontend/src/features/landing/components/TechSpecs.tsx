'use client'
import { Globe } from 'lucide-react'

export function TechSpecs() {
  return (
    <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-20 sm:py-32 sm:overflow-hidden sm:overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row gap-20 items-center">
          <div className="flex-1">
            <div className="inline-block px-4 py-1 border border-white/10 text-[9px] font-bold uppercase tracking-[0.3em] mb-8 text-white/40">
              Core Infrastructure
            </div>
            <h2 className="text-4xl md:text-5xl font-light tracking-normal mb-8 leading-tight">
              Built on the <br />
              modern edge.
            </h2>
            <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border border-white/10">
              {[
                { label: 'Frontend', val: 'Next.js 14' },
                { label: 'Database', val: 'PostgreSQL' },
                { label: 'Real-time', val: 'Socket.io' },
                { label: 'Auth', val: 'Clerk' },
              ].map((spec) => (
                <div key={spec.label} className="p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">{spec.label}</p>
                  <p className="text-sm font-medium">{spec.val}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full aspect-square border border-white/[0.04] bg-white/[0.04] relative flex items-center justify-center">
            <div className="w-1/2 h-1/2 border border-white/30 rotate-45 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe size={120} strokeWidth={0.5} className="text-white/10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
