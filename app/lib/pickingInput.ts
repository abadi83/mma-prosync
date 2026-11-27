type PickingMatch = { noPesanan: string; noResi: string };

export function parsePickingInput(input: string, rows: readonly Pick<PickingMatch, 'noPesanan'>[]): PickingMatch[] {
  const orderNumbers = new Set(rows.map(row => row.noPesanan));
  return input.split(/[\r\n,;]+/).map(line => line.trim()).filter(Boolean).map(line => {
    const [code, resi] = line.split(/\s+/);
    if (resi) return { noPesanan: code, noResi: resi };
    // Pertahankan prioritas nomor pesanan bila kode kebetulan juga dipakai sebagai resi.
    return orderNumbers.has(code) ? { noPesanan: code, noResi: '' } : { noPesanan: '', noResi: code };
  });
}
