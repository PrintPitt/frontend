// Tata letak toko (meter, x kanan, z ke kamera): kotak tabrakan + titik stasiun. Dipakai Toko3D dan logika game.
// Mesin tersebar: 3 fotokopi berjajar di dinding kiri, 2 printer di meja mesin belakang, 3 laminator di meja mesin samping.
export const L = 12;
export const D = 8;
export const TINGGI_MEJA = 0.78;
export const DALAM_MEJA = 0.75;

export const Z_BELAKANG = -D / 2 + DALAM_MEJA / 2 + 0.25; // pusat konter belakang
export const Z_DEPAN = D / 2 - DALAM_MEJA / 2; // pusat konter depan (loket)
export const X_KIRI = -L / 2 + DALAM_MEJA / 2 + 0.15;
export const X_KANAN = L / 2 - DALAM_MEJA / 2 - 0.15;

/** Meja khusus mesin (printer/laminator): lebih lebar & dalam dari ubin konter supaya mesin tidak menggantung. */
export const MEJA_MESIN = { lebar: 1.55, dalam: 1.1 };

export type KodeMesin = 1 | 2 | 3;
export type IdMesin = 'f1' | 'f2' | 'f3' | 'p1' | 'p2' | 'l1' | 'l2' | 'l3';
/** x, z = pusat mesin/meja; putar = arah muka (0 → +z); y = tinggi alas mesin; dalam = kedalaman tapak. */
export type DefMesin = { kode: KodeMesin; x: number; z: number; putar: number; y: number; dalam: number };

const Z_MEJA_BELAKANG = -D / 2 + MEJA_MESIN.dalam / 2 + 0.02;
const X_MEJA_KANAN = L / 2 - MEJA_MESIN.dalam / 2 - 0.02;
export const MESIN: Record<IdMesin, DefMesin> = {
  f1: { kode: 1, x: -L / 2 + 0.55, z: -2.45, putar: Math.PI / 2, y: 0, dalam: 1.0 },
  f2: { kode: 1, x: -L / 2 + 0.55, z: -1.2, putar: Math.PI / 2, y: 0, dalam: 1.0 },
  f3: { kode: 1, x: -L / 2 + 0.55, z: 0.05, putar: Math.PI / 2, y: 0, dalam: 1.0 },
  p1: { kode: 2, x: -0.4, z: Z_MEJA_BELAKANG, putar: 0, y: TINGGI_MEJA, dalam: MEJA_MESIN.dalam },
  p2: { kode: 2, x: 1.3, z: Z_MEJA_BELAKANG, putar: 0, y: TINGGI_MEJA, dalam: MEJA_MESIN.dalam },
  l1: { kode: 3, x: X_MEJA_KANAN, z: -1.65, putar: -Math.PI / 2, y: TINGGI_MEJA, dalam: MEJA_MESIN.dalam },
  l2: { kode: 3, x: X_MEJA_KANAN, z: 0.15, putar: -Math.PI / 2, y: TINGGI_MEJA, dalam: MEJA_MESIN.dalam },
  l3: { kode: 3, x: -X_MEJA_KANAN, z: 1.4, putar: Math.PI / 2, y: TINGGI_MEJA, dalam: MEJA_MESIN.dalam },
};
export const ID_MESIN = Object.keys(MESIN) as IdMesin[];
export const adalahMesin = (id: string | null | undefined): id is IdMesin => !!id && id in MESIN;

/** Titik di muka mesin (tempat pemain berdiri), atau titik lain sejauh `jarak` ke arah muka. */
export function mukaMesin(m: DefMesin, jarak = m.dalam / 2): [number, number] {
  return [m.x + Math.sin(m.putar) * jarak, m.z + Math.cos(m.putar) * jarak];
}

export const POS_SERAH: [number, number, number] = [-0.5, TINGGI_MEJA, Z_DEPAN];
/** Meja kerja tengah: 4 ubin, semuanya bisa ditaruhi barang. */
export const POS_MEJA: [number, number, number][] = [-1.5, -0.5, 0.5, 1.5].map((x) => [x, TINGGI_MEJA, 0.6]);

type Kotak = { x0: number; x1: number; z0: number; z1: number };
const k = (x0: number, x1: number, z0: number, z1: number): Kotak => ({ x0, x1, z0, z1 });

/** Tapak meja mesin yang diputar (lebar sepanjang dinding, dalam ke arah ruangan). */
function tapak(m: DefMesin): Kotak {
  const samping = Math.abs(Math.sin(m.putar)) > 0.5;
  const [w, d] = samping ? [MEJA_MESIN.dalam, MEJA_MESIN.lebar] : [MEJA_MESIN.lebar, MEJA_MESIN.dalam];
  return k(m.x - w / 2, m.x + w / 2, m.z - d / 2, m.z + d / 2);
}

/** Rintangan (AABB di lantai). */
export const RINTANGAN: Kotak[] = [
  k(-5.95, -4.9, -2.95, 0.55), // deretan 3 mesin fotokopi (dinding kiri)
  k(-5.0, -2.0, Z_BELAKANG - DALAM_MEJA / 2, Z_BELAKANG + DALAM_MEJA / 2), // konter belakang kiri (rak kertas)
  tapak(MESIN.p1),
  tapak(MESIN.p2),
  tapak(MESIN.l1),
  tapak(MESIN.l2),
  tapak(MESIN.l3),
  k(2.1, 5.1, Z_BELAKANG - DALAM_MEJA / 2, Z_BELAKANG + DALAM_MEJA / 2), // konter belakang kanan (rim kertas)
  k(5.1, 5.9, -3.95, -2.95), // dispenser
  k(-5.85, -5.05, 2.4, 3.1), // pot tanaman kiri depan
  k(-2, 2, 0.6 - DALAM_MEJA / 2, 0.6 + DALAM_MEJA / 2), // meja kerja tengah
  k(5.0, 5.85, 1.05, 2.45), // kardus
  k(-6, 6, Z_DEPAN - DALAM_MEJA / 2, Z_DEPAN + DALAM_MEJA / 2), // konter depan + loket
];
export const BATAS = { x0: -5.75, x1: 5.75, z0: -3.9, z1: 3.15 };
export const RADIUS_PEMAIN = 0.32;

export type IdStasiun = 'serah' | IdMesin | 'meja0' | 'meja1' | 'meja2' | 'meja3';
type Titik = { x: number; z: number; jangkau: number };
/** Titik stasiun: pemain harus berdiri dalam jarak `jangkau` dari titik ini. */
export const STASIUN: Record<IdStasiun, Titik> = {
  serah: { x: -0.5, z: Z_DEPAN, jangkau: 1.25 },
  meja0: { x: -1.5, z: 0.6, jangkau: 1.05 },
  meja1: { x: -0.5, z: 0.6, jangkau: 1.05 },
  meja2: { x: 0.5, z: 0.6, jangkau: 1.05 },
  meja3: { x: 1.5, z: 0.6, jangkau: 1.05 },
  ...(Object.fromEntries(
    ID_MESIN.map((id) => {
      const [x, z] = mukaMesin(MESIN[id]);
      return [id, { x, z, jangkau: MESIN[id].kode === 1 ? 0.95 : 1.1 }];
    }),
  ) as Record<IdMesin, Titik>),
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
  for (const [id, s] of Object.entries(STASIUN) as [IdStasiun, Titik][]) {
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
