// Interior toko fotokopi 3D (12 × 8 m): konter + rak dari Delixia, mesin dari figures/, loket SERAH, jalan di luar.
import { Billboard, Html, useGLTF } from '@react-three/drei';
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Fotokopi3D, Laminator3D, Printer3D, UNGU } from './Mesin3D';
import { Model, MODEL } from './Model';
import { Dispenser, GelasPulpen, JamDinding, Karpet, Kasir, KonterGabung, KursiTunggu, PermukaanSerah, RakBinder, Selotip, Sobekan, Stapler, Tanaman, type SpecKonter } from './Perabot3D';

type V3 = [number, number, number];
import { Pekerja3D, type Bawa, type Gaya } from './Pekerja3D';
import { D, DALAM_MEJA, ID_MESIN, L, MEJA_MESIN, MESIN, TINGGI_MEJA, Z_BELAKANG, Z_DEPAN } from '../game3d/peta';

export const LEBAR_TOKO = L;
export const DALAM_TOKO = D;
const TINGGI_DINDING = 2.4;

/** Ukuran model setelah diskalakan ke lebar target. */
function useUkuran(url: string, lebar: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);
    const u = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3());
    return u.multiplyScalar(lebar / u.x);
  }, [scene, lebar]);
}

function Rim({ posisi, tumpuk = 4, warna = '#fbfaf3' }: { posisi: [number, number, number]; tumpuk?: number; warna?: string }) {
  return (
    <group position={posisi}>
      {Array.from({ length: tumpuk }, (_, i) => (
        <mesh key={i} position={[0, 0.045 + i * 0.09, 0]} rotation={[0, (i % 2 ? 1 : -1) * 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.08, 0.3]} />
          <meshStandardMaterial color={i % 2 ? warna : '#efe9d8'} />
        </mesh>
      ))}
      <mesh position={[0, 0.045 + (tumpuk - 1) * 0.09, 0]} castShadow>
        <boxGeometry args={[0.43, 0.03, 0.12]} />
        <meshStandardMaterial color={UNGU.m} />
      </mesh>
    </group>
  );
}

export function Dokumen({ posisi, warna, putar = 0 }: { posisi: [number, number, number]; warna: string; putar?: number }) {
  return (
    <mesh position={posisi} rotation={[0, putar, 0]} castShadow>
      <boxGeometry args={[0.36, 0.02, 0.26]} />
      <meshStandardMaterial color={warna} />
    </mesh>
  );
}

function Pohon({ posisi, s = 1 }: { posisi: [number, number, number]; s?: number }) {
  return (
    <group position={posisi} scale={s}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 1, 8]} />
        <meshStandardMaterial color="#7a5a3a" />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial color="#71b693" flatShading />
      </mesh>
    </group>
  );
}

export function Label({ posisi, children, warna = UNGU.m }: { posisi: [number, number, number]; children: ReactNode; warna?: string }) {
  return (
    <Html position={posisi} center distanceFactor={9} zIndexRange={[10, 0]}>
      <div className="label-3d" style={{ background: warna }}>
        {children}
      </div>
    </Html>
  );
}

/** Papan bergambar kanvas di dinding (ikut perspektif kamera, tidak bergantung pada elemen HTML). */
export function PapanKanvas({ posisi, lebar, tinggi, px = 640, gambar, putar = 0, miring = 0 }: {
  posisi: [number, number, number]; lebar: number; tinggi: number; px?: number; putar?: number; miring?: number;
  gambar: (g: CanvasRenderingContext2D, w: number, h: number) => void;
}) {
  const tekstur = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = px;
    c.height = Math.round((px * tinggi) / lebar);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const ulang = () => { gambar(c.getContext('2d')!, c.width, c.height); t.needsUpdate = true; };
    ulang();
    document.fonts?.ready.then(ulang);
    return t;
  }, [px, lebar, tinggi, gambar]);
  return (
    <mesh position={posisi} rotation={[miring, 0, putar]}>
      <planeGeometry args={[lebar, tinggi]} />
      <meshBasicMaterial map={tekstur} toneMapped={false} transparent />
    </mesh>
  );
}

const gambarHarga = (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.fillStyle = '#231e16'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2163'; g.fillRect(12, 12, w - 24, h - 24);
  g.fillStyle = '#f4b829'; g.font = '58px "Lilita One", system-ui'; g.fillText('DAFTAR HARGA', 40, 86);
  g.font = '700 38px "Fredoka", system-ui'; g.fillStyle = '#fbfaf3';
  [['Fotokopi KTP', '5.000'], ['Boarding pass', '5.000'], ['Laminating ijazah', '10.000'], ['Menu warung', '10.000']].forEach(([a, b], i) => {
    g.fillText(a, 40, 160 + i * 58); g.fillText(`Rp${b}`, 420, 160 + i * 58);
  });
};
export const gambarPapan = (teks: string, latar: string) => (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.fillStyle = '#231e16'; g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
  g.fillStyle = latar; g.beginPath(); g.roundRect(10, 10, w - 20, h - 26, 20); g.fill();
  g.fillStyle = '#fbfaf3'; g.strokeStyle = '#231e16'; g.lineWidth = 8; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${Math.round(h * 0.52)}px "Lilita One", system-ui`;
  g.strokeText(teks, w / 2, h * 0.47); g.fillText(teks, w / 2, h * 0.47);
};

const gambarPoster = (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.fillStyle = '#231e16'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fbfaf3'; g.fillRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#cf5038'; g.font = '64px "Lilita One", system-ui'; g.textAlign = 'center';
  g.fillText('PRINT · JILID', w / 2, 100); g.fillText('LAMINATING', w / 2, 172);
  g.fillStyle = '#231e16'; g.font = '700 34px "Fredoka", system-ui'; g.fillText('buka 24 jam · bayar Rupiah', w / 2, 232);
};

/** Dinding krem toko fotokopi: les ungu di bawah, jendela di samping, papan harga + poster di belakang. */
function Dinding({ warna }: { warna: string }) {
  const L = LEBAR_TOKO, D = DALAM_TOKO, H = TINGGI_DINDING;
  const krem = '#f6efe0';
  const sisi = (x: number) => (
    <group position={[x, 0, 0]}>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H, D + 0.4]} />
        <meshStandardMaterial color={krem} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.24, 0.24, D + 0.42]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      {[-1.8, 1.4].map((z) => (
        <mesh key={z} position={[-Math.sign(x) * 0.11, 1.45, z]}>
          <boxGeometry args={[0.04, 0.8, 1.3]} />
          <meshStandardMaterial color="#bfe3ef" roughness={0.15} />
        </mesh>
      ))}
    </group>
  );
  return (
    <group>
      <mesh position={[0, H / 2, -D / 2 - 0.1]} castShadow receiveShadow>
        <boxGeometry args={[L + 0.4, H, 0.2]} />
        <meshStandardMaterial color={krem} />
      </mesh>
      <mesh position={[0, 0.12, -D / 2 - 0.08]}>
        <boxGeometry args={[L + 0.42, 0.24, 0.24]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      <mesh position={[0, H + 0.04, -D / 2 - 0.1]}>
        <boxGeometry args={[L + 0.5, 0.08, 0.3]} />
        <meshStandardMaterial color={UNGU.d} />
      </mesh>
      {sisi(-L / 2 - 0.1)}
      {sisi(L / 2 + 0.1)}
      {[-L / 2 - 0.1, L / 2 + 0.1].map((x) => (
        <mesh key={x} position={[x, H / 2, D / 2]} castShadow>
          <boxGeometry args={[0.36, H, 0.36]} />
          <meshStandardMaterial color={warna} />
        </mesh>
      ))}
      <PapanKanvas posisi={[0.45, 1.85, -D / 2 + 0.01]} lebar={1.7} tinggi={1.06} gambar={gambarHarga} />
      <PapanKanvas posisi={[2.45, 1.8, -D / 2 + 0.01]} lebar={1.3} tinggi={0.55} gambar={gambarPoster} putar={0.05} />
    </group>
  );
}

export type PemainToko ={ posisi: [number, number, number]; putar?: number; gaya?: Gaya; bawa?: Bawa; warna: string };
export type Pelanggan = { x: number; warna: string; bawa?: Bawa; rambut?: string; kulit?: string };

/** Lantai keramik krem kotak-kotak (1 m per ubin). */
function Lantai() {
  const tekstur = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const warna = ['#f1e8d4', '#e3d6b9'];
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = warna[(i + j) % 2];
        g.fillRect(i * 64, j * 64, 64, 64);
      }
    g.strokeStyle = '#cdbf9f';
    g.lineWidth = 2;
    for (let k = 0; k <= 128; k += 64) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k, 128);
      g.moveTo(0, k);
      g.lineTo(128, k);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(LEBAR_TOKO / 2, DALAM_TOKO / 2);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[LEBAR_TOKO, DALAM_TOKO]} />
      <meshStandardMaterial map={tekstur} roughness={0.9} />
    </mesh>
  );
}

export function Toko3D({
  warna = UNGU.m,
  nama = 'TOKO A',
  pemain = [],
  pelanggan = [],
  progres,
  children,
  mesinJalan,
}: {
  /** Id mesin fotokopi yang sedang jalan, dipisah koma (primitif supaya memo stabil). */
  mesinJalan?: string;
  /** Isi dinamis game (barang, sorotan stasiun, bar progres). */
  children?: ReactNode;
  warna?: string;
  nama?: string;
  pemain?: PemainToko[];
  pelanggan?: Pelanggan[];
  /** Progres mesin yang sedang dipakai: kode 1 fotokopi, 2 printer, 3 laminator. */
  progres?: { kode: 1 | 2 | 3; nilai: number };
}) {
  const tMeja = TINGGI_MEJA;
  const zBelakang = Z_BELAKANG;
  const zDepan = Z_DEPAN;

  const papanNama = useMemo(() => gambarPapan(`PRINTPITT · ${nama}`, warna), [nama, warna]);
  // semua konter + meja mesin dalam satu daftar → digabung jadi beberapa mesh
  const daftarKonter = useMemo<SpecKonter[]>(
    () => [
      ...ID_MESIN.filter((id) => MESIN[id].kode !== 1).map((id) => ({ posisi: [MESIN[id].x, 0, MESIN[id].z] as V3, putar: MESIN[id].putar, lebar: MEJA_MESIN.lebar, dalam: MEJA_MESIN.dalam, muka: 'laci' as const, les: warna, atas: '#e9d2a6' })),
      ...[2.6, 3.6, 4.6].map((x, i) => ({ posisi: [x, 0, Z_BELAKANG] as V3, muka: (i === 1 ? 'laci' : 'pintu') as 'laci' | 'pintu', les: warna })),
      ...[-4.5, -3.5, -2.5].map((x, i) => ({ posisi: [x, 0, Z_BELAKANG] as V3, muka: (i === 1 ? 'laci' : 'pintu') as 'laci' | 'pintu', les: warna })),
      ...[-1.5, -0.5, 0.5, 1.5].map((x) => ({ posisi: [x, 0, 0.6] as V3, muka: 'polos' as const, badan: '#e9e1f9', atas: '#f7ead0', les: warna })),
      ...[-5.5, -4.5, -3.5, -2.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((x, i) => ({ posisi: [x, 0, Z_DEPAN] as V3, muka: (i % 4 === 2 ? 'laci' : 'pintu') as 'laci' | 'pintu', les: warna })),
      ...[-1.5, -0.5, 0.5].map((x) => ({ posisi: [x, 0, Z_DEPAN] as V3, muka: 'polos' as const, badan: UNGU.l, atas: '#f7ead0', les: UNGU.d })),
    ],
    [warna],
  );

  return (
    <group>
      {/* tanah: rumput di belakang/samping, trotoar + jalan di depan */}
      <Lantai />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[70, 50]} />
        <meshStandardMaterial color="#8cc07a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, DALAM_TOKO / 2 + 5.2]} receiveShadow>
        <planeGeometry args={[70, 4.2]} />
        <meshStandardMaterial color="#4a4560" />
      </mesh>
      {[-9, -5, -1, 3, 7, 11].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.03, DALAM_TOKO / 2 + 5.2]}>
          <planeGeometry args={[1.6, 0.16]} />
          <meshBasicMaterial color="#e9e2cf" />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, DALAM_TOKO / 2 + 1.55]} receiveShadow>
        <planeGeometry args={[LEBAR_TOKO + 9, 3.1]} />
        <meshStandardMaterial color="#e6dcc4" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.5, -0.02, DALAM_TOKO / 2 + 0.95]} receiveShadow>
        <planeGeometry args={[2.4, 1.1]} />
        <meshStandardMaterial color={UNGU.d} />
      </mesh>
      {[-8, 8].map((x) => (
        <Pohon key={x} posisi={[x, 0, DALAM_TOKO / 2 + 1.5]} s={1.05} />
      ))}
      <Pohon posisi={[-8.6, 0, -2]} s={1.35} />
      <Pohon posisi={[8.7, 0, -1.2]} s={1.3} />
      <Pohon posisi={[-3, 0, -6.2]} s={1.2} />
      <Pohon posisi={[4.5, 0, -6.4]} s={1.3} />

      <Dinding warna={warna} />
      <RakBinder posisi={[4.05, 1.45, -DALAM_TOKO / 2 + 0.16]} lebar={1.8} />
      <JamDinding posisi={[-1.3, 2.0, -DALAM_TOKO / 2 + 0.04]} />

      {/* mesin: 3 fotokopi berjajar, 2 printer + 3 laminator di meja mesin yang pas ukurannya */}
      {ID_MESIN.map((id) => {
        const m = MESIN[id];
        if (m.kode === 1)
          return (
            <Fotokopi3D key={id} posisi={[m.x, 0, m.z]} putar={m.putar} skala={1.5} jalan={progres?.kode === 1 || !!mesinJalan?.split(',').includes(id)} />
          );
        return (
          <group key={id} position={[m.x, 0, m.z]} rotation={[0, m.putar, 0]}>
            {m.kode === 2 ? <Printer3D posisi={[0, tMeja, -0.08]} skala={2.4} /> : <Laminator3D posisi={[0, tMeja, -0.04]} skala={2.6} />}
          </group>
        );
      })}
      {/* konter belakang kanan: stok rim kertas */}
      <Rim posisi={[2.6, tMeja, zBelakang]} tumpuk={3} />
      <Rim posisi={[4.6, tMeja, zBelakang]} tumpuk={4} warna="#fdf3c4" />
      <Dispenser posisi={[5.45, 0, -3.45]} />

      {/* rak kertas (gudang) di pojok kiri belakang */}
      <Rim posisi={[-4.5, tMeja, zBelakang]} tumpuk={5} />
      <Rim posisi={[-3.5, tMeja, zBelakang]} tumpuk={4} warna="#fdf3c4" />
      <Rim posisi={[-2.5, tMeja, zBelakang]} tumpuk={3} />
      <Tanaman posisi={[-5.45, 0, 2.75]} s={0.95} />

      {/* meja kerja di tengah: 4 ubin, semua bisa ditaruhi barang */}

      {/* sisi kanan depan: kardus */}
      <Model url={MODEL('Crate')} lebar={0.7} posisi={[LEBAR_TOKO / 2 - 0.6, 0, 1.45]} />
      <Model url={MODEL('Crate')} lebar={0.6} posisi={[LEBAR_TOKO / 2 - 0.65, 0, 2.2]} putar={0.3} />

      {/* konter depan + loket SERAH */}
      <KonterGabung daftar={daftarKonter} />
      <PermukaanSerah posisi={[-0.5, tMeja + 0.006, zDepan]} warna={warna} />
      <mesh position={[0.65, tMeja + 0.02, zDepan + 0.1]} castShadow>
        <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f4b829" metalness={0.4} roughness={0.3} />
      </mesh>
      <Kasir posisi={[1.6, tMeja, zDepan]} putar={Math.PI} />
      {[-5.5, -4.95, 4.4, 4.95].map((x, i) => (
        <KursiTunggu key={x} posisi={[x, 0, DALAM_TOKO / 2 + 0.75]} putar={Math.PI} warna={i % 2 ? '#f4b829' : '#76a0e2'} />
      ))}

      {/* papan nama toko di dinding belakang */}
      <PapanKanvas posisi={[-0.4, 2.85, -DALAM_TOKO / 2 + 0.05]} lebar={3.2} tinggi={0.62} px={900} miring={-0.5} gambar={papanNama} />

      {/* perabot kecil di meja + lantai, kanopi teras, lampu gantung */}
      <Stapler posisi={[-1.55, tMeja, 0.5]} putar={0.4} />
      <GelasPulpen posisi={[1.75, tMeja, 0.45]} />
      <Selotip posisi={[0.2, tMeja, 0.8]} />
      <Stapler posisi={[3.3, tMeja, zBelakang + 0.15]} putar={-0.3} />
      <GelasPulpen posisi={[-4.95, tMeja, zBelakang - 0.2]} />
      <Selotip posisi={[2.9, tMeja, zDepan - 0.1]} />
      <Karpet posisi={[-0.5, 0.004, Z_DEPAN - 1.35]} teks="SERAH DI SINI" warna={warna} lebar={2.2} dalam={0.8} />
      <Sobekan posisi={[-3.2, 0, 1.4]} putar={0.4} />
      <Sobekan posisi={[2.6, 0, -1.2]} putar={1.3} s={0.8} />
      <Sobekan posisi={[-1.8, 0, -1.9]} putar={2.2} s={0.9} />

      {children}

      {/* pemain + pelanggan antre di luar loket */}
      {pemain.map((p, i) => (
        <Pekerja3D key={i} warna={p.warna} posisi={p.posisi} putar={p.putar} gaya={p.gaya} bawa={p.bawa} fase={i * 1.7} />
      ))}
      {pelanggan.map((p, i) => (
        <Pekerja3D
          key={`c${i}`}
          warna={p.warna}
          posisi={[p.x, 0, DALAM_TOKO / 2 + 1.25]}
          putar={Math.PI}
          bawa={p.bawa}
          topi={false}
          rambut={p.rambut}
          kulit={p.kulit}
          cincin={false}
          fase={i * 2.3}
        />
      ))}
    </group>
  );
}

['Crate'].forEach((n) => useGLTF.preload(MODEL(n)));
