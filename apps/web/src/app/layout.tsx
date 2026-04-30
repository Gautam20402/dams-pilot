import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { QueryProvider } from '@/components/providers/query-provider'
import { UserSync } from '@/components/providers/user-sync'
import './globals.css'

export const metadata: Metadata = {
  title: 'DAMS — Application Management',
  description: 'Decentralized Application Management System',
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <ClerkProvider>
          <QueryProvider>
            <UserSync />
            {children}
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
