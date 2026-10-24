// Machine effects while working (read every frame from the world ref, no React re-render) + floating numbers/text (juice).
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Dunia } from './logika';
import { MESIN, TINGGI_MEJA, type IdMesin } from './peta';

const aktif = (st: string) => st === 'jalan' || st === 'tahan';

/** Copier: green light sweeps under the glass + paper stack comes out on the front tray. */
function EfekFotokopi({ id, dunia }: { id: IdMesin; dunia: RefObject<Dunia> }) {
  const sapu = useRef<THREE.Mesh>(null);
  const kertas = useRef<THREE.Group>(null);
  const kilat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const m = dunia.current.mesin[id];
    const on = aktif(m.status);
    if (sapu.current) {
      sapu.current.visible = on;
      sapu.current.position.z = Math.sin(clock.elapsedTime * 6) * 0.3;
    }
    if (kilat.current) kilat.current.opacity = on ? 0.35 + Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.4 : 0;
    if (kertas.current) {
      const n = m.status === 'selesai' ? 1 : on ? m.progres : 0;
      kertas.current.visible = n > 0.05;
      kertas.current.scale.y = Math.max(0.05, n);
    }
  });
  return (
    <group>
      {/* flash on the scanner glass */}
      <mesh position={[0, 1.575, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial ref={kilat} color="#9bffb0" transparent opacity={0} toneMapped={false} />
      </mesh>
      <mesh ref={sapu} position={[0, 1.585, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[0.8, 0.06]} />
        <meshBasicMaterial color="#5fff8a" toneMapped={false} />
      </mesh>
      {/* output paper on the front tray (grows with progress) */}
      <group ref={kertas} position={[-0.1, 0.62, 0.62]} visible={false}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, i * 0.02, i * 0.012]} rotation={[0, (i % 2 ? 1 : -1) * 0.05, 0]}>
            <boxGeometry args={[0.32, 0.012, 0.24]} />
            <meshStandardMaterial color="#fbfaf3" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Printer: a sheet slides out the front, green LED blinks; jam = tilted sheet + red LED. */
function EfekPrinter({ id, dunia }: { id: IdMesin; dunia: RefObject<Dunia> }) {
  const lembar = useRef<THREE.Mesh>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const bahanLembar = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = dunia.current.mesin[id];
    const on = aktif(m.status);
    const p = m.status === 'selesai' ? 1 : on ? m.progres : m.status === 'macet' ? 0.4 : 0;
    if (lembar.current) {
      lembar.current.visible = p > 0.02;
      lembar.current.position.z = 0.3 + p * 0.42;
      lembar.current.rotation.z = m.status === 'macet' ? Math.sin(clock.elapsedTime * 50) * 0.08 : 0;
      lembar.current.rotation.x = m.status === 'macet' ? 0.5 : 0.06;
    }
    if (bahanLembar.current) bahanLembar.current.color.set(m.status === 'macet' ? '#3d3935' : '#fbfaf3');
    if (led.current) led.current.color.set(m.status === 'macet' ? (Math.sin(clock.elapsedTime * 20) > 0 ? '#ff3b3b' : '#5a1111') : on ? (Math.sin(clock.elapsedTime * 12) > 0 ? '#5fff8a' : '#1f6b35') : '#1f6b35');
  });
  return (
    <group position={[0, TINGGI_MEJA, 0]}>
      <mesh ref={lembar} position={[0, 0.1, 0.3]} rotation={[0.06, 0, 0]} visible={false} castShadow>
        <boxGeometry args={[0.46, 0.008, 0.34]} />
        <meshStandardMaterial ref={bahanLembar} color="#fbfaf3" />
      </mesh>
      <mesh position={[0.36, 0.42, 0.33]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial ref={led} color="#1f6b35" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Laminator: pulsing orange glow + rising hot steam + laminated sheet comes out the front. */
function EfekLaminator({ id, dunia }: { id: IdMesin; dunia: RefObject<Dunia> }) {
  const cahaya = useRef<THREE.MeshBasicMaterial>(null);
  const lembar = useRef<THREE.Mesh>(null);
  const uap = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const m = dunia.current.mesin[id];
    const on = aktif(m.status);
    const t = clock.elapsedTime;
    if (cahaya.current) cahaya.current.opacity = on ? 0.35 + Math.sin(t * 9) * 0.2 : m.status === 'selesai' ? 0.15 : 0;
    const p = m.status === 'selesai' ? 1 : on ? m.progres : 0;
    if (lembar.current) {
      lembar.current.visible = p > 0.02;
      lembar.current.position.z = 0.28 + p * 0.44;
    }
    uap.current.forEach((u, i) => {
      if (!u) return;
      const fase = (t * 0.9 + i * 0.37) % 1;
      u.visible = on;
      u.position.set(-0.2 + i * 0.13, 0.36 + fase * 0.5, -0.05 + Math.sin(t * 3 + i) * 0.04);
      u.scale.setScalar(0.6 + fase);
      (u.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - fase);
    });
  });
  return (
    <group position={[0, TINGGI_MEJA, 0]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.95]} />
        <meshBasicMaterial ref={cahaya} color="#ff9a3c" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={lembar} position={[0, 0.09, 0.28]} visible={false} castShadow>
        <boxGeometry args={[0.44, 0.012, 0.32]} />
        <meshStandardMaterial color="#e4f2f4" roughness={0.05} metalness={0.2} transparent opacity={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => void (uap.current[i] = el)} visible={false}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function EfekMesin({ id, dunia }: { id: IdMesin; dunia: RefObject<Dunia> }) {
  const m = MESIN[id];
  return (
    <group position={[m.x, 0, m.z]} rotation={[0, m.putar, 0]}>
      {m.kode === 1 ? <EfekFotokopi id={id} dunia={dunia} /> : m.kode === 2 ? <EfekPrinter id={id} dunia={dunia} /> : <EfekLaminator id={id} dunia={dunia} />}
    </group>
  );
}

// ---------- floating text ----------
export type Melayang = { teks: string; warna: string; x: number; y: number; z: number; t0: number; tekstur?: THREE.CanvasTexture; lebar?: number };
const UMUR = 1.5;

function teksturTeks(teks: string, warna: string) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = '64px "Lilita One", system-ui';
  g.font = font;
  const w = Math.ceil(g.measureText(teks).width) + 40;
  c.width = w;
  c.height = 90;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#231e16';
  g.strokeText(teks, w / 2, 45);
  g.fillStyle = warna;
  g.fillText(teks, w / 2, 45);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return [t, w / 90] as const;
}

/** Up to 8 floating texts at once; `daftar` is filled from outside (push), cleaned up here. */
export function TeksMelayang({ daftar }: { daftar: RefObject<Melayang[]> }) {
  const slot = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const now = performance.now() / 1000;
    const d = daftar.current;
    for (let i = d.length - 1; i >= 0; i--) if (now - d[i].t0 > UMUR) d.splice(i, 1);
    slot.current.forEach((m, i) => {
      if (!m) return;
      const it = d[i];
      if (!it) {
        m.visible = false;
        return;
      }
      if (!it.tekstur) [it.tekstur, it.lebar] = teksturTeks(it.teks, it.warna);
      const u = (now - it.t0) / UMUR;
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat.map !== it.tekstur) {
        mat.map = it.tekstur;
        mat.needsUpdate = true;
      }
      m.visible = true;
      m.position.set(it.x, it.y + u * 1.1 + Math.sin(u * Math.PI) * 0.2, it.z);
      const s = 0.42 * (u < 0.15 ? 0.6 + (u / 0.15) * 0.6 : 1.2 - (u - 0.15) * 0.25);
      m.scale.set(s * (it.lebar ?? 2), s, 1);
      mat.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    });
  });
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <Billboard key={i}>
          <mesh ref={(el) => void (slot.current[i] = el)} visible={false} renderOrder={9}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent toneMapped={false} depthTest={false} />
          </mesh>
        </Billboard>
      ))}
    </>
  );
}
