import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Retriever Project - 학교 정보 챗봇',
  description: 'your personal pup-assistant that fetches all school info and sniffs out the perfect match for you.',
  icons: {
    icon: '/images/logo_black.png',
    shortcut: '/images/logo_black.png',
    apple: '/images/logo_black.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const darkMode = localStorage.getItem('darkMode');
                  if (darkMode === 'true' || (!darkMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full bg-white dark:bg-gray-900 transition-colors duration-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}