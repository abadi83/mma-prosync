export interface KategoriItem {
  id: string;
  nama: string;
}

let store: KategoriItem[] = [
  { id: 'k-1', nama: 'Kebutuhan Rumah Tangga' },
  { id: 'k-2', nama: 'Sembako' },
  { id: 'k-3', nama: 'Minuman' },
];

export async function getKategori(): Promise<KategoriItem[]> {
  return store;
}

export async function createKategori(nama: string): Promise<KategoriItem> {
  const item: KategoriItem = { id: `k-${Date.now()}`, nama };
  store.push(item);
  return item;
}

export async function updateKategori(id: string, nama: string): Promise<KategoriItem | null> {
  const idx = store.findIndex((k) => k.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], nama };
  return store[idx];
}

export async function deleteKategori(id: string): Promise<boolean> {
  const len = store.length;
  store = store.filter((k) => k.id !== id);
  return store.length < len;
}
