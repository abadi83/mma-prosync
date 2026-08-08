let profil = { nama: 'Bapak Arif', email: 'demo@mma.id', telepon: '0812-3456-7890', avatar: '' };

export async function getProfil() { return profil; }
export async function updateProfil(data: Partial<typeof profil>) { profil = { ...profil, ...data }; return profil; }
