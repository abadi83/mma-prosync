'use client';

import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export default function SkuTableScroll({ children }: { children: ReactNode }) {
  const tableId = useId();
  const topRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowWidth, setOverflowWidth] = useState(0);

  useEffect(() => {
    const viewport = tableRef.current!;
    const measure = () => {
      const width = viewport.scrollWidth;
      setOverflowWidth(width > viewport.clientWidth ? width : 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(contentRef.current!);
    const table = contentRef.current?.firstElementChild;
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (topRef.current && tableRef.current) topRef.current.scrollLeft = tableRef.current.scrollLeft;
  }, [overflowWidth]);

  return (
    <div className="mt-4 min-w-0">
      {overflowWidth > 0 && (
        <>
          <p className="mb-1 text-xs text-slate-500">Geser ke kanan atau kiri untuk melihat semua kolom.</p>
          <div
            ref={topRef}
            className="mb-2 overflow-x-auto rounded-md bg-slate-100 focus-visible:outline focus-visible:outline-brand-500"
            role="region"
            aria-label="Gulir horizontal tabel Master SKU"
            aria-controls={tableId}
            tabIndex={0}
            onScroll={e => {
              const viewport = tableRef.current;
              if (viewport && viewport.scrollLeft !== e.currentTarget.scrollLeft) viewport.scrollLeft = e.currentTarget.scrollLeft;
            }}
          >
            <div aria-hidden="true" className="h-3" style={{ width: overflowWidth }} />
          </div>
        </>
      )}
      <div
        id={tableId}
        ref={tableRef}
        className="overflow-x-auto rounded-xl border border-slate-100"
        onScroll={e => {
          const top = topRef.current;
          if (top && top.scrollLeft !== e.currentTarget.scrollLeft) top.scrollLeft = e.currentTarget.scrollLeft;
        }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  );
}
