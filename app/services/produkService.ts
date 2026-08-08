export interface ProdukItem {
  id: string;
  nama: string;
  kategoriId: string;
  kategoriNama: string;
  hargaBeli: number;
  hargaJual: number;
  stokMin: number;
}

let store: ProdukItem[] = [
  { id: 'p-1', nama: 'Minyak Goreng', kategoriId: 'k-1', kategoriNama: 'Kebutuhan Rumah Tangga', hargaBeli: 12000, hargaJual: 15000, stokMin: 10 },
  { id: 'p-2', nama: 'Beras Premium', kategoriId: 'k-2', kategoriNama: 'Sembako', hargaBeli: 50000, hargaJual: 65000, stokMin: 10 },
];

export async function getProduk(): Promise<ProdukItem[]> { return store; }

export async function createProduk(data: Omit<ProdukItem, 'id'>): Promise<ProdukItem> {
  const item: ProdukItem = { id: `p-${Date.now()}`, ...data };
  store.push(item);
  return item;
}

export async function updateProduk(id: string, data: Omit<ProdukItem, 'id'>): Promise<ProdukItem | null> {
  const idx = store.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  store[idx] = { id, ...data };
  return store[idx];
}

export async function deleteProduk(id: string): Promise<boolean> {
  const len = store.length;
  store = store.filter((p) => p.id !== id);
  return store.length < len;
}
