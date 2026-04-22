'use client'
import React, { useEffect } from 'react'
import Link from 'next/link'
import { Calendar, Zap, BarChart3, ArrowRight, ShieldCheck, Users, LayoutGrid, Globe, Cpu } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

export default function LandingPage() {
  const { isSignedIn } = useUser()

  useEffect(() => {
    // Momentum Scrolling Logic
    let target = window.scrollY;
    let current = window.scrollY;
    let raf: number;

    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    const update = () => {
      current = lerp(current, target, 0.075); // Adjust 0.075 for "weight" (lower = smoother/slower)
      window.scrollTo(0, current);
      
      if (Math.abs(target - current) > 0.1) {
        raf = requestAnimationFrame(update);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      target += e.deltaY;
      target = Math.max(0, Math.min(target, document.documentElement.scrollHeight - window.innerHeight));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    // Sync positions if the user uses the scrollbar or touch
    const syncPosition = () => {
      target = window.scrollY;
      current = window.scrollY;
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', syncPosition);
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', syncPosition);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white selection:text-black overflow-x-hidden font-sans scroll-smooth">
      {/* Futuristic Background Grid */}
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.05] bg-zinc-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-white flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                  <rect x="2" y="8" width="10" height="4" fill="black"/>
                  <rect x="2" y="16" width="16" height="4" fill="black" fillOpacity="0.7"/>
                  <rect x="16" y="8" width="10" height="12" fill="black" fillOpacity="0.5"/>
                </svg>
              </div>
              <span className="font-bold text-white text-sm tracking-[0.3em] uppercase">ShiftSync</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link 
                href={isSignedIn ? "/dashboard" : "/sign-up"} 
                className="bg-white text-black px-6 py-2 rounded-none text-[9px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95"
              >
                {isSignedIn ? 'Dashboard' : 'Get Started'}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 md:pt-60 md:pb-48 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <h1 className="text-5xl md:text-[120px] font-bold leading-[1.1] text-white mb-12 tracking-[-0.02em] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            THE FUTURE OF <br />
            MANAGEMENT.
          </h1>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            <p className="max-w-md text-sm md:text-base text-white/40 leading-relaxed font-light">
              An autonomous orchestration layer for frontline teams. <br /> We solve the complexity of workforce scheduling with mathematical precision.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link 
                href={isSignedIn ? "/dashboard" : "/sign-up"} 
                className="group flex items-center gap-4 bg-white text-black px-10 py-5 rounded-none font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all"
              >
                Initialize <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Bento Grid */}
      <section className="py-24 bg-black/40 relative z-10 border-y border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-px bg-white/10 border border-white/10">
            
            {/* Logic Block */}
            <div className="md:col-span-2 md:row-span-2 bg-[#050505] p-12 flex flex-col justify-between group overflow-hidden relative">
              <div className="relative z-10">
                <Cpu size={20} className="text-white/20 mb-12 group-hover:text-white transition-colors duration-500" />
                <h3 className="text-4xl font-light tracking-tighter mb-6">Autonomous <br />Conflict Resolution</h3>
                <p className="text-white/40 text-sm font-light leading-relaxed max-w-xs">
                  Our PostgreSQL core implements hard-coded interval constraints. Scheduling conflicts are physically impossible.
                </p>
              </div>
              <div className="mt-12 flex items-center gap-4">
                <div className="h-[1px] flex-1 bg-white/10" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Module 01</span>
              </div>
            </div>

            {/* Real-time Block */}
            <div className="md:col-span-2 bg-[#050505] p-12 flex flex-col justify-between group border-b border-white/10 md:border-b-0">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-light tracking-tight">Latency: &lt;50ms</h3>
                <Zap size={18} className="text-white/20" />
              </div>
              <div>
                <p className="text-white/40 text-sm font-light leading-relaxed mb-4">
                  Socket.io state synchronization across all nodes.
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-1 flex-1 bg-white/5 group-hover:bg-white/20 transition-all duration-700" style={{ transitionDelay: `${i * 100}ms` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Analytics Block */}
            <div className="md:col-span-1 bg-[#050505] p-10 flex flex-col justify-between group border-r border-white/10">
              <BarChart3 size={18} className="text-white/20" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Cost Control</h4>
            </div>

            {/* Team Block */}
            <div className="md:col-span-1 bg-[#050505] p-10 flex flex-col justify-between group">
              <Users size={18} className="text-white/20" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Global Sync</h4>
            </div>

          </div>
        </div>
      </section>

      {/* Technical Specification Section */}
      <section className="py-32 overflow-hidden border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-20 items-center">
            <div className="flex-1">
              <div className="inline-block px-4 py-1 border border-white/10 text-[9px] font-bold uppercase tracking-[0.3em] mb-8 text-white/40">
                Core Infrastructure
              </div>
              <h2 className="text-5xl font-light tracking-tighter mb-8 leading-tight">Built on the <br />modern edge.</h2>
              <div className="grid grid-cols-2 gap-8">
                {[
                  { label: 'Frontend', val: 'Next.js 14' },
                  { label: 'Database', val: 'PostgreSQL' },
                  { label: 'Real-time', val: 'Socket.io' },
                  { label: 'Auth', val: 'Clerk' }
                ].map(spec => (
                  <div key={spec.label} className="border-t border-white/10 pt-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">{spec.label}</p>
                    <p className="text-sm font-medium">{spec.val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full aspect-square border border-white/10 bg-white/[0.04] relative flex items-center justify-center">
              <div className="w-1/2 h-1/2 border border-white/20 rotate-45 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe size={120} strokeWidth={0.5} className="text-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-48 bg-[#050505] text-white border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-6xl md:text-[100px] font-bold tracking-tight mb-16 leading-tight">READY TO <br />TRANSFORM?</h2>
          <div className="flex justify-center">
            <Link 
              href="/sign-up" 
              className="flex items-center gap-6 bg-white text-black px-12 py-6 rounded-none font-bold text-[12px] uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all shadow-2xl"
            >
              Create Workspace <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-black text-center border-t border-white/5">
        <p className="text-[12px] font-bold uppercase tracking-[0.8em] text-white/40">
          ShiftSync &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}