'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

/* ================================================================ */
/* Types                                                             */
/* ================================================================ */

export interface CoaAccount {
  id: string;
  kodeAkun: string;       // '1-1000'
  namaAkun: string;       // 'Kas di Bank'
  tipeAkun: 'ASET' | 'KEWAJIBAN' | 'EKUITAS' | 'PENDAPATAN' | 'BEBAN';
  saldoNormal: 'DEBIT' | 'KREDIT';
  keterangan: string;
}

export interface JurnalEntry {
  id: string;
  tanggal: string;
  akunDebitId: string;   // kodeAkun
  akunKreditId: string;  // kodeAkun
  nominal: number;
  keterangan: string;
  referensi: string;     // noPO, noPesanan, dll
  createdAt: string;
}

export interface AsetTetap {
  id: string;
  namaAset: string;
  kategori: string;
  tanggalPerolehan: string;
  hargaPerolehan: number;
  masaManfaat: number;   // tahun
  nilaiSisa: number;
  akumulasiDepresiasi: number;
}

export interface ModalEntry {
  id: string;
  jenis: 'AWAL' | 'TAMBAHAN';
  tanggal: string;
  jumlah: number;
  keterangan: string;
}

/* ================================================================ */
/* Storage Keys                                                      */
/* ================================================================ */

const COA_STORAGE = 'mma_coa';
const JURNAL_STORAGE = 'mma_jurnal_umum';
const ASET_STORAGE = 'mma_aset_tetap';
const MODAL_STORAGE = 'mma_modal';

/* ================================================================ */
/* Seed COA                                                          */
/* ================================================================ */

export const DEFAULT_COA: CoaAccount[] = [
  // ASET
  { id: 'coa-1', kodeAkun: '1-1000', namaAkun: 'Kas di Bank', tipeAkun: 'ASET', saldoNormal: 'DEBIT', keterangan: 'Kas dan setara kas' },
  { id: 'coa-2', kodeAkun: '1-1100', namaAkun: 'Piutang Usaha', tipeAkun: 'ASET', saldoNormal: 'DEBIT', keterangan: 'Piutang dari penjualan marketplace' },
  { id: 'coa-3', kodeAkun: '1-1200', namaAkun: 'Persediaan Barang', tipeAkun: 'ASET', saldoNormal: 'DEBIT', keterangan: 'Nilai persediaan SKU' },
  { id: 'coa-4', kodeAkun: '1-2000', namaAkun: 'Aset Tetap', tipeAkun: 'ASET', saldoNormal: 'DEBIT', keterangan: 'Peralatan, kendaraan, dll' },
  { id: 'coa-5', kodeAkun: '1-2100', namaAkun: 'Akumulasi Depresiasi', tipeAkun: 'ASET', saldoNormal: 'KREDIT', keterangan: 'Akumulasi penyusutan aset tetap' },
  // KEWAJIBAN
  { id: 'coa-6', kodeAkun: '2-1000', namaAkun: 'Utang Usaha (SKU)', tipeAkun: 'KEWAJIBAN', saldoNormal: 'KREDIT', keterangan: 'Utang pembelian barang dagang' },
  { id: 'coa-7', kodeAkun: '2-1100', namaAkun: 'Utang Beban (OPEX)', tipeAkun: 'KEWAJIBAN', saldoNormal: 'KREDIT', keterangan: 'Utang beban operasional' },
  // EKUITAS
  { id: 'coa-8', kodeAkun: '3-1000', namaAkun: 'Modal Pemilik', tipeAkun: 'EKUITAS', saldoNormal: 'KREDIT', keterangan: 'Modal awal dan tambahan' },
  { id: 'coa-9', kodeAkun: '3-1100', namaAkun: 'Laba Ditahan', tipeAkun: 'EKUITAS', saldoNormal: 'KREDIT', keterangan: 'Akumulasi laba/rugi' },
  // PENDAPATAN
  { id: 'coa-10', kodeAkun: '4-1000', namaAkun: 'Pendapatan Usaha', tipeAkun: 'PENDAPATAN', saldoNormal: 'KREDIT', keterangan: 'Pendapatan dari penjualan' },
  // BEBAN
  { id: 'coa-11', kodeAkun: '5-1000', namaAkun: 'HPP (Harga Pokok Penjualan)', tipeAkun: 'BEBAN', saldoNormal: 'DEBIT', keterangan: 'Harga pokok barang terjual' },
  { id: 'coa-12', kodeAkun: '5-2000', namaAkun: 'Beban Operasional', tipeAkun: 'BEBAN', saldoNormal: 'DEBIT', keterangan: 'OPEX, packing, ATK, dll' },
  { id: 'coa-13', kodeAkun: '5-3000', namaAkun: 'Beban Depresiasi', tipeAkun: 'BEBAN', saldoNormal: 'DEBIT', keterangan: 'Penyusutan aset tetap' },
];

/* ================================================================ */
/* Context Type                                                      */
/* ================================================================ */

interface AkuntansiContextType {
  coa: CoaAccount[];
  jurnal: JurnalEntry[];
  aset: AsetTetap[];
  modal: ModalEntry[];

  // COA
  getCoaByKode: (kode: string) => CoaAccount | undefined;

  // Jurnal
  addJurnal: (entry: Omit<JurnalEntry, 'id' | 'createdAt'>) => JurnalEntry;
  deleteJurnal: (id: string) => void;

  // Aset
  addAset: (a: Omit<AsetTetap, 'id' | 'akumulasiDepresiasi'>) => AsetTetap;
  updateDepresiasi: (id: string, jumlah: number) => void;

  // Modal
  addModal: (m: Omit<ModalEntry, 'id'>) => ModalEntry;

  // Reporting
  getSaldoAkun: (kodeAkun: string, sampaiTgl?: string) => number;
  getLabaRugi: (dari?: string, sampai?: string) => { pendapatan: number; beban: { hpp: number; operasional: number; depresiasi: number }; totalBeban: number; labaBersih: number };
  getNeraca: (sampaiTgl?: string) => { aset: { kas: number; piutang: number; persediaan: number; asetTetap: number; akumDepre: number }; totalAset: number; kewajiban: { utangSku: number; utangOpex: number }; totalKewajiban: number; ekuitas: { modal: number; labaDitahan: number }; totalEkuitas: number; seimbang: boolean };
}

const AkuntansiContext = createContext<AkuntansiContextType | null>(null);

/* ================================================================ */
/* Helper: localStorage                                              */
/* ================================================================ */

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}

function saveToStorage<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

/* ================================================================ */
/* Provider                                                          */
/* ================================================================ */

export function AkuntansiProvider({ children }: { children: React.ReactNode }) {
  const [coa] = useState<CoaAccount[]>(() => loadFromStorage(COA_STORAGE, DEFAULT_COA));
  const [jurnal, setJurnal] = useState<JurnalEntry[]>(() => loadFromStorage(JURNAL_STORAGE, []));
  const [aset, setAset] = useState<AsetTetap[]>(() => loadFromStorage(ASET_STORAGE, []));
  const [modal, setModal] = useState<ModalEntry[]>(() => loadFromStorage(MODAL_STORAGE, []));
  const [hydrated, setHydrated] = useState(false);

  /* Hydrate dari localStorage setelah mount */
  useEffect(() => {
    const storedCoa = loadFromStorage(COA_STORAGE, DEFAULT_COA);
    const storedJurnal = loadFromStorage(JURNAL_STORAGE, [] as JurnalEntry[]);
    const storedAset = loadFromStorage(ASET_STORAGE, [] as AsetTetap[]);
    const storedModal = loadFromStorage(MODAL_STORAGE, [] as ModalEntry[]);
    if (JSON.stringify(storedCoa) !== JSON.stringify(coa)) {
      // COA tidak bisa diubah user, selalu pakai default
    }
    setJurnal(storedJurnal);
    setAset(storedAset);
    setModal(storedModal);
    setHydrated(true);
  }, []);

  /* Persist */
  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(JURNAL_STORAGE, jurnal);
  }, [jurnal, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(ASET_STORAGE, aset);
  }, [aset, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(MODAL_STORAGE, modal);
  }, [modal, hydrated]);

  /* ── COA ── */
  const getCoaByKode = useCallback((kode: string) => coa.find(c => c.kodeAkun === kode), [coa]);

  /* ── Jurnal ── */
  const addJurnal = useCallback((entry: Omit<JurnalEntry, 'id' | 'createdAt'>): JurnalEntry => {
    const newEntry: JurnalEntry = {
      ...entry,
      id: `jrl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setJurnal(prev => [newEntry, ...prev]);
    return newEntry;
  }, []);

  const deleteJurnal = useCallback((id: string) => {
    setJurnal(prev => prev.filter(j => j.id !== id));
  }, []);

  /* ── Aset ── */
  const addAset = useCallback((a: Omit<AsetTetap, 'id' | 'akumulasiDepresiasi'>): AsetTetap => {
    const newAset: AsetTetap = { ...a, id: `ast-${Date.now()}`, akumulasiDepresiasi: 0 };
    setAset(prev => [newAset, ...prev]);
    return newAset;
  }, []);

  const updateDepresiasi = useCallback((id: string, jumlah: number) => {
    setAset(prev => prev.map(a => a.id === id ? { ...a, akumulasiDepresiasi: a.akumulasiDepresiasi + jumlah } : a));
  }, []);

  /* ── Modal ── */
  const addModal = useCallback((m: Omit<ModalEntry, 'id'>): ModalEntry => {
    const newModal: ModalEntry = { ...m, id: `mod-${Date.now()}` };
    setModal(prev => [newModal, ...prev]);
    return newModal;
  }, []);

  /* ── Reporting: Saldo Akun ── */
  const getSaldoAkun = useCallback((kodeAkun: string, sampaiTgl?: string): number => {
    const akun = coa.find(c => c.kodeAkun === kodeAkun);
    if (!akun) return 0;

    const filtered = sampaiTgl
      ? jurnal.filter(j => j.tanggal <= sampaiTgl)
      : jurnal;

    let saldo = 0;
    filtered.forEach(j => {
      if (j.akunDebitId === kodeAkun) saldo += j.nominal;
      if (j.akunKreditId === kodeAkun) saldo -= j.nominal;
    });

    // Untuk akun dengan saldo normal KREDIT, saldo dibalik
    if (akun.saldoNormal === 'KREDIT') saldo = -saldo;
    return saldo;
  }, [coa, jurnal]);

  /* ── Reporting: Laba Rugi ── */
  const getLabaRugi = useCallback((dari?: string, sampai?: string) => {
    const filtered = jurnal.filter(j => {
      if (dari && j.tanggal < dari) return false;
      if (sampai && j.tanggal > sampai) return false;
      return true;
    });

    let pendapatan = 0;
    let hpp = 0;
    let operasional = 0;
    let depresiasi = 0;

    filtered.forEach(j => {
      // Pendapatan: kredit 4-1000
      if (j.akunKreditId === '4-1000') pendapatan += j.nominal;
      if (j.akunDebitId === '4-1000') pendapatan -= j.nominal;
      // HPP: debit 5-1000
      if (j.akunDebitId === '5-1000') hpp += j.nominal;
      if (j.akunKreditId === '5-1000') hpp -= j.nominal;
      // Operasional: debit 5-2000
      if (j.akunDebitId === '5-2000') operasional += j.nominal;
      if (j.akunKreditId === '5-2000') operasional -= j.nominal;
      // Depresiasi: debit 5-3000
      if (j.akunDebitId === '5-3000') depresiasi += j.nominal;
      if (j.akunKreditId === '5-3000') depresiasi -= j.nominal;
    });

    const totalBeban = hpp + operasional + depresiasi;
    return { pendapatan, beban: { hpp, operasional, depresiasi }, totalBeban, labaBersih: pendapatan - totalBeban };
  }, [jurnal]);

  /* ── Reporting: Neraca ── */
  const getNeraca = useCallback((sampaiTgl?: string) => {
    const filtered = sampaiTgl ? jurnal.filter(j => j.tanggal <= sampaiTgl) : jurnal;

    const saldo = (kode: string) => {
      let s = 0;
      filtered.forEach(j => {
        if (j.akunDebitId === kode) s += j.nominal;
        if (j.akunKreditId === kode) s -= j.nominal;
      });
      const akun = coa.find(c => c.kodeAkun === kode);
      if (akun && akun.saldoNormal === 'KREDIT') s = -s;
      return s;
    };

    const kas = saldo('1-1000');
    const piutang = saldo('1-1100');
    const persediaan = saldo('1-1200');
    const asetTetapBruto = saldo('1-2000');
    const akumDepre = saldo('1-2100');
    const totalAset = kas + piutang + persediaan + asetTetapBruto - akumDepre;

    const utangSku = saldo('2-1000');
    const utangOpex = saldo('2-1100');
    const totalKewajiban = utangSku + utangOpex;

    const modalPemilik = saldo('3-1000');
    const labaDitahan = saldo('3-1100');
    const totalEkuitas = modalPemilik + labaDitahan;

    const seimbang = Math.abs(totalAset - (totalKewajiban + totalEkuitas)) < 1;

    return {
      aset: { kas, piutang, persediaan, asetTetap: asetTetapBruto, akumDepre },
      totalAset,
      kewajiban: { utangSku, utangOpex },
      totalKewajiban,
      ekuitas: { modal: modalPemilik, labaDitahan },
      totalEkuitas,
      seimbang,
    };
  }, [coa, jurnal]);

  const value = useMemo(() => ({
    coa, jurnal, aset, modal,
    getCoaByKode, addJurnal, deleteJurnal,
    addAset, updateDepresiasi, addModal,
    getSaldoAkun, getLabaRugi, getNeraca,
  }), [coa, jurnal, aset, modal, getCoaByKode, addJurnal, deleteJurnal, addAset, updateDepresiasi, addModal, getSaldoAkun, getLabaRugi, getNeraca]);

  return (
    <AkuntansiContext.Provider value={value}>
      {children}
    </AkuntansiContext.Provider>
  );
}

export function useAkuntansi() {
  const ctx = useContext(AkuntansiContext);
  if (!ctx) throw new Error('useAkuntansi must be used within AkuntansiProvider');
  return ctx;
}
