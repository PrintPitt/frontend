// Perabot prosedural toko (gaya Overcooked: badan cerah, daun meja terang dengan tepi gelap, detail pintu/laci di muka).
// Muka depan = sumbu +z lokal; `putar` memutar seluruh perabot.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DALAM_MEJA, TINGGI_MEJA } from '../game3d/peta';

type V3 = [number, number, number];
const TINTA = '#2d2440';

export function Konter({
  posisi,
  putar = 0,
  badan = '#fbf4e4',
  atas = '#efd6a6',
  les = '#836ef9',
  muka = 'pintu',
  lebar = 1,
  dalam = DALAM_MEJA,
}: {
  posisi: V3;
  putar?: number;
  badan?: string;
  atas?: string;
  les?: string;
  muka?: 'pintu' | 'laci' | 'polos';
  lebar?: number;
  dalam?: number;
}) {
  const t = TINGGI_MEJA;
  const zMuka = dalam / 2 - 0.02;
  return (
    <group position={posisi} rotation={[0, putar, 0]}>
      {/* kaki/plint gelap */}
      <mesh position={[0, 0.05, -0.02]} receiveShadow>
        <boxGeometry args={[lebar - 0.04, 0.1, dalam - 0.1]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      {/* badan */}
      <mesh position={[0, 0.1 + (t - 0.17) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[lebar - 0.02, t - 0.17, dalam - 0.04]} />
        <meshStandardMaterial color={badan} roughness={0.8} />
      </mesh>
      {/* les warna toko di bawah daun meja */}
      <mesh position={[0, t - 0.1, 0.005]}>
        <boxGeometry args={[lebar, 0.06, dalam - 0.02]} />
        <meshStandardMaterial color={les} />
      </mesh>
      {/* daun meja: tepi gelap + permukaan terang */}
      <mesh position={[0, t - 0.04, 0]} receiveShadow>
        <boxGeometry args={[lebar + 0.02, 0.08, dalam + 0.04]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      <mesh position={[0, t - 0.003, 0]} receiveShadow>
        <boxGeometry args={[lebar - 0.03, 0.012, dalam - 0.01]} />
        <meshStandardMaterial color={atas} roughness={0.65} />
      </mesh>
      {/* detail muka */}
      {muka === 'pintu' &&
        [-1, 1].map((s) => (
          <group key={s} position={[(s * lebar) / 4, 0.1 + (t - 0.17) / 2, zMuka]}>
            <mesh>
              <boxGeometry args={[lebar / 2 - 0.09, t - 0.3, 0.025]} />
              <meshStandardMaterial color={badan} roughness={0.7} />
            </mesh>
            <mesh position={[-s * (lebar / 4 - 0.09), 0.12, 0.025]}>
              <boxGeometry args={[0.03, 0.12, 0.03]} />
              <meshStandardMaterial color={TINTA} />
            </mesh>
          </group>
        ))}
      {muka === 'laci' &&
        [0, 1, 2].map((i) => (
          <group key={i} position={[0, 0.2 + i * 0.17, zMuka]}>
            <mesh>
              <boxGeometry args={[lebar - 0.12, 0.13, 0.025]} />
              <meshStandardMaterial color={badan} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.02, 0.022]}>
              <boxGeometry args={[0.22, 0.03, 0.03]} />
              <meshStandardMaterial color={TINTA} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

/** Rak dinding berisi map/binder warna-warni. */
export function RakBinder({ posisi, lebar = 1.6 }: { posisi: V3; lebar?: number }) {
  const warna = ['#ef6a4c', '#f4b829', '#76a0e2', '#93d3b0', '#836ef9', '#f08fb0', '#fbfaf3', '#76a0e2', '#ef6a4c'];
  const n = Math.floor((lebar - 0.2) / 0.11);
  return (
    <group position={posisi}>
      <mesh>
        <boxGeometry args={[lebar, 0.05, 0.28]} />
        <meshStandardMaterial color="#c79a62" />
      </mesh>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[-lebar / 2 + 0.14 + i * 0.11, 0.19, 0.01]} rotation={[0, 0, i === n - 2 ? 0.25 : 0]}>
          <boxGeometry args={[0.085, 0.33, 0.24]} />
          <meshStandardMaterial color={warna[i % warna.length]} />
        </mesh>
      ))}
    </group>
  );
}

/** Jam dinding bundar. */
export function JamDinding({ posisi }: { posisi: V3 }) {
  return (
    <group position={posisi}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.05, 28]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]}>
        <cylinderGeometry args={[0.21, 0.21, 0.02, 28]} />
        <meshStandardMaterial color="#fbfaf3" />
      </mesh>
      <mesh position={[0, 0.07, 0.045]}>
        <boxGeometry args={[0.025, 0.15, 0.01]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      <mesh position={[0.05, 0, 0.045]} rotation={[0, 0, -Math.PI / 2]}>
        <boxGeometry args={[0.025, 0.11, 0.01]} />
        <meshStandardMaterial color="#ef6a4c" />
      </mesh>
    </group>
  );
}

/** Mesin kasir kecil di konter depan. */
export function Kasir({ posisi, putar = 0 }: { posisi: V3; putar?: number }) {
  return (
    <group position={posisi} rotation={[0, putar, 0]}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.42, 0.16, 0.36]} />
        <meshStandardMaterial color="#2a2163" />
      </mesh>
      <mesh position={[0, 0.17, -0.06]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.36, 0.05, 0.2]} />
        <meshStandardMaterial color="#5fd39a" />
      </mesh>
      <mesh position={[0, 0.3, 0.1]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.3, 0.14, 0.03]} />
        <meshStandardMaterial color="#231e16" />
      </mesh>
      <mesh position={[0, 0.3, 0.117]} rotation={[0.35, 0, 0]}>
        <planeGeometry args={[0.24, 0.09]} />
        <meshBasicMaterial color="#9ff0c4" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Pot tanaman bundar (daun low-poly). */
export function Tanaman({ posisi, s = 1 }: { posisi: V3; s?: number }) {
  return (
    <group position={posisi} scale={s}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.26, 0.2, 0.44, 16]} />
        <meshStandardMaterial color="#ef6a4c" />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 16]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.sin(i * 1.3) * 0.12, 0.75 + (i % 2) * 0.18, Math.cos(i * 1.3) * 0.12]}>
          <icosahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial color={i % 2 ? '#5fae7c' : '#71b693'} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Dispenser air galon. */
export function Dispenser({ posisi }: { posisi: V3 }) {
  return (
    <group position={posisi}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.4, 0.9, 0.4]} />
        <meshStandardMaterial color="#fbfaf3" />
      </mesh>
      <mesh position={[0, 0.62, 0.205]}>
        <boxGeometry args={[0.26, 0.18, 0.02]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      <mesh position={[0, 1.13, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.46, 18]} />
        <meshStandardMaterial color="#9fd3ef" transparent opacity={0.75} roughness={0.1} />
      </mesh>
    </group>
  );
}

/** Kursi tunggu pelanggan (plastik). */
export function KursiTunggu({ posisi, warna = '#ef6a4c', putar = 0 }: { posisi: V3; warna?: string; putar?: number }) {
  return (
    <group position={posisi} rotation={[0, putar, 0]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.42, 0.06, 0.42]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      <mesh position={[0, 0.68, -0.19]}>
        <boxGeometry args={[0.42, 0.46, 0.05]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      {[-0.17, 0.17].flatMap((x) =>
        [-0.17, 0.17].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.2, z]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
            <meshStandardMaterial color={TINTA} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Daun meja loket SERAH: panah ke arah pelanggan + tulisan. */
export function PermukaanSerah({ posisi, lebar = 1, dalam = DALAM_MEJA, warna }: { posisi: V3; lebar?: number; dalam?: number; warna: string }) {
  const tekstur = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = Math.round((256 * dalam) / lebar);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const gambar = () => {
      const g = c.getContext('2d')!;
      const w = c.width;
      const h = c.height;
      g.fillStyle = warna;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      for (let i = -h; i < w; i += 36) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 18, 0);
        g.lineTo(i + 18 + h, h);
        g.lineTo(i + h, h);
        g.fill();
      }
      g.fillStyle = '#fbfaf3';
      g.strokeStyle = '#231e16';
      g.lineWidth = 6;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `${Math.round(h * 0.3)}px "Lilita One", system-ui`;
      g.strokeText('SERAH', w / 2, h * 0.3);
      g.fillText('SERAH', w / 2, h * 0.3);
      for (const x of [w * 0.3, w * 0.5, w * 0.7]) {
        g.beginPath();
        g.moveTo(x - 20, h * 0.58);
        g.lineTo(x + 20, h * 0.58);
        g.lineTo(x, h * 0.86);
        g.closePath();
        g.fill();
        g.stroke();
      }
      t.needsUpdate = true;
    };
    gambar();
    document.fonts?.ready.then(gambar);
    return t;
  }, [lebar, dalam, warna]);
  return (
    <mesh position={posisi} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[lebar - 0.03, dalam - 0.01]} />
      <meshStandardMaterial map={tekstur} roughness={0.5} />
    </mesh>
  );
}

/** Stapler kecil. */
export function Stapler({ posisi, putar = 0 }: { posisi: V3; putar?: number }) {
  return (
    <group position={posisi} rotation={[0, putar, 0]}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.2, 0.03, 0.06]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.2, 0.04, 0.05]} />
        <meshStandardMaterial color="#ef6a4c" />
      </mesh>
    </group>
  );
}

/** Gelas pulpen. */
export function GelasPulpen({ posisi }: { posisi: V3 }) {
  return (
    <group position={posisi}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.055, 0.045, 0.12, 12]} />
        <meshStandardMaterial color="#836ef9" />
      </mesh>
      {['#ef6a4c', '#76a0e2', '#f4b829', '#231e16'].map((c, i) => (
        <mesh key={c} position={[Math.sin(i * 1.7) * 0.025, 0.14, Math.cos(i * 1.7) * 0.025]} rotation={[Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15]}>
          <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

/** Selotip (torus). */
export function Selotip({ posisi }: { posisi: V3 }) {
  return (
    <mesh position={[posisi[0], posisi[1] + 0.03, posisi[2]]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.06, 0.025, 8, 20]} />
      <meshStandardMaterial color="#c9b58a" roughness={0.4} />
    </mesh>
  );
}

/** Kanopi bergaris di atas konter depan (teras toko). */
export function Kanopi({ posisi, lebar, warna }: { posisi: V3; lebar: number; warna: string }) {
  const tekstur = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? '#fbfaf3' : warna;
      g.fillRect(i * 32, 0, 32, 64);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(lebar / 1.6, 1);
    return t;
  }, [lebar, warna]);
  return (
    <group position={posisi}>
      <mesh rotation={[0.42, 0, 0]}>
        <boxGeometry args={[lebar, 0.06, 1.5]} />
        <meshStandardMaterial map={tekstur} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.3, 0.68]}>
        <boxGeometry args={[lebar, 0.22, 0.05]} />
        <meshStandardMaterial map={tekstur} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.42, 0.68]}>
        <boxGeometry args={[lebar + 0.04, 0.05, 0.08]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (lebar - 0.3)) / 2, -0.9, 0.62]} rotation={[-0.35, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.3, 8]} />
          <meshStandardMaterial color={TINTA} />
        </mesh>
      ))}
    </group>
  );
}

/** Lampu gantung: kabel + kap + bola menyala. */
export function LampuGantung({ posisi, warna = '#f4b829' }: { posisi: V3; warna?: string }) {
  return (
    <group position={posisi}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        <meshStandardMaterial color={TINTA} />
      </mesh>
      <mesh>
        <coneGeometry args={[0.32, 0.3, 24, 1, true]} />
        <meshStandardMaterial color={warna} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.09, 14, 10]} />
        <meshBasicMaterial color="#fff6c8" toneMapped={false} />
      </mesh>
      <pointLight position={[0, -0.15, 0]} intensity={1.6} distance={5} decay={1.6} color="#ffe9b8" />
    </group>
  );
}

/** Karpet sambutan bertulisan. */
export function Karpet({ posisi, teks, warna, lebar = 2.2, dalam = 1.1 }: { posisi: V3; teks: string; warna: string; lebar?: number; dalam?: number }) {
  const tekstur = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round((512 * dalam) / lebar);
    const g = c.getContext('2d')!;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const gambar = () => {
      g.fillStyle = warna;
      g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#fbfaf3';
      g.lineWidth = 10;
      g.strokeRect(16, 16, c.width - 32, c.height - 32);
      g.fillStyle = '#fbfaf3';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `${Math.round(c.height * 0.42)}px "Lilita One", system-ui`;
      g.fillText(teks, c.width / 2, c.height / 2);
      t.needsUpdate = true;
    };
    gambar();
    document.fonts?.ready.then(gambar);
    return t;
  }, [teks, warna, lebar, dalam]);
  return (
    <mesh position={posisi} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[lebar, dalam]} />
      <meshStandardMaterial map={tekstur} roughness={0.95} />
    </mesh>
  );
}

/** Sobekan kertas di lantai. */
export function Sobekan({ posisi, putar = 0, s = 1 }: { posisi: V3; putar?: number; s?: number }) {
  return (
    <mesh position={[posisi[0], 0.005, posisi[2]]} rotation={[-Math.PI / 2, 0, putar]} scale={s}>
      <planeGeometry args={[0.22, 0.3]} />
      <meshStandardMaterial color="#fbfaf3" />
    </mesh>
  );
}

/** Spesifikasi satu ubin konter untuk `KonterGabung`. */
export type SpecKonter = { posisi: V3; putar?: number; badan?: string; atas?: string; les?: string; muka?: 'pintu' | 'laci' | 'polos'; lebar?: number; dalam?: number };

/**
 * Semua konter digabung jadi satu mesh per warna (hemat draw call: 24 konter × 7 mesh → ±6 mesh).
 * Bentuknya sama dengan `Konter`.
 */
export function KonterGabung({ daftar }: { daftar: SpecKonter[] }) {
  const grup = useMemo(() => {
    const perWarna = new Map<string, THREE.BufferGeometry[]>();
    const tambah = (warna: string, w: number, h: number, d: number, x: number, y: number, z: number, s: SpecKonter) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      g.rotateY(s.putar ?? 0);
      g.translate(s.posisi[0], s.posisi[1], s.posisi[2]);
      (perWarna.get(warna) ?? perWarna.set(warna, []).get(warna)!).push(g);
    };
    const t = TINGGI_MEJA;
    for (const s of daftar) {
      const lebar = s.lebar ?? 1, dalam = s.dalam ?? DALAM_MEJA, badan = s.badan ?? '#fbf4e4', atas = s.atas ?? '#efd6a6', les = s.les ?? '#836ef9', muka = s.muka ?? 'pintu';
      const zMuka = dalam / 2 - 0.02;
      tambah(TINTA, lebar - 0.04, 0.1, dalam - 0.1, 0, 0.05, -0.02, s);
      tambah(badan, lebar - 0.02, t - 0.17, dalam - 0.04, 0, 0.1 + (t - 0.17) / 2, 0, s);
      tambah(les, lebar, 0.06, dalam - 0.02, 0, t - 0.1, 0.005, s);
      tambah(TINTA, lebar + 0.02, 0.08, dalam + 0.04, 0, t - 0.04, 0, s);
      tambah(atas, lebar - 0.03, 0.012, dalam - 0.01, 0, t - 0.003, 0, s);
      if (muka === 'pintu')
        for (const k of [-1, 1]) {
          tambah(badan, lebar / 2 - 0.09, t - 0.3, 0.025, (k * lebar) / 4, 0.1 + (t - 0.17) / 2, zMuka, s);
          tambah(TINTA, 0.03, 0.12, 0.03, (k * lebar) / 4 - k * (lebar / 4 - 0.09), 0.1 + (t - 0.17) / 2 + 0.12, zMuka + 0.025, s);
        }
      if (muka === 'laci')
        for (let i = 0; i < 3; i++) {
          tambah(badan, lebar - 0.12, 0.13, 0.025, 0, 0.2 + i * 0.17, zMuka, s);
          tambah(TINTA, 0.22, 0.03, 0.03, 0, 0.22 + i * 0.17, zMuka + 0.022, s);
        }
    }
    return [...perWarna].map(([warna, gs]) => [warna, mergeGeometries(gs)] as const);
  }, [daftar]);
  return (
    <group>
      {grup.map(([warna, geo]) => (
        <mesh key={warna} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial color={warna} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
