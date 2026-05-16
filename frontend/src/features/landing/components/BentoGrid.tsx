'use client'
import { Cpu, Zap, BarChart3, Users } from 'lucide-react'

export function BentoGrid() {
  return (
    <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-16 sm:py-24 z-10 sm:overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 divide-x divide-y divide-white/10 border border-white/10">
          <div className="md:col-span-2 md:row-span-2 bg-white/[0.04] p-12 flex flex-col justify-between group overflow-hidden relative">
            <div className="relative z-10">
              <Cpu size={20} className="text-white/20 mb-12 group-hover:text-white transition-colors duration-500" />
              <h3 className="text-4xl font-light tracking-normal mb-6">
                Autonomous <br />
                Conflict Resolution
              </h3>
              <p className="text-white/40 text-sm font-light leading-relaxed max-w-xs">
                Our PostgreSQL core implements hard-coded interval constraints. Scheduling conflicts are physically impossible.
              </p>
            </div>
            <div className="mt-12 flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-white/[0.04]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Module 01</span>
            </div>
          </div>

          <div className="md:col-span-2 bg-white/[0.04] p-12 flex flex-col justify-between group">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-light tracking-tight">Latency: &lt;50ms</h3>
              <Zap size={18} className="text-white/20" />
            </div>
            <div>
              <p className="text-white/40 text-sm font-light leading-relaxed mb-4">
                Socket.io state synchronization across all nodes.
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 bg-white/5 group-hover:bg-white/80 transition-all duration-700"
                    style={{ transitionDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-1 bg-white/[0.04] p-10 flex flex-col justify-between group">
            <BarChart3 size={18} className="text-white/20" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Cost Control</h4>
          </div>

          <div className="md:col-span-1 bg-white/[0.04] p-10 flex flex-col justify-between group">
            <Users size={18} className="text-white/20" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Global Sync</h4>
          </div>
        </div>
      </div>
    </section>
  )
}
