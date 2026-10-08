import type { Metadata } from 'next'
// Self-hosted fonts: no runtime request to Google, works offline.
import '@fontsource-variable/inter/opsz.css'
import '@fontsource/dm-serif-display/400.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Budge',
  description: 'A shared household budget for two.',
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F5F0' },
    { media: '(prefers-color-scheme: dark)', color: '#171311' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('budge-dark-mode') === 'true') {
              document.documentElement.setAttribute('data-theme', 'dark')
            }
          } catch(e) {}
        `}} />
        {children}
      </body>
    </html>
  )
}
