interface Notif { id: string; tipe: string; pesan: string; dibaca: boolean; tanggal: string; }
let store: Notif[] = [
  { id:'n-1',tipe:'stok',pesan:'⚠ Stok Minyak Goreng menipis (8/10)',dibaca:false,tanggal:'2026-08-02 10:00' },
  { id:'n-2',tipe:'penjualan',pesan:'📊 Penjualan hari ini: Rp 1.845.000',dibaca:true,tanggal:'2026-08-02 08:00' },
];
export async function getNotifikasi() { return store; }
export async function markRead(id: string) { const n = store.find(x=>x.id===id); if(n) n.dibaca=true; return n; }
export async function markAllRead() { store.forEach(n=>n.dibaca=true); }
