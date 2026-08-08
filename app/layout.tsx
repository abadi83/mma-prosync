import './globals.css';
import type { Metadata } from 'next';
import { AppHeader } from '@/app/components/AppHeader';
import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  title: 'MMA ProSync',
  description: 'PWA untuk operasional dan keuangan toko',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
