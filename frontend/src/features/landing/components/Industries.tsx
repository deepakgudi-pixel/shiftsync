'use client'
import { LayoutGrid, ShieldCheck, Zap } from 'lucide-react'

const INDUSTRIES = [
  {
    industry: 'Retail',
    icon: LayoutGrid,
    useCase: 'Scale holiday shifts without overstaffing.',
  },
  {
    industry: 'Healthcare',
    icon: ShieldCheck,
    useCase: 'Ensure 24/7 coverage with zero conflicts.',
  },
  {
    industry: 'Logistics',
    icon: Zap,
    useCase: 'Coordinate warehouse and delivery schedules.',
  },
]

export function Industries() {
  return (
    <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-20 sm:py-32 z-10 sm:overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="mb-16">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">BUILT FOR FRONTLINE TEAMS</h2>
          <p className="text-white/40 uppercase tracking-[0.3em] text-[10px] font-bold">Industries we serve</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-white/10 border border-white/10">
          {INDUSTRIES.map((item, i) => (
            <div key={i} className="bg-white/[0.02] p-8 md:p-12 group">
              <item.icon
                size={20}
                className="text-white/20 mb-8 group-hover:text-white transition-colors duration-500"
              />
              <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">{item.industry}</h3>
              <p className="text-white/60 text-xs leading-relaxed">{item.useCase}</p>
              <div className="mt-8 flex items-center gap-4">
                <div className="h-[1px] flex-1 bg-white/[0.04]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">
                  Industry {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
