// Interior toko fotokopi 3D (12 × 8 m): konter + rak dari Delixia, mesin dari figures/, loket SERAH, jalan di luar.
import { Billboard, Html, useGLTF } from '@react-three/drei';
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Fotokopi3D, Laminator3D, Printer3D, UNGU } from './Mesin3D';
import { Model, MODEL } from './Model';
import { Pekerja3D, type Bawa, type Gaya } from './Pekerja3D';
import { D, L, POS_MESIN, TINGGI_MEJA, Z_BELAKANG, Z_DEPAN } from '../game3d/peta';

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
function PapanKanvas({ posisi, lebar, tinggi, px = 640, gambar, putar = 0, miring = 0 }: {
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
const gambarPapan = (teks: string, latar: string) => (g: CanvasRenderingContext2D, w: number, h: number) => {
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
      <PapanKanvas posisi={[-2.1, 1.7, -D / 2 + 0.01]} lebar={1.9} tinggi={1.19} gambar={gambarHarga} />
      <PapanKanvas posisi={[4.3, 1.75, -D / 2 + 0.01]} lebar={1.6} tinggi={0.68} gambar={gambarPoster} putar={0.05} />
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
  mesinJalan?: boolean;
  /** Isi dinamis game (barang, sorotan stasiun, bar progres). */
  children?: ReactNode;
  warna?: string;
  nama?: string;
  pemain?: PemainToko[];
  pelanggan?: Pelanggan[];
  /** Progres mesin yang sedang dipakai: kode 1 fotokopi, 2 printer, 3 laminator. */
  progres?: { kode: 1 | 2 | 3; nilai: number };
}) {
  const konter = useUkuran(MODEL('Counter_Straight'), 1);
  const tMeja = TINGGI_MEJA;
  const dMeja = konter.z;
  const zBelakang = Z_BELAKANG;
  const zDepan = Z_DEPAN;

  const papanNama = useMemo(() => gambarPapan(`FOTOKOPI · ${nama}`, warna), [nama, warna]);
  const papanSerah = useMemo(() => gambarPapan('SERAH ▼', UNGU.d), []);
  const posMesin = POS_MESIN;

  return (
    <group>
      {/* lantai dalam + jalan dan trotoar di luar */}
      <Lantai />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 2]} receiveShadow>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#3a3550" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, DALAM_TOKO / 2 + 1.6]} receiveShadow>
        <planeGeometry args={[LEBAR_TOKO + 6, 2.6]} />
        <meshStandardMaterial color="#d9cfb8" />
      </mesh>
      {[-7.8, 7.8].map((x) => (
        <Pohon key={x} posisi={[x, 0, DALAM_TOKO / 2 + 1.4]} s={1.1} />
      ))}
      <Pohon posisi={[-8.3, 0, -1]} s={1.3} />
      <Pohon posisi={[8.4, 0, 0.5]} s={1.25} />

      <Dinding warna={warna} />

      {/* konter belakang: printer + laminator di atasnya */}
      {[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5].map((x, i) => (
        <Model key={x} url={MODEL(i % 3 === 1 ? 'Counter_Drawers' : 'Counter_Doors')} lebar={1} tinggi={TINGGI_MEJA} posisi={[x, 0, zBelakang]} />
      ))}
      <Fotokopi3D posisi={posMesin[1]} skala={1.5} jalan={progres?.kode === 1 || mesinJalan} />
      <Printer3D posisi={posMesin[2]} skala={3} />
      <Laminator3D posisi={posMesin[3]} skala={3.3} />
      <Rim posisi={[4.6, tMeja, zBelakang]} tumpuk={3} />

      {/* rak kertas (gudang) di kiri */}
      {[-1.5, -0.5, 0.5].map((z) => (
        <Model key={z} url={MODEL('Counter_Straight')} lebar={1} tinggi={TINGGI_MEJA} posisi={[-LEBAR_TOKO / 2 + dMeja / 2 + 0.15, 0, z]} putar={Math.PI / 2} />
      ))}
      <Rim posisi={[-LEBAR_TOKO / 2 + 0.55, tMeja, -1.5]} tumpuk={5} />
      <Rim posisi={[-LEBAR_TOKO / 2 + 0.55, tMeja, -0.5]} tumpuk={4} />
      <Rim posisi={[-LEBAR_TOKO / 2 + 0.55, tMeja, 0.5]} tumpuk={5} warna="#fdf3c4" />

      {/* meja kerja di tengah: dokumen pelanggan */}
      {[-0.5, 0.5].map((x) => (
        <Model key={x} url={MODEL('Counter_Straight')} lebar={1} tinggi={TINGGI_MEJA} posisi={[x, 0, 0.6]} />
      ))}

      {/* meja kanan: kardus + rak */}
      {[-1.5, -0.5].map((z) => (
        <Model key={z} url={MODEL('Counter_Drawers')} lebar={1} tinggi={TINGGI_MEJA} posisi={[LEBAR_TOKO / 2 - dMeja / 2 - 0.15, 0, z]} putar={-Math.PI / 2} />
      ))}
      <Model url={MODEL('Crate')} lebar={0.7} posisi={[LEBAR_TOKO / 2 - 0.6, tMeja, -1.5]} />
      <Model url={MODEL('Crate')} lebar={0.7} posisi={[LEBAR_TOKO / 2 - 0.6, 0, 1.3]} />
      <Model url={MODEL('Crate')} lebar={0.6} posisi={[LEBAR_TOKO / 2 - 0.65, 0, 2.1]} putar={0.3} />

      {/* konter depan + loket SERAH */}
      {[-5.5, -4.5, -3.5, -2.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((x) => (
        <Model key={x} url={MODEL('Counter_Doors')} lebar={1} tinggi={TINGGI_MEJA} posisi={[x, 0, zDepan]} putar={Math.PI} />
      ))}
      {[-1.5, -0.5, 0.5].map((x) => (
        <Model key={x} url={MODEL('Counter_Straight')} lebar={1} tinggi={TINGGI_MEJA} posisi={[x, 0, zDepan]} putar={Math.PI} warna={warna} />
      ))}
      <mesh position={[-0.5, tMeja + 0.012, zDepan]} receiveShadow>
        <boxGeometry args={[2.9, 0.02, dMeja * 0.8]} />
        <meshStandardMaterial color={UNGU.l} />
      </mesh>
      <mesh position={[0.65, tMeja + 0.06, zDepan + 0.1]} castShadow>
        <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f4b829" metalness={0.4} roughness={0.3} />
      </mesh>
      <PapanKanvas posisi={[-0.5, 1.95, zDepan]} lebar={1.5} tinggi={0.42} px={512} miring={-0.55} gambar={papanSerah} />

      {/* papan nama toko di dinding belakang */}
      <PapanKanvas posisi={[1.2, 2.85, -DALAM_TOKO / 2 + 0.05]} lebar={3.2} tinggi={0.62} px={900} miring={-0.5} gambar={papanNama} />

      {/* bar progres mesin yang dipakai (billboard 3D, selalu menghadap kamera) */}
      {progres && (
        <Billboard position={[posMesin[progres.kode][0], posMesin[progres.kode][1] + (progres.kode === 1 ? 1.85 : 0.95), posMesin[progres.kode][2]]}>
          <mesh>
            <planeGeometry args={[1.0, 0.2]} />
            <meshBasicMaterial color="#231e16" toneMapped={false} />
          </mesh>
          <mesh position={[(-0.92 * (1 - progres.nilai)) / 2, 0, 0.001]} scale={[progres.nilai, 1, 1]}>
            <planeGeometry args={[0.92, 0.12]} />
            <meshBasicMaterial color="#5fd39a" toneMapped={false} />
          </mesh>
        </Billboard>
      )}

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

['Counter_Straight', 'Counter_Doors', 'Counter_Drawers', 'Kitchen_Flooring', 'Normal_Wall', 'Crate'].forEach((n) => useGLTF.preload(MODEL(n)));
