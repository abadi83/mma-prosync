import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AppHeader } from '@/app/components/AppHeader';
import { Providers } from '@/app/providers';
import { ClientOnly } from '@/app/components/ClientOnly';

export const metadata: Metadata = {
  title: 'MMA ProSync',
  description: 'Grow Forever, Manage Smarter — Aplikasi operasional & keuangan toko',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'MMA ProSync',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>
          <ClientOnly>
            <AppHeader />
            {children}
          </ClientOnly>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
