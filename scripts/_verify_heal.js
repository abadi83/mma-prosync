// Verifikasi hasil heal via API (temp)
const crypto = require('crypto');
const BASE = 'http://127.0.0.1:3000';
const secret = process.env.AUTH_SECRET || process.env.DB_PASSWORD || 'mma-prosync-auth-secret-v1';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const now = Math.floor(Date.now() / 1000);
const payload = { sub: 'e2e@mma.id', name: 'E2E', tokoId: process.env.DEFAULT_TOKO_ID || 'a0a0a0a0-0000-0000-0000-000000000001', role: 'admin', roles: ['admin'], iat: now, exp: now + 86400 };
const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
const sig = b64url(crypto.createHmac('sha256', secret).update(`v2.${body}`).digest());
const cookie = `auth_token=v2.${body}.${sig}`;

(async () => {
  const res = await fetch(`${BASE}/api/data?key=mma_hpp_purchases`, { headers: { Cookie: cookie } });
  const j = await res.json().catch(() => null);
  const list = Array.isArray(j?.data) ? j.data : null;
  if (!list) { console.log('RESPONSE SHAPE:', JSON.stringify(j).slice(0, 200)); return; }
  console.log('hpp items:', list.length);
  for (const po of ['01/07/2026', '02/07/2026', 'PO-260918-001', 'PO-260919-001', 'PO-261001-193']) {
    const items = list.filter(x => x.noPO === po);
    const total = items.reduce((s, i) => s + (i.total || 0), 0);
    const dibayar = items.reduce((s, i) => s + (i.dibayar || 0), 0);
    const lunas = items.every(i => i.lunas) && items.length > 0;
    console.log(`${po}: ${items.length} item, total=${total}, dibayar=${dibayar}, lunas=${lunas}, adaUpdatedAt=${items.some(i => typeof i.updatedAt === 'number')}`);
  }
})().catch(e => console.error('FAIL', e.message));
