import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm' })

export const metadata: Metadata = {
  title: 'Relay — Workforce Management',
  description: 'Next-gen frontline workforce management platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={{
        signIn: {
          start: {
            title: 'Sign in to Relay',
            subtitle: 'to continue to Relay',
          },
        },
        signUp: {
          start: {
            title: 'Create your Relay account',
            subtitle: 'to continue to Relay',
          },
        },
      }}
    >
      <html lang="en" suppressHydrationWarning className={dmSans.variable}>
        <body className={dmSans.className}>
          {children}
          <Toaster position="top-right" toastOptions={{
            style: { background: '#000', color: '#fff', borderRadius: '0', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid rgba(255,255,255,0.1)' },
            success: { iconTheme: { primary: '#fff', secondary: '#000' } },
          }} />
        </body>
      </html>
    </ClerkProvider>
  )
}
