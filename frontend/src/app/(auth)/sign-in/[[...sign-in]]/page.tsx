import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-purple-950 flex items-center justify-center p-4">
      <div className="max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="8" width="10" height="4" rx="2" fill="white"/>
              <rect x="2" y="16" width="16" height="4" rx="2" fill="white" fillOpacity="0.6"/>
              <rect x="16" y="8" width="10" height="12" rx="2" fill="white" fillOpacity="0.4"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white" style={{fontFamily: 'var(--font-bricolage)'}}>ShiftSync</h1>
          <p className="text-brand-300 mt-1 text-sm">Workforce management reimagined</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-white/95 backdrop-blur rounded-2xl shadow-2xl border-0',
              headerTitle: 'font-semibold text-ink',
              formButtonPrimary: 'bg-brand-500 hover:bg-brand-600 rounded-xl',
              footerActionLink: 'text-brand-500',
            }
          }}
        />
        <p className="text-center text-sm text-brand-300 mt-4">
          New to ShiftSync? <a href="/sign-up" className="text-white font-medium underline hover:text-brand-200">Create an account</a>
        </p>
      </div>
    </div>
  )
}
