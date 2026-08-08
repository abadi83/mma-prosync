export interface LabaRugiResponse {
  pendapatan: number;
  hargaPokok: number;
  biayaOperasional: number;
  biayaLain: number;
  labaKotor: number;
  labaBersih: number;
  marginKotor: number;
  marginBersih: number;
}

const MOCK = {
  pendapatan: 8450000,
  hargaPokok: 5200000,
  biayaOperasional: 1200000,
  biayaLain: 350000,
};

export async function getLabaRugi(_tokoId: string, _periode?: string): Promise<LabaRugiResponse> {
  const labaKotor = MOCK.pendapatan - MOCK.hargaPokok;
  const labaBersih = labaKotor - MOCK.biayaOperasional - MOCK.biayaLain;
  return {
    ...MOCK,
    labaKotor,
    labaBersih,
    marginKotor: parseFloat(((labaKotor / MOCK.pendapatan) * 100).toFixed(1)),
    marginBersih: parseFloat(((labaBersih / MOCK.pendapatan) * 100).toFixed(1)),
  };
}
