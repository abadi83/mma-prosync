export interface SupplierItem { id: string; nama: string; kontak: string; alamat: string; }
let store: SupplierItem[] = [
  { id: 's-1', nama: 'PT Sinar Jaya Steel', kontak: '021-5555-1234', alamat: 'Jl. Industri Raya No. 45, Cikarang, Bekasi' },
];
export async function getSupplier() { return store; }
export async function createSupplier(nama: string, kontak: string, alamat: string) { const item = { id: `s-${Date.now()}`, nama, kontak: kontak||'-', alamat: alamat||'' }; store.push(item); return item; }
export async function updateSupplier(id: string, nama: string, kontak: string, alamat: string) { const idx = store.findIndex(s => s.id===id); if(idx===-1) return null; store[idx]={id,nama,kontak:kontak||'-',alamat:alamat||''}; return store[idx]; }
export async function deleteSupplier(id: string) { const len=store.length; store=store.filter(s=>s.id!==id); return store.length<len; }
