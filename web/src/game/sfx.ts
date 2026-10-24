// Procedural ZzFX SFX (BLZ-16.T1): no audio files.
import { ZZFX, zzfx } from 'zzfx';

ZZFX.volume = 0.35;
// Browsers hold audio until a gesture; wake it on the first touch.
addEventListener('pointerdown', () => ZZFX.audioContext.state === 'suspended' && ZZFX.audioContext.resume(), { once: true });

const S = {
  klik: [0.5, , 800, , 0.01, 0.03, , , , , , , , , , , , 0.5],
  ambil: [1, , 523, 0.02, 0.1, 0.2, 1, 1.5, , , 523, 0.06],
  kalah: [1, , 150, 0.02, 0.08, 0.25, 3, 1.5, -5],
  lulus: [1, , 600, 0.01, 0.1, 0.15, 1, 2, , , 300, 0.05],
  gagal: [1, , 90, 0.01, 0.1, 0.35, 4, 2, , , , , , 0.5],
  selesai: [1.2, , 1046, 0.01, 0.18, 0.35, 1, 1.8, , , 523, 0.08, 0.08],
  mesin: [0.4, , 200, 0.02, 0.4, 0.2, 4, , , , , , 0.05, 1.5],
  ding: [0.7, , 1400, , 0.05, 0.3, , 1.5, , , , , , , , , 0.1],
} satisfies Record<string, (number | undefined)[]>;

export type NamaSfx = keyof typeof S;
export function sfx(nama: NamaSfx) {
  try {
    zzfx(...S[nama]);
  } catch {}
}
