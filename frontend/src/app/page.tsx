'use client'
import { useEffect, useRef } from 'react'
import { WebGLHero } from '@/features/landing/components/WebGLHero'
import { LandingNav } from '@/features/landing/components/LandingNav'
import { HeroSection } from '@/features/landing/components/HeroSection'
import { BentoGrid } from '@/features/landing/components/BentoGrid'
import { TechSpecs } from '@/features/landing/components/TechSpecs'
import { Industries } from '@/features/landing/components/Industries'
import { Comparison } from '@/features/landing/components/Comparison'
import { CtaSection } from '@/features/landing/components/CtaSection'

function SmoothScroll({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let target = 0
    let current = 0
    let raf: number
    const ease = 0.08

    const animate = () => {
      const diff = target - current
      current += diff * ease

      if (scrollContentRef.current) {
        scrollContentRef.current.style.transform = `translate3d(-${current}px, 0, 0)`
      }

      if (Math.abs(diff) > 0.1) {
        raf = requestAnimationFrame(animate)
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (window.innerWidth < 640) return
      e.preventDefault()

      target += e.deltaY * 1.5

      if (scrollContentRef.current) {
        const maxScroll = scrollContentRef.current.scrollWidth - window.innerWidth
        target = Math.max(0, Math.min(target, maxScroll))
      }

      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(animate)
    }

    const handleTouchStart = () => {
      if (containerRef.current) {
        target = containerRef.current.scrollLeft
        current = containerRef.current.scrollLeft
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={containerRef} className="sm:h-screen sm:w-screen sm:overflow-hidden">
      <div ref={scrollContentRef} className="flex flex-col sm:flex-row sm:h-full will-change-transform">
        {children}
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen sm:h-screen bg-transparent text-white selection:bg-white selection:text-black overflow-x-hidden sm:overflow-hidden font-sans">
      <div className="fixed inset-0 bg-[#050505] z-[-2]" />

      <WebGLHero />
      <div
        className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <LandingNav />

      <SmoothScroll>
        <HeroSection />
        <BentoGrid />
        <TechSpecs />
        <Industries />
        <Comparison />
        <CtaSection />
      </SmoothScroll>
    </div>
  )
}
