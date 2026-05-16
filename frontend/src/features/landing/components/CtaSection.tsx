'use client'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CtaSection() {
  return (
    <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-32 sm:py-48 text-white sm:overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
        <h2 className="text-5xl md:text-[100px] font-bold tracking-tight mb-16 leading-tight">
          READY TO <br />
          TRANSFORM?
        </h2>
        <div className="flex justify-center">
          <Link
            href="/sign-up"
            className="flex items-center gap-6 bg-white text-black px-8 py-4 md:px-12 md:py-6 rounded-none font-bold text-[10px] md:text-[12px] uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all shadow-2xl"
          >
            Create Workspace <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
