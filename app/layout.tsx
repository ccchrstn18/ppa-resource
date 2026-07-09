import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const outfit = Outfit({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PPA Resource',
  description: 'PPA Mission Critical Solutions — Resource Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar />
          <main style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--bg)',
            padding: '24px',
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}