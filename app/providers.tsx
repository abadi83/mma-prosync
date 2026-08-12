'use client';

import React from 'react';
import { AgregasiProvider } from '@/app/context/AgregasiContext';
import { SkuProvider } from '@/app/context/SkuContext';
import { AkuntansiProvider } from '@/app/context/AkuntansiContext';
import { GlobalSyncProvider } from '@/app/context/GlobalSyncProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GlobalSyncProvider>
      <AgregasiProvider>
        <SkuProvider>
          <AkuntansiProvider>
            {children}
          </AkuntansiProvider>
        </SkuProvider>
      </AgregasiProvider>
    </GlobalSyncProvider>
  );
}
