/** Berita dari Google News RSS — server-side (tanpa API key, gratis).
 *  Parser RSS ditulis manual tanpa dependency XML. */

export interface BeritaItem {
  title: string;
  link: string;
  source: string;
  pubDate: string; // RFC2822
  snippet: string;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&#(\d+);|&#x([0-9a-fA-F]+);|&[a-zA-Z]+;/g, (m, d, h) => {
    if (d) { const c = String.fromCharCode(+d); return c; }
    if (h) { const c = String.fromCharCode(parseInt(h, 16)); return c; }
    return ENTITIES[m] || m;
  });
}

export function stripHtml(s: string): string {
  // Keluarkan isi CDATA dulu, baru buang tag & spasi berlebih
  return decodeEntities(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function field(src: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`).exec(src);
  return m ? m[1].trim() : '';
}

export function parseGoogleNewsRss(xml: string): BeritaItem[] {
  const items: BeritaItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const src = m[1];
    const title = stripHtml(field(src, 'title'));
    const link = stripHtml(field(src, 'link'));
    const pubDate = stripHtml(field(src, 'pubDate'));
    const source = stripHtml(field(src, 'source'));
    const desc = stripHtml(field(src, 'description'));
    if (!title || !link) continue;
    items.push({
      title,
      link,
      source,
      pubDate,
      snippet: desc.length > 180 ? `${desc.slice(0, 180)}…` : desc,
    });
  }
  return items;
}

/* ── Cache dalam proses (TTL 10 menit) supaya tidak memukul Google terus ── */
let cache: { at: number; items: BeritaItem[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchBerita(): Promise<BeritaItem[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;

  const queries = ['marketplace ecommerce', 'ecommerce'];
  const all: BeritaItem[] = [];
  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'MMA-ProSync/1.0 (+https://erp-mma.tech)' },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      all.push(...parseGoogleNewsRss(await res.text()));
    } catch { /* satu feed gagal — lanjut feed lain */ }
  }

  // Dedupe by link & urutkan terbaru
  const seen = new Set<string>();
  const uniq: BeritaItem[] = [];
  for (const it of all) {
    if (seen.has(it.link)) continue;
    seen.add(it.link);
    uniq.push(it);
  }
  uniq.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
  const items = uniq.slice(0, 5);
  cache = { at: Date.now(), items };
  return items;
}
