'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-black uppercase tracking-widest mb-2">Something went wrong</h2>
        <p className="text-xs text-zinc-400 uppercase tracking-wider mb-6">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
