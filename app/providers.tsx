'use client';

import { AgregasiProvider } from '@/app/context/AgregasiContext';
import { SkuProvider } from '@/app/context/SkuContext';
import { AkuntansiProvider } from '@/app/context/AkuntansiContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AgregasiProvider>
      <SkuProvider>
        <AkuntansiProvider>
          {children}
        </AkuntansiProvider>
      </SkuProvider>
    </AgregasiProvider>
  );
}
