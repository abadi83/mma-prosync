export interface PelangganItem { id: string; nama: string; kontak: string; }

let store: PelangganItem[] = [
  { id: 'pl-1', nama: 'Budi Santoso', kontak: '0812-3456-7890' },
  { id: 'pl-2', nama: 'Siti Aminah', kontak: '0856-7890-1234' },
];

export async function getPelanggan() { return store; }
export async function createPelanggan(nama: string, kontak: string) { const item = { id: `pl-${Date.now()}`, nama, kontak: kontak || '-' }; store.push(item); return item; }
export async function updatePelanggan(id: string, nama: string, kontak: string) { const idx = store.findIndex(p => p.id === id); if (idx === -1) return null; store[idx] = { id, nama, kontak: kontak || '-' }; return store[idx]; }
export async function deletePelanggan(id: string) { const len = store.length; store = store.filter(p => p.id !== id); return store.length < len; }
