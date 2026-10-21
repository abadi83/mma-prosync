import { describe, it, expect } from 'vitest';
import { parseGoogleNewsRss, stripHtml, decodeEntities } from './beritaService';

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss version="2.0">
<channel>
  <title>Google News</title>
  <item>
    <title>Shopee dan Tokopedia bersaing ketat di pasar e-commerce &amp; marketplace</title>
    <link>https://news.google.com/rss/articles/abc123</link>
    <guid isPermaLink="false">abc123</guid>
    <pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<a href="https://example.com">Contoh</a> Pertumbuhan belanja online meningkat tajam pada kuartal ini.]]></description>
    <source url="https://katadata.co.id">Katadata</source>
  </item>
  <item>
    <title>Pemerintah dorong UMKM go digital lewat marketplace lokal</title>
    <link>https://news.google.com/rss/articles/def456</link>
    <guid isPermaLink="false">def456</guid>
    <pubDate>Wed, 21 Oct 2026 09:00:00 GMT</pubDate>
    <description>Tanpa deskripsi</description>
    <source url="https://cnbcindonesia.com">CNBC Indonesia</source>
  </item>
  <item>
    <title><![CDATA[Berita tanpa <b>link</b> valid]]></title>
    <description>dibuang</description>
  </item>
</channel>
</rss>`;

describe('parseGoogleNewsRss', () => {
  it('memparsing item RSS Google News', () => {
    const items = parseGoogleNewsRss(SAMPLE_RSS);
    expect(items).toHaveLength(2); // item tanpa link dibuang
    expect(items[0].title).toBe('Shopee dan Tokopedia bersaing ketat di pasar e-commerce & marketplace');
    expect(items[0].link).toBe('https://news.google.com/rss/articles/abc123');
    expect(items[0].source).toBe('Katadata');
    expect(items[0].pubDate).toContain('21 Oct 2026');
  });

  it('snippet: CDATA dikeluarkan, tag HTML dibuang, dipotong 180 karakter', () => {
    const items = parseGoogleNewsRss(SAMPLE_RSS);
    expect(items[0].snippet).not.toContain('<');
    expect(items[0].snippet).not.toContain('CDATA');
    expect(items[0].snippet.startsWith('Contoh Pertumbuhan')).toBe(true);
    expect(items[0].snippet.length).toBeLessThanOrEqual(183);
  });

  it('stripHtml & decodeEntities bekerja sendiri-sendiri', () => {
    expect(stripHtml('<p>Halo &amp; <b>dunia</b></p>')).toBe('Halo & dunia');
    expect(decodeEntities('A &amp; B &#39;C&#39; &lt;3')).toBe("A & B 'C' <3");
  });
});
