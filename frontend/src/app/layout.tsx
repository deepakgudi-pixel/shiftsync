import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShiftSync — Workforce Management',
  description: 'Next-gen frontline workforce management platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
          <Toaster position="top-right" toastOptions={{
            style: { background: '#0d0d1a', color: '#fff', borderRadius: '12px', fontSize: '14px', fontFamily: 'var(--font-dm)' },
            success: { iconTheme: { primary: '#4f6eff', secondary: '#fff' } },
          }} />
        </body>
      </html>
    </ClerkProvider>
  )
}
