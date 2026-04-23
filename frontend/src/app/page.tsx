'use client'
import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Calendar, Zap, BarChart3, ArrowRight, ShieldCheck, Users, LayoutGrid, Globe, Cpu, X, CircleCheck, CircleX } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

const WebGLHero = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { 
      alpha: true, 
      antialias: false, 
      powerPreference: "low-power" 
    });
    if (!gl) return;

    const vs = `
      attribute vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;

    const fs = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_ratio;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 4.0;
        p.x *= u_ratio;

        float t = u_time * 0.5;
        
        for(int i=1; i<5; i++){
          float fi = float(i);
          p.x += 0.4 / fi * sin(fi * p.y + t + 0.5 * fi);
          p.y += 0.4 / fi * sin(fi * p.x + t + 0.3 * fi);
        }

        float strength = sin(p.x + p.y);
        vec3 color = mix(vec3(0.05, 0.1, 0.2), vec3(0.2, 0.5, 1.0), strength * 0.5 + 0.5);
        
        float highlight = pow(max(0.0, strength), 12.0);
        color += highlight * 0.4;

        gl_FragColor = vec4(color * 0.8, 1.0);
      }
    `;

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const utime = gl.getUniformLocation(program, 'u_time');
    const ures = gl.getUniformLocation(program, 'u_resolution');
    const uratio = gl.getUniformLocation(program, 'u_ratio');

    const handleResize = () => {
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      const ratio = displayWidth / displayHeight;
      
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.uniform2f(ures, canvas.width, canvas.height);
        gl.uniform1f(uratio, ratio);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const render = (time: number) => {
      if (!canvasRef.current || !gl) return;
      gl.uniform1f(utime, time * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    };

    let raf = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full opacity-60 pointer-events-none z-[-1]" />;
};

export default function LandingPage() {
  const { isSignedIn } = useUser()
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Momentum Scrolling Logic
    let target = 0;
    let current = 0;
    let raf: number;

    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    const update = () => {
      current = lerp(current, target, 0.1); // Increased for high responsiveness and "buttery" glide
      if (scrollContentRef.current) {
        scrollContentRef.current.style.transform = `translate3d(-${current}px, 0, 0)`;
      }
      
      if (Math.abs(target - current) > 0.1) {
        raf = requestAnimationFrame(update);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (window.innerWidth < 640) return; // Horizontal for iPads/Tabs (sm breakpoint)
      e.preventDefault();
      target += e.deltaY; // Standard leverage for natural response
      if (scrollContentRef.current) {
        const maxScroll = scrollContentRef.current.scrollWidth - window.innerWidth;
        target = Math.max(0, Math.min(target, maxScroll));
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    // Sync positions if the user uses the scrollbar or touch
    const syncPosition = () => {
      if (containerRef.current) {
        target = containerRef.current.scrollLeft;
        current = containerRef.current.scrollLeft;
      }
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
    <div className="min-h-screen sm:h-screen bg-transparent text-white selection:bg-white selection:text-black overflow-x-hidden sm:overflow-hidden font-sans">
      {/* Essential: Base background layer placed behind the WebGL canvas */}
      <div className="fixed inset-0 bg-[#050505] z-[-2]" />

      <WebGLHero />
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
            <div className="hidden sm:flex items-center gap-8">
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

      <div ref={containerRef} className="sm:h-screen sm:w-screen sm:overflow-hidden">
        <div ref={scrollContentRef} className="flex flex-col sm:flex-row sm:h-full will-change-transform">
        {/* Hero Section */}
        <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center pt-32 pb-20 sm:pt-60 sm:pb-48 z-10 sm:overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left w-full">
            <h1 className="text-4xl sm:text-5xl md:text-[120px] font-bold leading-[1.1] text-white mb-12 tracking-[-0.02em] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
              THE FUTURE OF <br />
              MANAGEMENT<span className="text-white/20">.</span>
            </h1>
            
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
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
        <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-16 sm:py-24 z-10 sm:overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-px bg-white/[0.04] border border-white/[0.04]">
              
              {/* Logic Block - Expands on Desktop */}
              <div className="md:col-span-2 md:row-span-2 bg-white/[0.04] p-12 flex flex-col justify-between group overflow-hidden relative">
                <div className="relative z-10">
                  <Cpu size={20} className="text-white/20 mb-12 group-hover:text-white transition-colors duration-500" />
                  <h3 className="text-4xl font-light tracking-normal mb-6">Autonomous <br />Conflict Resolution</h3>
                  <p className="text-white/40 text-sm font-light leading-relaxed max-w-xs">
                    Our PostgreSQL core implements hard-coded interval constraints. Scheduling conflicts are physically impossible.
                  </p>
                </div>
                <div className="mt-12 flex items-center gap-4">
                  <div className="h-[1px] flex-1 bg-white/[0.04]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Module 01</span>
                </div>
              </div>

              {/* Real-time Block */}
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
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="h-1 flex-1 bg-white/5 group-hover:bg-white/80 transition-all duration-700" style={{ transitionDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Analytics Block */}
              <div className="md:col-span-1 bg-white/[0.04] p-10 flex flex-col justify-between group">
                <BarChart3 size={18} className="text-white/20" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Cost Control</h4>
              </div>

              {/* Team Block */}
              <div className="md:col-span-1 bg-white/[0.04] p-10 flex flex-col justify-between group">
                <Users size={18} className="text-white/20" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Global Sync</h4>
              </div>

            </div>
          </div>
        </section>

        {/* Technical Specification Section */}
        <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-20 sm:py-32 sm:overflow-hidden sm:overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex flex-col md:flex-row gap-20 items-center">
              <div className="flex-1">
                <div className="inline-block px-4 py-1 border border-white/10 text-[9px] font-bold uppercase tracking-[0.3em] mb-8 text-white/40">
                  Core Infrastructure
                </div>
                <h2 className="text-4xl md:text-5xl font-light tracking-normal mb-8 leading-tight">Built on the <br />modern edge.</h2>
                <div className="grid grid-cols-2 gap-8">
                  {[
                    { label: 'Frontend', val: 'Next.js 14' },
                    { label: 'Database', val: 'PostgreSQL' },
                    { label: 'Real-time', val: 'Socket.io' },
                    { label: 'Auth', val: 'Clerk' }
                  ].map(spec => (
                    <div key={spec.label} className="border-t border-white/[0.04] pt-4">
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

        {/* Competitive Advantage / Comparison Section */}
        <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-20 sm:py-32 z-10 sm:overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="mb-16">
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">BEYOND LEGACY TOOLS<span className="text-white/20">.</span></h2>
              <p className="text-white/40 uppercase tracking-[0.3em] text-[10px] font-bold">Designed for clarity. Built for control.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10">
              {/* Legacy Column */}
              <div className="bg-white/[0.02] p-8 md:p-12">
                <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-10">Traditional Workforce Software</h3>
                <ul className="space-y-8">
                  {[
                    { t: "Scheduling Chaos", d: "Spreadsheets and whiteboards that allow double-bookings." },
                    { t: "Disconnected Data", d: "Attendance and payroll live in separate, siloed systems." },
                    { t: "Opaque Accountability", d: "No audit trail of who changed what, when, or why." },
                    { t: "Delayed Sync", d: "Important updates die in ignored email threads or group chats." }
                  ].map((item, i) => (
                    <li key={i} className="flex gap-4">
                      <CircleX size={16} className="text-white shrink-0 mt-1" />
                      <div>
                        <p className="text-white text-sm font-bold uppercase tracking-wider mb-1">{item.t}</p>
                        <p className="text-white/40 text-xs leading-relaxed">{item.d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ShiftSync Column */}
              <div className="bg-white/[0.02] p-8 md:p-12 border-l border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                </div>
                <h3 className="text-white text-[10px] font-bold uppercase tracking-widest mb-10">ShiftSync Orchestration</h3>
                <ul className="space-y-8">
                  {[
                    { t: "SQL-Level Validation", d: "Hard-coded constraints make scheduling conflicts physically impossible." },
                    { t: "Unified Ecosystem", d: "Hours worked flow instantly into payroll—no manual reconciliation." },
                    { t: "Immutable Audit Logs", d: "Every write operation is logged with before/after state diffs." },
                    { t: "Zero-Latency Updates", d: "Socket.io broadcasts changes across all nodes in under 50ms." }
                  ].map((item, i) => (
                    <li key={i} className="flex gap-4">
                      <CircleCheck size={16} className="text-white shrink-0 mt-1"/>
                      <div>
                        <p className="text-white text-sm font-bold uppercase tracking-wider mb-1">{item.t}</p>
                        <p className="text-white/40 text-xs leading-relaxed">{item.d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Final Call to Action */}
        <section className="relative w-full sm:w-screen flex-shrink-0 min-h-screen sm:h-full flex flex-col justify-center py-32 sm:py-48 text-white sm:overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
            <h2 className="text-5xl md:text-[100px] font-bold tracking-tight mb-16 leading-tight">READY TO <br />TRANSFORM?</h2>
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
        </div>
      </div>
    </div>
  )
}