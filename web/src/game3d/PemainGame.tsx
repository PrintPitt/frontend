// Pemain yang dikendalikan keyboard: WASD/panah gerak, Shift lari. Posisi disimpan di ref (tanpa render ulang per frame).
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type * as THREE from 'three';
import { Pekerja3D } from '../arena3d/Pekerja3D';
import { selesaikanTabrakan, stasiunTerdekat, type IdStasiun } from './peta';

export type PosPemain = { x: number; z: number; arah: number };

const KECEPATAN = 4.2;

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
  bekerja,
  onFokus,
}: {
  warna: string;
  tombol: React.RefObject<Set<string>>;
  pos: React.RefObject<PosPemain>;
  pegang?: ReactNode;
  bekerja?: boolean;
  onFokus: (id: IdStasiun | null) => void;
}) {
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
    <group ref={grup}>
      <Pekerja3D warna={warna} posisi={[0, 0, 0]} gaya={jalan ? 'jalan' : bekerja ? 'kerja' : 'diam'} pegang={pegang} />
    </group>
  );
}
