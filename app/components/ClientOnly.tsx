'use client';

import React, { useState, useEffect } from 'react';

export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50" aria-hidden="true">
        {/* Loading placeholder untuk menghindari layout shift */}
      </div>
    );
  }

  return <>{children}</>;
}
