'use client';

/** Bacakan teks dengan Web Speech API (text-to-speech).
 *  Opsional onEnd dipanggil setelah selesai bicara. */
export function speak(text: string, onEnd?: () => void) {
  try {
    const synth = (window as any).speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { onEnd?.(); return; }
    synth.cancel(); // hentikan yang sedang bicara agar tidak menumpuk
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'id-ID';
    u.rate = 1;
    u.pitch = 1;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    synth.speak(u);
  } catch {
    onEnd?.();
  }
}
