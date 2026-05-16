'use client'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center pt-32 pb-20 sm:pt-60 sm:pb-48 z-10 sm:overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left w-full">
        <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-[100px] font-bold leading-[1.1] text-white mb-12 tracking-[-0.02em] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
          ZERO CONFLICT <br />
          SHIFT MANAGEMENT
        </h1>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <p className="max-w-md text-sm md:text-base text-white/40 leading-relaxed font-light">
            An autonomous orchestration layer for frontline teams. <br />
            We solve the complexity of workforce scheduling with mathematical precision.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/demo-access"
              className="group flex items-center gap-4 bg-white text-black px-10 py-5 rounded-none font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all"
            >
              View Demo <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
