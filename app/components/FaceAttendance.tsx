'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/* ── Types ── */
interface FaceData {
  pegawaiId: string;
  nik: string;
  nama: string;
  descriptor: number[];  // face descriptor array
  registeredAt: string;
}

interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

interface AbsensiFaceRecord {
  id: string;
  pegawaiId: string;
  nama: string;
  nik: string;
  tanggal: string;
  jam: string;
  jenis: 'masuk' | 'pulang';
  lokasi: GeoPosition;
  confidence: number;
}

// Koordinat kantor (default: Jakarta Pusat — bisa dikustomisasi)
const OFFICE_LOCATION = { lat: -6.2088, lng: 106.8456, radiusKm: 2.0 };

/* ── Helpers ── */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const FACE_STORAGE_KEY = 'mma_face_data';
const ABSENSI_FACE_KEY = 'mma_absensi_face';

function loadFaceData(): FaceData[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FACE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFaceData(data: FaceData[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(FACE_STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadAbsensiFace(): AbsensiFaceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ABSENSI_FACE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAbsensiFace(records: AbsensiFaceRecord[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(ABSENSI_FACE_KEY, JSON.stringify(records)); } catch { /* ignore */ }
}

/* ── face-api.js CDN ── */
const FACEAPI_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODEL_BASE = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

// Global promise untuk load face-api (biar gak double-load)
let faceApiLoadPromise: Promise<void> | null = null;

function loadFaceApiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('SSR');
  if ((window as any).faceapi) return Promise.resolve();
  if (faceApiLoadPromise) return faceApiLoadPromise;

  faceApiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = FACEAPI_CDN;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { faceApiLoadPromise = null; reject(new Error('Gagal memuat face-api.js')); };
    document.head.appendChild(script);
  });
  return faceApiLoadPromise;
}

function getFaceApi() {
  return (window as any).faceapi;
}

interface PegawaiSimple {
  id: string;
  nama: string;
  nik: string;
}

interface Props {
  pegawai: PegawaiSimple[];
  isAdmin?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function FaceAttendance({ pegawai, isAdmin = true }: Props) {
  const [mode, setMode] = useState<'menu' | 'register' | 'absensi' | 'riwayat'>('menu');
  const [selectedPegawai, setSelectedPegawai] = useState(pegawai[0]?.id || '');

  // Jika bukan admin dan masuk ke register, redirect ke menu
  if (!isAdmin && mode === 'register') setMode('menu');

  return (
    <div>
      <div className="mb-1 h-1 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-400" />
      <h2 className="text-lg font-bold text-slate-800 sm:text-xl">🤳 Face Absensi</h2>
      <p className="mt-1 text-sm text-slate-500">Absensi dengan pengenalan wajah & verifikasi lokasi — anti titip absen.</p>

      {mode === 'menu' && (
        <div className={`mt-6 grid gap-4 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {/* Daftar Wajah — hanya Admin */}
          {isAdmin && (
            <button onClick={() => setMode('register')}
              className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-6 text-center hover:border-purple-400 transition group">
              <p className="text-5xl mb-3">📸</p>
              <p className="font-bold text-purple-700 group-hover:text-purple-900">Daftar Wajah</p>
              <p className="text-xs text-purple-500 mt-1">Ambil foto wajah untuk dikenali sistem</p>
            </button>
          )}
          <button onClick={() => setMode('absensi')}
            className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center hover:border-emerald-400 transition group">
            <p className="text-5xl mb-3">✅</p>
            <p className="font-bold text-emerald-700 group-hover:text-emerald-900">Absen Sekarang</p>
            <p className="text-xs text-emerald-500 mt-1">Face recognize + GPS — hadir dalam 3 detik</p>
          </button>
          <button onClick={() => setMode('riwayat')}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-center hover:border-slate-400 transition group">
            <p className="text-5xl mb-3">📜</p>
            <p className="font-bold text-slate-700 group-hover:text-slate-900">Riwayat Absen</p>
            <p className="text-xs text-slate-500 mt-1">Lihat log absensi face recognition</p>
          </button>
        </div>
      )}

      {mode === 'register' && (
        <FaceRegister
          pegawai={pegawai}
          selectedPegawai={selectedPegawai}
          onSelectPegawai={setSelectedPegawai}
          onBack={() => setMode('menu')}
        />
      )}

      {mode === 'absensi' && (
        <FaceAbsensi
          pegawai={pegawai}
          selectedPegawai={selectedPegawai}
          onSelectPegawai={setSelectedPegawai}
          onBack={() => setMode('menu')}
        />
      )}

      {mode === 'riwayat' && (
        <RiwayatAbsensiFace onBack={() => setMode('menu')} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* FACE REGISTRATION                                                 */
/* ═══════════════════════════════════════════════════════════════════ */
function FaceRegister({ pegawai, selectedPegawai, onSelectPegawai, onBack }: {
  pegawai: PegawaiSimple[];
  selectedPegawai: string;
  onSelectPegawai: (id: string) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'init' | 'loading' | 'ready' | 'capturing' | 'done' | 'error'>('init');
  const [error, setError] = useState('');
  const [capturedCount, setCapturedCount] = useState(0);
  const descriptorsRef = useRef<Float32Array[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [existingFaces, setExistingFaces] = useState<FaceData[]>([]);

  const selected = pegawai.find(p => p.id === selectedPegawai);

  // Cek existing faces
  useEffect(() => {
    setExistingFaces(loadFaceData().filter(f => f.pegawaiId === selectedPegawai));
  }, [selectedPegawai]);

  // Cleanup stream
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      await loadFaceApiScript();
      const faceapi = getFaceApi();
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE);

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      descriptorsRef.current = [];
      setCapturedCount(0);
      setState('ready');
    } catch (e: any) {
      setError(e.message || 'Gagal mengakses kamera');
      setState('error');
    }
  }, []);

  const captureFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const faceapi = getFaceApi();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setState('capturing');

    // Detect face & get descriptor
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      setError('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.');
      setState('ready');
      return;
    }

    // Draw on canvas
    ctx.drawImage(video, 0, 0);
    const dims = faceapi.matchDimensions(canvas, video, true);
    const resized = faceapi.resizeResults(detection, dims);
    faceapi.draw.drawDetections(canvas, resized);

    descriptorsRef.current.push(detection.descriptor);
    setCapturedCount(prev => prev + 1);
    setError('');
    setState('ready');
  }, []);

  const saveRegistration = useCallback(() => {
    if (descriptorsRef.current.length === 0 || !selected) {
      setError('Ambil minimal 1 foto wajah terlebih dahulu.');
      return;
    }

    // Average descriptors
    const avgDescriptor = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      let sum = 0;
      for (const d of descriptorsRef.current) sum += d[i];
      avgDescriptor[i] = sum / descriptorsRef.current.length;
    }

    const allFaces = loadFaceData();
    // Hapus data lama pegawai ini
    const filtered = allFaces.filter(f => f.pegawaiId !== selected.id);
    const newFace: FaceData = {
      pegawaiId: selected.id,
      nik: selected.nik,
      nama: selected.nama,
      descriptor: Array.from(avgDescriptor),
      registeredAt: new Date().toISOString(),
    };
    filtered.push(newFace);
    saveFaceData(filtered);
    setExistingFaces([newFace]);
    setState('done');
  }, [selected]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleBack = () => {
    stopCamera();
    onBack();
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handleBack} className="text-sm text-purple-600 hover:text-purple-800 font-semibold">← Kembali</button>
        {state === 'ready' && <span className="text-xs text-slate-400">📸 {capturedCount} foto diambil</span>}
      </div>

      {/* Pilih Pegawai */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Pegawai</label>
        <select value={selectedPegawai} onChange={e => { onSelectPegawai(e.target.value); stopCamera(); setState('init'); }}
          className="w-full rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700 focus:border-purple-500 focus:outline-none">
          {pegawai.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.nik})</option>)}
        </select>
      </div>

      {/* Status: sudah terdaftar */}
      {existingFaces.length > 0 && state === 'init' && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm font-semibold text-emerald-700">✅ Wajah sudah terdaftar</p>
          <p className="text-xs text-emerald-500 mt-1">Terdaftar: {new Date(existingFaces[0].registeredAt).toLocaleString('id-ID')}</p>
          <p className="text-xs text-slate-400 mt-2">Klik "Buka Kamera" untuk mendaftar ulang.</p>
        </div>
      )}

      {/* Camera view */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {state === 'init' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
            <button onClick={startCamera} className="rounded-xl bg-purple-500 px-6 py-3 text-white font-bold hover:bg-purple-600 transition">
              📸 Buka Kamera
            </button>
          </div>
        )}
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
            <div className="text-white text-center">
              <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Memuat model AI...</p>
            </div>
          </div>
        )}
        {state === 'capturing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30">
            <p className="text-white text-lg font-bold animate-pulse">📸 Memproses...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      {state === 'ready' && (
        <div className="mt-3 flex gap-3">
          <button onClick={captureFace} className="flex-1 rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-600 transition">
            📸 Ambil Foto ({capturedCount})
          </button>
          <button onClick={saveRegistration} disabled={capturedCount === 0}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-slate-300 transition">
            💾 Simpan Pendaftaran
          </button>
        </div>
      )}

      {state === 'done' && (
        <div className="mt-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-6 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-lg font-bold text-emerald-700">Pendaftaran Wajah Berhasil!</p>
          <p className="text-sm text-emerald-600 mt-1">{selected?.nama} — {capturedCount} foto diproses</p>
          <button onClick={handleBack} className="mt-4 rounded-xl bg-emerald-500 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">✅ Selesai</button>
        </div>
      )}

      {state === 'error' && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-600">❌ {error}</p>
          <button onClick={startCamera} className="mt-2 text-sm text-red-500 underline">Coba Lagi</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* FACE ABSENSI (Recognize + Geo)                                    */
/* ═══════════════════════════════════════════════════════════════════ */
function FaceAbsensi({ pegawai, selectedPegawai, onSelectPegawai, onBack }: {
  pegawai: PegawaiSimple[];
  selectedPegawai: string;
  onSelectPegawai: (id: string) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'init' | 'choose' | 'loading' | 'ready' | 'scanning' | 'success' | 'error'>('init');
  const [jenisAbsen, setJenisAbsen] = useState<'masuk' | 'pulang'>('masuk');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ nama: string; confidence: number; jam: string; jenis: 'masuk' | 'pulang'; lokasi: GeoPosition } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selected = pegawai.find(p => p.id === selectedPegawai);

  // Cek apakah sudah absen masuk hari ini
  const todayRecords = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return loadAbsensiFace().filter(r => r.tanggal === today);
  }, []);

  const sudahMasuk = todayRecords.some(r => r.jenis === 'masuk' && r.pegawaiId === selectedPegawai);
  const sudahPulang = todayRecords.some(r => r.jenis === 'pulang' && r.pegawaiId === selectedPegawai);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startScanning = useCallback(async (jenis: 'masuk' | 'pulang') => {
    setJenisAbsen(jenis);
    setState('loading');
    setError('');

    // Cek apakah wajah sudah terdaftar
    const faces = loadFaceData();
    if (faces.length === 0) {
      setError('Belum ada data wajah terdaftar. Silakan daftarkan wajah terlebih dahulu.');
      setState('error');
      return;
    }

    // Request geo-location dulu
    let geoPos: GeoPosition | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      geoPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch {
      setError('Gagal mendapatkan lokasi GPS. Pastikan GPS aktif dan izinkan akses lokasi.');
      setState('error');
      return;
    }

    // Cek jarak ke kantor
    const distance = getDistanceKm(geoPos.lat, geoPos.lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    if (distance > OFFICE_LOCATION.radiusKm) {
      setError(`Anda berada di luar area kantor (${distance.toFixed(1)} km dari kantor). Maksimal radius: ${OFFICE_LOCATION.radiusKm} km.`);
      setState('error');
      return;
    }

    try {
      await loadFaceApiScript();
      const faceapi = getFaceApi();
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE);

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('ready');

      // Auto-scan setelah 1 detik
      setTimeout(async () => {
        if (!videoRef.current) return;
        setState('scanning');

        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
          stopCamera();
          setError('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas.');
          setState('error');
          return;
        }

        const labeledDescriptors = faces.map(f => new faceapi.LabeledFaceDescriptors(f.nama, [new Float32Array(f.descriptor)]));
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        if (canvasRef.current && videoRef.current) {
          const canvas = canvasRef.current;
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
            const resized = faceapi.resizeResults(detection, dims);
            faceapi.draw.drawDetections(canvas, resized);
          }
        }

        stopCamera();

        const confidence = Math.round((1 - bestMatch.distance) * 100);

        if (bestMatch.label === 'unknown' || confidence < 50) {
          setError(`Wajah tidak dikenali (confidence: ${confidence}%). Pastikan Anda sudah mendaftarkan wajah.`);
          setState('error');
          return;
        }

        const jam = new Date().toLocaleTimeString('id-ID');
        const matchedFace = faces.find(f => f.nama === bestMatch.label);

        // Simpan ke riwayat
        if (matchedFace) {
          const records = loadAbsensiFace();
          records.unshift({
            id: `face-${Date.now()}`,
            pegawaiId: matchedFace.pegawaiId,
            nama: matchedFace.nama,
            nik: matchedFace.nik,
            tanggal: new Date().toISOString().slice(0, 10),
            jam,
            jenis,
            lokasi: geoPos!,
            confidence,
          });
          saveAbsensiFace(records.slice(0, 50));
        }

        setResult({
          nama: bestMatch.label,
          confidence,
          jam,
          jenis,
          lokasi: geoPos!,
        });
        setState('success');
      }, 1500);

    } catch (e: any) {
      stopCamera();
      setError(e.message || 'Gagal mengakses kamera');
      setState('error');
    }
  }, [selectedPegawai]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleBack = () => {
    stopCamera();
    onBack();
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handleBack} className="text-sm text-purple-600 hover:text-purple-800 font-semibold">← Kembali</button>
        {state === 'ready' && <span className="text-xs text-slate-400 animate-pulse">🔍 Mencari wajah...</span>}
        {jenisAbsen === 'masuk' && (state === 'ready' || state === 'scanning') && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">🟢 Masuk</span>
        )}
        {jenisAbsen === 'pulang' && (state === 'ready' || state === 'scanning') && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">🟠 Pulang</span>
        )}
      </div>

      {/* Camera view */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {state === 'init' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 gap-4 p-4">
            <p className="text-white text-lg font-bold mb-2">Pilih Jenis Absensi</p>

            {/* Status hari ini */}
            <div className="flex gap-2 text-xs">
              {sudahMasuk ? (
                <span className="rounded-full bg-emerald-500/80 px-3 py-1 text-white">✅ Sudah Masuk</span>
              ) : (
                <span className="rounded-full bg-slate-500/60 px-3 py-1 text-white">⬜ Belum Masuk</span>
              )}
              {sudahPulang ? (
                <span className="rounded-full bg-orange-500/80 px-3 py-1 text-white">✅ Sudah Pulang</span>
              ) : (
                <span className="rounded-full bg-slate-500/60 px-3 py-1 text-white">⬜ Belum Pulang</span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => startScanning('masuk')}
                disabled={sudahMasuk}
                className={`rounded-xl px-6 py-3 text-white font-bold text-lg transition shadow-lg ${
                  sudahMasuk
                    ? 'bg-slate-400 cursor-not-allowed opacity-50'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                🟢 Absen Masuk
              </button>
              <button
                onClick={() => startScanning('pulang')}
                disabled={sudahPulang || !sudahMasuk}
                className={`rounded-xl px-6 py-3 text-white font-bold text-lg transition shadow-lg ${
                  sudahPulang || !sudahMasuk
                    ? 'bg-slate-400 cursor-not-allowed opacity-50'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                🟠 Absen Pulang
              </button>
            </div>
            {!sudahMasuk && (
              <p className="text-xs text-white/60">Absen Masuk dulu sebelum bisa Absen Pulang.</p>
            )}
          </div>
        )}
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
            <div className="text-white text-center">
              <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Memuat AI & mendeteksi lokasi...</p>
            </div>
          </div>
        )}
        {state === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30">
            <div className="text-white text-center">
              <div className="animate-pulse text-4xl mb-3">🤖</div>
              <p className="text-lg font-bold">Mengenali wajah...</p>
              <p className="text-xs mt-1 opacity-70">Tahan posisi, jangan bergerak</p>
            </div>
          </div>
        )}
      </div>

      {/* Info geo */}
      {state === 'ready' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 justify-center">
          <span>📍 GPS aktif</span>
          <span>•</span>
          <span>🎯 Face recognition aktif</span>
        </div>
      )}

      {/* Success */}
      {state === 'success' && result && (
        <div className={`mt-4 rounded-2xl border-2 p-6 text-center ${result.jenis === 'masuk' ? 'bg-emerald-50 border-emerald-300' : 'bg-orange-50 border-orange-300'}`}>
          <p className="text-5xl mb-3">{result.jenis === 'masuk' ? '🟢' : '🟠'}</p>
          <p className={`text-lg font-bold ${result.jenis === 'masuk' ? 'text-emerald-700' : 'text-orange-700'}`}>
            Absen {result.jenis === 'masuk' ? 'Masuk' : 'Pulang'} Berhasil!
          </p>
          <p className={`text-2xl font-bold mt-2 ${result.jenis === 'masuk' ? 'text-emerald-600' : 'text-orange-600'}`}>{result.nama}</p>
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-slate-600">
            <span>🕐 {result.jam}</span>
            <span>🎯 {result.confidence}% match</span>
            <span>📍 {result.lokasi.lat.toFixed(4)}, {result.lokasi.lng.toFixed(4)}</span>
          </div>
          <button onClick={handleBack} className="mt-5 rounded-xl bg-purple-500 px-6 py-2 text-sm font-semibold text-white hover:bg-purple-600 transition">👍 Selesai</button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-5">
          <p className="text-sm font-semibold text-red-600">❌ {error}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => startScanning(jenisAbsen)} className="rounded-lg bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-200">🔄 Coba Lagi</button>
            <button onClick={handleBack} className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">← Kembali</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* RIWAYAT ABSENSI FACE                                              */
/* ═══════════════════════════════════════════════════════════════════ */
function RiwayatAbsensiFace({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<AbsensiFaceRecord[]>([]);

  useEffect(() => {
    setRecords(loadAbsensiFace());
  }, []);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-sm text-purple-600 hover:text-purple-800 font-semibold">← Kembali</button>
        {records.length > 0 && (
          <button onClick={() => { saveAbsensiFace([]); setRecords([]); }}
            className="text-xs text-red-400 hover:text-red-600">Hapus Semua</button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-5xl mb-3">📜</p>
          <p className="font-semibold">Belum ada riwayat absensi.</p>
          <p className="text-sm mt-1">Lakukan absensi face recognition terlebih dahulu.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead><tr className="bg-purple-50 text-xs uppercase text-purple-500">
              {['Tanggal','Jam','Jenis','Nama','NIK','Match','Lokasi'].map(c => <th key={c} className="px-3 py-3 font-semibold whitespace-nowrap">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-purple-50/20">
                  <td className="px-3 py-2.5 text-slate-600">{r.tanggal}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-slate-700">{r.jam}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.jenis === 'masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {r.jenis === 'masuk' ? '🟢 Masuk' : '🟠 Pulang'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700">{r.nama}</td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">{r.nik}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.confidence >= 80 ? 'bg-emerald-100 text-emerald-700' : r.confidence >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {r.confidence}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[10px] text-slate-400">
                    {r.lokasi.lat.toFixed(4)}, {r.lokasi.lng.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
