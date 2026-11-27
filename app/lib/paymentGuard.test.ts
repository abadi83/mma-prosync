import { describe, expect, it } from 'vitest';
import { paymentAmountError, paymentRemaining } from './paymentGuard';

describe('paymentGuard', () => {
  it('tetap mengizinkan cicilan dan pelunasan yang pas', () => {
    const remaining = paymentRemaining(100_000, 40_000, 40_000);
    expect(remaining).toBe(60_000);
    expect(paymentAmountError(20_000, remaining)).toBeNull();
    expect(paymentAmountError(60_000, remaining)).toBeNull();
    expect(paymentAmountError(60_001, remaining)).not.toBeNull();
  });

  it('menolak pembayaran ketika riwayat sudah menutup tagihan walau alokasi tertinggal', () => {
    expect(paymentAmountError(1, paymentRemaining(100_000, 0, 100_000))).not.toBeNull();
    expect(paymentRemaining(100_000, 100_000, 200_000)).toBe(0);
  });

  it('menghormati alokasi lama tanpa riwayat dan menolak nilai tidak valid', () => {
    expect(paymentRemaining(100_000, 25_000, 0)).toBe(75_000);
    for (const amount of [0, -1, NaN, Infinity]) expect(paymentAmountError(amount, 75_000)).not.toBeNull();
    expect(paymentAmountError(1, NaN)).not.toBeNull();
  });
});
