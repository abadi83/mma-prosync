export function paymentRemaining(total: number, allocated: number, recorded: number): number {
  // Data lama bisa punya alokasi tanpa riwayat, atau riwayat lebih besar dari alokasi.
  // Jangan anggap keduanya sebagai pembayaran terpisah.
  return Math.max(0, total - Math.max(allocated, recorded));
}

export function paymentAmountError(amount: number, remaining: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Jumlah pembayaran harus lebih dari 0.';
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Tagihan sudah lunas atau tidak tersedia. Muat ulang sebelum mencoba lagi.';
  if (amount > remaining) return `Maks Rp ${remaining.toLocaleString('id-ID')}.`;
  return null;
}
