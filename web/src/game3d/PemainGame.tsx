// Pemain yang dikendalikan keyboard: WASD/panah gerak, Shift lari. Posisi disimpan di ref (tanpa render ulang per frame).
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Pekerja3D, type ModelKarakter } from '../arena3d/Pekerja3D';
import { selesaikanTabrakan, stasiunTerdekat, type IdStasiun } from './peta';

export type PosPemain = { x: number; z: number; arah: number };

const KECEPATAN = 4.2;
const SKALA = 1.22;
const JUMLAH_DEBU = 12;

export function useTombol() {
  const tombol = useRef(new Set<string>());
  useEffect(() => {
    const turun = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      tombol.current.add(k);
    };
    const naik = (e: KeyboardEvent) => tombol.current.delete(e.key.toLowerCase());
    const hilang = () => tombol.current.clear();
    addEventListener('keydown', turun);
    addEventListener('keyup', naik);
    addEventListener('blur', hilang);
    return () => {
      removeEventListener('keydown', turun);
      removeEventListener('keyup', naik);
      removeEventListener('blur', hilang);
    };
  }, []);
  return tombol;
}

export function PemainGame({
  warna,
  tombol,
  pos,
  pegang,
  kunciPegang,
  bekerja,
  onFokus,
  model = 'tukang',
  kulit,
  rambut,
  nama,
}: {
  model?: ModelKarakter;
  kulit?: string;
  rambut?: string;
  /** Nama tampilan di atas kepala. */
  nama?: string;
  warna: string;
  tombol: React.RefObject<Set<string>>;
  pos: React.RefObject<PosPemain>;
  pegang?: ReactNode;
  kunciPegang?: string;
  bekerja?: boolean;
  onFokus: (id: IdStasiun | null) => void;
}) {
  const debu = useRef<(THREE.Mesh | null)[]>([]);
  const umurDebu = useRef<number[]>(Array(JUMLAH_DEBU).fill(1));
  const jedaDebu = useRef(0);
  const urutDebu = useRef(0);
  const grup = useRef<THREE.Group>(null);
  const [jalan, setJalan] = useState(false);
  const jalanRef = useRef(false);
  const fokusRef = useRef<IdStasiun | null>(null);

  useFrame((_, dtMentah) => {
    const dt = Math.min(dtMentah, 0.05);
    const t = tombol.current;
    let dx = 0;
    let dz = 0;
    if (t.has('w') || t.has('arrowup')) dz -= 1;
    if (t.has('s') || t.has('arrowdown')) dz += 1;
    if (t.has('a') || t.has('arrowleft')) dx -= 1;
    if (t.has('d') || t.has('arrowright')) dx += 1;
    const p = pos.current;
    const bergerak = dx !== 0 || dz !== 0;
    if (bergerak) {
      const n = Math.hypot(dx, dz);
      const v = KECEPATAN * (t.has('shift') ? 1.7 : 1) * dt;
      [p.x, p.z] = selesaikanTabrakan(p.x + (dx / n) * v, p.z + (dz / n) * v);
      const target = Math.atan2(dx, dz);
      let beda = target - p.arah;
      beda = Math.atan2(Math.sin(beda), Math.cos(beda));
      p.arah += beda * Math.min(1, dt * 14);
    }
    // kepulan debu di kaki saat berjalan (lebih rapat saat lari)
    jedaDebu.current -= dt;
    if (bergerak && jedaDebu.current <= 0) {
      jedaDebu.current = t.has('shift') ? 0.06 : 0.14;
      const i = urutDebu.current++ % JUMLAH_DEBU;
      const m = debu.current[i];
      if (m) m.position.set(p.x - Math.sin(p.arah) * 0.25 + (Math.random() - 0.5) * 0.2, 0.08, p.z - Math.cos(p.arah) * 0.25 + (Math.random() - 0.5) * 0.2);
      umurDebu.current[i] = 0;
    }
    for (let i = 0; i < JUMLAH_DEBU; i++) {
      const m = debu.current[i];
      if (!m) continue;
      const u = (umurDebu.current[i] = Math.min(1, umurDebu.current[i] + dt / 0.45));
      m.visible = u < 1;
      m.scale.setScalar(0.5 + u * 1.3);
      m.position.y += dt * 0.35;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - u);
    }
    if (bergerak !== jalanRef.current) {
      jalanRef.current = bergerak;
      setJalan(bergerak);
    }
    if (grup.current) {
      grup.current.position.set(p.x, 0, p.z);
      grup.current.rotation.y = p.arah;
    }
    const f = stasiunTerdekat(p.x, p.z, p.arah);
    if (f !== fokusRef.current) {
      fokusRef.current = f;
      onFokus(f);
    }
  });

  return (
    <>
      <group ref={grup}>
        <Pekerja3D
          warna={warna}
          posisi={[0, 0, 0]}
          skala={SKALA}
          model={model}
          kulit={kulit}
          rambut={rambut}
          penanda
          gaya={jalan ? 'jalan' : bekerja ? 'kerja' : 'diam'}
          pegang={pegang}
          kunciPegang={kunciPegang}
        />
        {nama && <LabelNama teks={nama} warna={warna} />}
      </group>
      {Array.from({ length: JUMLAH_DEBU }, (_, i) => (
        <mesh key={i} ref={(m) => void (debu.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshBasicMaterial color="#fbfaf3" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** Papan nama kecil di atas kepala pemain (kanvas, selalu menghadap kamera). */
function LabelNama({ teks, warna }: { teks: string; warna: string }) {
  const [tekstur, lebar] = useMemo(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    const font = '56px "Lilita One", system-ui';
    g.font = font;
    const w = Math.ceil(g.measureText(teks).width) + 64;
    c.width = w;
    c.height = 92;
    const gambar = () => {
      g.clearRect(0, 0, w, 92);
      g.fillStyle = '#231e16';
      g.beginPath();
      g.roundRect(2, 2, w - 4, 84, 30);
      g.fill();
      g.fillStyle = warna;
      g.beginPath();
      g.roundRect(8, 8, w - 16, 68, 24);
      g.fill();
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 8;
      g.strokeStyle = '#231e16';
      g.strokeText(teks, w / 2, 44);
      g.fillStyle = '#fbfaf3';
      g.fillText(teks, w / 2, 44);
      t.needsUpdate = true;
    };
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    gambar();
    document.fonts?.ready.then(gambar);
    return [t, w / 92] as const;
  }, [teks, warna]);
  const tinggi = 0.3;
  return (
    <Billboard position={[0, 2.35, 0]}>
      <mesh renderOrder={8}>
        <planeGeometry args={[tinggi * lebar, tinggi]} />
        <meshBasicMaterial map={tekstur} transparent toneMapped={false} depthTest={false} />
      </mesh>
    </Billboard>
  );
}
