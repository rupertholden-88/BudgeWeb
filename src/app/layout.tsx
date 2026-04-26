import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Budge',
  description: 'Household budget for Niamh & Rupert',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
