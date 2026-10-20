import { describe, it, expect } from 'vitest';
import { buildGantt, resolveRange, parseDateSafe, GanttTask } from './gantt';

const NOW = new Date(2026, 9, 20); // 20 Okt 2026

function t(over: Partial<GanttTask> & { id: string }): GanttTask {
  return { judul: 'Tugas', status: 'todo', progress: 0, petugasNama: null, tanggalMulai: null, tenggat: null, ...over };
}

describe('gantt helpers', () => {
  it('parseDateSafe menerima YYYY-MM-DD', () => {
    const d = parseDateSafe('2026-10-05');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(9);
    expect(parseDateSafe('sampah')).toBeNull();
    expect(parseDateSafe(null)).toBeNull();
  });

  it('resolveRange: tanpa tanggal → fallback ke createdAt atau hari ini + 7 hari', () => {
    const a = resolveRange(t({ id: 'a' }), NOW);
    expect(dayDiffOrZero(a.start, NOW)).toBe(0);
    expect(dayDiffOrZero(a.start, a.end)).toBe(7);

    const b = resolveRange(t({ id: 'b', createdAt: '2026-10-01 10:00' }), NOW);
    expect(b.start.getDate()).toBe(1);
  });

  it('resolveRange: tenggat lebih awal dari mulai → end = mulai', () => {
    const r = resolveRange(t({ id: 'c', tanggalMulai: '2026-10-15', tenggat: '2026-10-10' }), NOW);
    expect(r.end.getTime()).toBe(r.start.getTime());
  });

  it('buildGantt: mengelompokkan baris per petugas & range mencakup semua bar', () => {
    const layout = buildGantt([
      t({ id: '1', judul: 'A', petugasNama: 'Andi', tanggalMulai: '2026-10-01', tenggat: '2026-10-05' }),
      t({ id: '2', judul: 'B', petugasNama: 'Andi', tanggalMulai: '2026-10-03', tenggat: '2026-10-08' }),
      t({ id: '3', judul: 'C', petugasNama: 'Siti', tanggalMulai: '2026-10-10', tenggat: '2026-10-12' }),
    ], NOW);
    expect(layout.rows).toEqual(['Andi', 'Siti']);
    expect(layout.bars).toHaveLength(3);
    expect(layout.bars.find(b => b.id === '1')!.row).toBe(0);
    expect(layout.bars.find(b => b.id === '3')!.row).toBe(1);
    expect(layout.bars.every(b => b.lengthDays >= 1)).toBe(true);
    // range harus mencakup semua bar
    const minStart = Math.min(...layout.bars.map(b => b.start.getTime()));
    const maxEnd = Math.max(...layout.bars.map(b => b.end.getTime()));
    expect(layout.range.start.getTime()).toBeLessThanOrEqual(minStart);
    expect(layout.range.end.getTime()).toBeGreaterThanOrEqual(maxEnd);
  });

  it('buildGantt: tugas lewat tenggat & belum selesai → isLate', () => {
    const layout = buildGantt([
      t({ id: '1', status: 'proses', tanggalMulai: '2026-10-01', tenggat: '2026-10-05' }),
      t({ id: '2', status: 'selesai', tanggalMulai: '2026-10-01', tenggat: '2026-10-05' }),
    ], NOW);
    expect(layout.bars.find(b => b.id === '1')!.isLate).toBe(true);
    expect(layout.bars.find(b => b.id === '2')!.isLate).toBe(false);
  });

  it('buildGantt: tanpa tugas → range 14 hari dari sekarang', () => {
    const layout = buildGantt([], NOW);
    expect(layout.bars).toHaveLength(0);
    expect(layout.range.start.getTime()).toBe(NOW.getTime());
    expect(layout.totalDays).toBe(14);
  });
});

function dayDiffOrZero(a: Date, b: Date): number {
  return Math.round(Math.abs((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)));
}
