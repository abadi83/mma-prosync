let toko = { nama: 'Toko Berkah Abadi', alamat: 'Jl. Merdeka No. 10, Jakarta', logo: '' };

export async function getInfoToko() { return toko; }
export async function updateInfoToko(data: Partial<typeof toko>) { toko = { ...toko, ...data }; return toko; }
