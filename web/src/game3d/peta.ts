// Tata letak toko (meter, x kanan, z ke kamera): kotak tabrakan + titik stasiun. Dipakai Toko3D dan logika game.
export const L = 12;
export const D = 8;
export const TINGGI_MEJA = 0.78;
export const DALAM_MEJA = 0.75;

export const Z_BELAKANG = -D / 2 + DALAM_MEJA / 2 + 0.25; // pusat konter belakang
export const Z_DEPAN = D / 2 - DALAM_MEJA / 2; // pusat konter depan (loket)
export const X_KIRI = -L / 2 + DALAM_MEJA / 2 + 0.15;
export const X_KANAN = L / 2 - DALAM_MEJA / 2 - 0.15;

export const POS_MESIN = {
  1: [-4.55, 0, Z_BELAKANG + 0.05] as [number, number, number],
  2: [-0.6, TINGGI_MEJA, Z_BELAKANG] as [number, number, number],
  3: [2.6, TINGGI_MEJA, Z_BELAKANG] as [number, number, number],
};
export const POS_SERAH: [number, number, number] = [-0.5, TINGGI_MEJA, Z_DEPAN];
export const POS_MEJA: [number, number, number][] = [
  [-0.5, TINGGI_MEJA, 0.6],
  [0.5, TINGGI_MEJA, 0.6],
];

type Kotak = { x0: number; x1: number; z0: number; z1: number };
const k = (x0: number, x1: number, z0: number, z1: number): Kotak => ({ x0, x1, z0, z1 });

/** Rintangan (AABB di lantai). */
export const RINTANGAN: Kotak[] = [
  k(-3, 5, Z_BELAKANG - DALAM_MEJA / 2, Z_BELAKANG + DALAM_MEJA / 2), // konter belakang
  k(-5.25, -3.65, -3.95, -2.8), // mesin fotokopi
  k(X_KIRI - DALAM_MEJA / 2, X_KIRI + DALAM_MEJA / 2, -2, 1), // rak kertas kiri
  k(-1, 1, 0.6 - DALAM_MEJA / 2, 0.6 + DALAM_MEJA / 2), // meja kerja tengah
  k(X_KANAN - DALAM_MEJA / 2, X_KANAN + DALAM_MEJA / 2, -2, 0), // meja kanan
  k(5.0, 5.85, 0.95, 2.45), // kardus
  k(-6, 6, Z_DEPAN - DALAM_MEJA / 2, Z_DEPAN + DALAM_MEJA / 2), // konter depan + loket
];
export const BATAS = { x0: -5.75, x1: 5.75, z0: -3.9, z1: 3.15 };
export const RADIUS_PEMAIN = 0.32;

export type IdStasiun = 'serah' | 'm1' | 'm2' | 'm3' | 'meja0' | 'meja1';
/** Titik stasiun: pemain harus berdiri dalam jarak `jangkau` dari titik ini. */
export const STASIUN: Record<IdStasiun, { x: number; z: number; jangkau: number; label: string }> = {
  serah: { x: -0.5, z: Z_DEPAN, jangkau: 1.25, label: 'Loket SERAH' },
  m1: { x: -4.45, z: -3.2, jangkau: 1.35, label: 'Mesin fotokopi' },
  m2: { x: -0.6, z: Z_BELAKANG, jangkau: 1.2, label: 'Printer' },
  m3: { x: 2.6, z: Z_BELAKANG, jangkau: 1.2, label: 'Laminator' },
  meja0: { x: -0.5, z: 0.6, jangkau: 1.05, label: 'Meja kerja' },
  meja1: { x: 0.5, z: 0.6, jangkau: 1.05, label: 'Meja kerja' },
};

/** Geser posisi (x, z) supaya lingkaran pemain tidak menembus rintangan/dinding. */
export function selesaikanTabrakan(x: number, z: number): [number, number] {
  x = Math.max(BATAS.x0, Math.min(BATAS.x1, x));
  z = Math.max(BATAS.z0, Math.min(BATAS.z1, z));
  for (const b of RINTANGAN) {
    const cx = Math.max(b.x0, Math.min(b.x1, x));
    const cz = Math.max(b.z0, Math.min(b.z1, z));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < RADIUS_PEMAIN * RADIUS_PEMAIN) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * RADIUS_PEMAIN;
        z = cz + (dz / d) * RADIUS_PEMAIN;
      } else {
        // di dalam kotak: dorong ke sisi terdekat
        const kiri = x - b.x0, kanan = b.x1 - x, atas = z - b.z0, bawah = b.z1 - z;
        const m = Math.min(kiri, kanan, atas, bawah);
        if (m === kiri) x = b.x0 - RADIUS_PEMAIN;
        else if (m === kanan) x = b.x1 + RADIUS_PEMAIN;
        else if (m === atas) z = b.z0 - RADIUS_PEMAIN;
        else z = b.z1 + RADIUS_PEMAIN;
      }
    }
  }
  return [x, z];
}

/** Stasiun terdekat dalam jangkauan, mengutamakan yang ada di depan pemain. */
export function stasiunTerdekat(x: number, z: number, arah: number): IdStasiun | null {
  let terbaik: IdStasiun | null = null;
  let skor = Infinity;
  const fx = Math.sin(arah);
  const fz = Math.cos(arah);
  for (const [id, s] of Object.entries(STASIUN) as [IdStasiun, (typeof STASIUN)[IdStasiun]][]) {
    const dx = s.x - x;
    const dz = s.z - z;
    const d = Math.hypot(dx, dz);
    if (d > s.jangkau) continue;
    const hadap = d > 0.01 ? (dx * fx + dz * fz) / d : 1; // 1 = tepat di depan
    const nilai = d - hadap * 0.5;
    if (nilai < skor) {
      skor = nilai;
      terbaik = id;
    }
  }
  return terbaik;
}
