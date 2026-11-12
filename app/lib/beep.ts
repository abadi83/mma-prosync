'use client';

/** Mainkan bunyi pendek tanpa file eksternal (Web Audio API).
 *  kind: 'sukses' | 'gagal' | 'duplikat' — beda nada & pola supaya mudah dibedakan. */
export function playBeep(kind: 'sukses' | 'gagal' | 'duplikat' = 'sukses') {
  try {
    // Vibrasi di HP (jika didukung) sebagai feedback tambahan
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (kind === 'sukses') navigator.vibrate(80);
      else if (kind === 'duplikat') navigator.vibrate([60, 60, 60]);
      else navigator.vibrate([120, 80, 120]);
    }

    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    const now = ctx.currentTime;

    const tone = (start: number, freq: number, dur: number, vol = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };

    if (kind === 'sukses') {
      tone(0, 880, 0.12);   // nada naik pendek
      tone(0.12, 1320, 0.14);
    } else if (kind === 'duplikat') {
      tone(0, 520, 0.1);    // dua nada sama (tanda "sudah ada")
      tone(0.14, 520, 0.1);
    } else {
      tone(0, 260, 0.18);   // nada rendah (gagal)
      tone(0.2, 196, 0.2);
    }

    setTimeout(() => { ctx.close().catch(() => {}); }, 800);
  } catch { /* bunyi opsional — jangan gagalkan scan */ }
}
