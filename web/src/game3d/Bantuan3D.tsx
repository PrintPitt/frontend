// Player helpers: loading screen (asset progress), pointer arrow to the counter when an order waits and the player is idle, hearts when a customer is served.
import { Billboard, useProgress } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/** HTML overlay outside the Canvas: shown until 3D assets finish loading (+ a short pause). */
export function LayarMuat() {
  const { progress, active } = useProgress();
  const [tampil, setTampil] = useState(true);
  useEffect(() => {
    if (active || progress < 100) return;
    const t = setTimeout(() => setTampil(false), 500);
    return () => clearTimeout(t);
  }, [active, progress]);
  if (!tampil) return null;
  return (
    <div className="layar-muat">
      <div className="kartu-muat">
        <div className="judul-muat">OPENING SHOP…</div>
        <div className="bar-muat">
          <div style={{ width: `${Math.max(8, progress)}%` }} />
        </div>
        <div className="kecil-muat">setting up copier, printer, laminator</div>
      </div>
    </div>
  );
}

/** Yellow arrow bouncing above point (x, z); shown when `aktif`. */
export function PanahPetunjuk({ x, z, y = 1.6, aktif }: { x: number; z: number; y?: number; aktif: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.visible = aktif;
    g.current.position.y = y + Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.25;
    g.current.rotation.y = clock.elapsedTime * 1.5;
  });
  return (
    <group ref={g} position={[x, y, z]} visible={false}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.22, 0.4, 4]} />
        <meshStandardMaterial color="#f4b829" />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.16, 0.4, 0.16]} />
        <meshStandardMaterial color="#f4b829" />
      </mesh>
    </group>
  );
}

const cacheHati = new Map<string, THREE.CanvasTexture>();
function teksturHati(warna: string) {
  let t = cacheHati.get(warna);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = warna;
  g.strokeStyle = '#231e16';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(32, 56);
  g.bezierCurveTo(4, 36, 8, 8, 32, 20);
  g.bezierCurveTo(56, 8, 60, 36, 32, 56);
  g.closePath();
  g.fill();
  g.stroke();
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheHati.set(warna, t);
  return t;
}

/** Burst of hearts rising from a point; `kunci` change = new burst. */
export function SemburanHati({ x, z, y = 1.4, kunci }: { x: number; z: number; y?: number; kunci: number }) {
  const slot = useRef<(THREE.Mesh | null)[]>([]);
  const mulai = useRef(-10);
  const sebelum = useRef(kunci);
  useFrame(({ clock }) => {
    if (kunci !== sebelum.current) {
      sebelum.current = kunci;
      mulai.current = clock.elapsedTime;
    }
    const u = (clock.elapsedTime - mulai.current) / 1.3;
    slot.current.forEach((m, i) => {
      if (!m) return;
      const tampil = u >= 0 && u < 1;
      m.visible = tampil;
      if (!tampil) return;
      const a = i * 1.26;
      m.position.set(x + Math.sin(a) * (0.25 + u * 0.4), y + u * 1.2 + i * 0.1, z + Math.cos(a) * 0.2);
      const s = 0.3 * (1 - u * 0.5);
      m.scale.set(s, s, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - u;
    });
  });
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <Billboard key={i}>
          <mesh ref={(el) => void (slot.current[i] = el)} visible={false} renderOrder={9}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={teksturHati(i % 2 ? '#f08fb0' : '#ef6a4c')} transparent toneMapped={false} depthTest={false} />
          </mesh>
        </Billboard>
      ))}
    </>
  );
}
