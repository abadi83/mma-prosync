import { describe, expect, it } from 'vitest';
import { parsePickingInput } from './pickingInput';

describe('parsePickingInput', () => {
  it('menerima nomor pesanan, resi, dan pasangan lama dalam satu input', () => {
    expect(parsePickingInput(' ORD1, RES1; ORD2 RES2\r\nORD3\tRES3 ', [{ noPesanan: 'ORD1' }])).toEqual([
      { noPesanan: 'ORD1', noResi: '' },
      { noPesanan: '', noResi: 'RES1' },
      { noPesanan: 'ORD2', noResi: 'RES2' },
      { noPesanan: 'ORD3', noResi: 'RES3' },
    ]);
  });

  it('mengabaikan pemisah tanpa kode', () => {
    expect(parsePickingInput(' , ;\r\n ', [])).toEqual([]);
  });
});
