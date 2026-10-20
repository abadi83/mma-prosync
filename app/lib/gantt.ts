/** Helper murni untuk Gantt chart modul Tugas — mudah di-test tanpa DOM. */

export interface GanttTask {
  id: string;
  judul: string;
  status: string;
  progress: number;
  petugas: string[];          // nama petugas (bisa lebih dari 1)
  tanggalMulai: string | null; // YYYY-MM-DD
  tenggat: string | null;      // YYYY-MM-DD
  createdAt?: string;          // fallback bila tidak ada tanggal
}

export interface GanttBar {
  id: string;
  taskId: string;
  judul: string;
  status: string;
  progress: number;
  petugas: string;
  start: Date;
  end: Date;
  row: number;
  offsetDays: number;
  lengthDays: number;
  isLate: boolean;
}

export interface GanttLayout {
  bars: GanttBar[];
  rows: string[];          // label tiap baris (nama petugas / tanpa petugas)
  range: { start: Date; end: Date };
  totalDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateSafe(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function todayMidnight(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Hitung start & end tiap tugas dengan fallback yang masuk akal. */
export function resolveRange(task: GanttTask, now = todayMidnight()): { start: Date; end: Date } {
  let start = parseDateSafe(task.tanggalMulai);
  let end = parseDateSafe(task.tenggat);
  const created = parseDateSafe(task.createdAt ? task.createdAt.slice(0, 10) : null);
  if (!start) start = created || now;
  if (!end) end = addDays(start, 7);
  if (end.getTime() < start.getTime()) end = start;
  return { start, end };
}

export function buildGantt(tasks: GanttTask[], now = todayMidnight()): GanttLayout {
  const rows: string[] = [];
  const rowOf = new Map<string, number>();

  // Ekspansi: 1 tugas dengan N petugas → N bar (satu per petugas)
  const expanded = tasks.flatMap((t) => {
    const names = t.petugas.length > 0 ? t.petugas : ['— Tanpa petugas —'];
    return names.map((nama) => ({ ...t, key: `${t.id}|${nama}`, petugasName: nama }));
  });

  const sorted = [...expanded].sort((a, b) => {
    if (a.petugasName !== b.petugasName) return a.petugasName.localeCompare(b.petugasName);
    return (resolveRange(a, now).start.getTime()) - (resolveRange(b, now).start.getTime());
  });

  const bars: GanttBar[] = sorted.map((t) => {
    const { start, end } = resolveRange(t, now);
    if (!rowOf.has(t.petugasName)) { rowOf.set(t.petugasName, rows.length); rows.push(t.petugasName); }
    return {
      id: t.key,
      taskId: t.id,
      judul: t.judul,
      status: t.status,
      progress: Math.min(100, Math.max(0, Math.round(t.progress || 0))),
      petugas: t.petugasName,
      start,
      end,
      row: rowOf.get(t.petugasName)!,
      offsetDays: 0,
      lengthDays: 0,
      isLate: t.status !== 'selesai' && end.getTime() < now.getTime(),
    };
  });

  if (bars.length === 0) {
    const start = now;
    const end = addDays(now, 14);
    return { bars, rows, range: { start, end }, totalDays: 14 };
  }

  let min = bars[0].start;
  let max = bars[0].end;
  for (const b of bars) {
    if (b.start.getTime() < min.getTime()) min = b.start;
    if (b.end.getTime() > max.getTime()) max = b.end;
  }
  const rangeStart = addDays(min, -1);
  const rangeEnd = addDays(max, 1);
  const totalDays = Math.max(1, dayDiff(rangeStart, rangeEnd) + 1);

  for (const b of bars) {
    b.offsetDays = Math.max(0, dayDiff(rangeStart, b.start));
    b.lengthDays = Math.max(1, dayDiff(b.start, b.end) + 1);
  }
  return { bars, rows, range: { start: rangeStart, end: rangeEnd }, totalDays };
}

/** Label tanggal pendek: "19 Okt" */
export function shortDate(d: Date): string {
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]}`;
}
