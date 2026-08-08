let store: { email: string; password: string; namaToko: string }[] = [
  { email: 'demo@mma.id', password: 'demo123', namaToko: 'Toko Berkah Abadi' },
];

type AuthResult<T> = T extends void ? { success: true; email: string; namaToko: string } : { token: string; email: string; namaToko: string };

export async function registerUser(namaToko: string, email: string, password: string): Promise<{ success: true; email: string; namaToko: string } | { error: string }> {
  if (store.find((u) => u.email === email)) return { error: 'Email sudah terdaftar.' };
  store.push({ email, password, namaToko });
  return { success: true, email, namaToko };
}

export async function loginUser(email: string, password: string): Promise<{ token: string; email: string; namaToko: string } | { error: string }> {
  const user = store.find((u) => u.email === email && u.password === password);
  if (!user) return { error: 'Email atau password salah.' };
  const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return { token, email: user.email, namaToko: user.namaToko };
}
