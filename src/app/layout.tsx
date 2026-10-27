import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tavor · Property summaries',
  description: 'Turn a realcommercial listing into a Tavor Property Opportunity Summary.',
  icons: { icon: '/brand/symbol.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  )
}
