import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Futuristic Background Grid */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-white mb-6">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="8" width="10" height="4" fill="black"/>
              <rect x="2" y="16" width="16" height="4" fill="black" fillOpacity="0.7"/>
              <rect x="16" y="8" width="10" height="12" fill="black" fillOpacity="0.5"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-[0.3em] uppercase">ShiftSync</h1>
          <p className="text-white/30 mt-3 text-[10px] font-bold uppercase tracking-[0.2em]">System Access</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-none shadow-2xl',
              headerTitle: 'text-white font-bold tracking-tight',
              headerSubtitle: 'text-white/40',
              socialButtonsBlockButton: 'bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-none',
              formButtonPrimary: 'bg-white text-black hover:bg-zinc-200 rounded-none font-bold uppercase tracking-widest text-[10px] h-12 transition-all',
              footerActionText: 'text-zinc-400',
              footerActionLink: 'text-zinc-400 hover:text-black hover:bg-white px-1 font-bold transition-colors no-underline',
              formFieldLabel: 'text-white/40 uppercase text-[9px] tracking-widest font-bold',
              formFieldInput: 'bg-white/[0.03] border-white/10 text-white rounded-none focus:border-white/20 h-11 transition-all',
              dividerText: 'text-white/20 uppercase text-[9px] tracking-widest',
              dividerLine: 'bg-white/10',
              identityPreviewText: 'text-white',
              formResendCodeLink: 'text-white',
              formFieldSuccessText: 'text-white/40',
              formFieldOptional: 'hidden',
            }
          }}
        />
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/40 mt-8">
          Don&apos;t have an account? <a href="/sign-up" className="text-zinc-400 hover:text-black hover:bg-white px-1 transition-colors no-underline font-bold">Sign up here</a>
        </p>
      </div>
    </div>
  )
}
