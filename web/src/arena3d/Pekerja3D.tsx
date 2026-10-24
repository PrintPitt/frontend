// Tukang fotokopi 3D prosedural ala chef Overcooked: kepala bulat besar, topi warna toko, celemek, tangan melayang.
// Animasi sederhana di useFrame: jalan (badan memantul, tangan berayun) dan diam (napas).
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type * as THREE from 'three';

export type Gaya = 'diam' | 'jalan' | 'kerja';
export type Bawa = 'kertas' | 'ktp' | 'ijazah' | 'menu' | null;
const WARNA_BAWA: Record<Exclude<Bawa, null>, string> = { kertas: '#fbfaf3', ktp: '#76a0e2', ijazah: '#fbfaf3', menu: '#93d3b0' };

export function Pekerja3D({
  warna,
  posisi,
  putar = 0,
  gaya = 'diam',
  bawa = null,
  topi = true,
  kulit = '#f1c9a5',
  rambut = '#3d2a1e',
  cincin = true,
  fase = 0,
  pegang,
}: {
  /** Barang 3D di tangan (menggantikan `bawa`). */
  pegang?: ReactNode;
  warna: string;
  posisi: [number, number, number];
  putar?: number;
  gaya?: Gaya;
  bawa?: Bawa;
  topi?: boolean;
  kulit?: string;
  rambut?: string;
  cincin?: boolean;
  fase?: number;
}) {
  const badan = useRef<THREE.Group>(null);
  const tKiri = useRef<THREE.Mesh>(null);
  const tKanan = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (gaya === 'jalan' ? 9 : gaya === 'kerja' ? 12 : 2) + fase;
    if (badan.current) {
      badan.current.position.y = gaya === 'jalan' ? Math.abs(Math.sin(t)) * 0.08 : Math.sin(t) * 0.012;
      badan.current.rotation.z = gaya === 'jalan' ? Math.sin(t) * 0.07 : 0;
    }
    const ayun = gaya === 'jalan' ? Math.sin(t) * 0.12 : gaya === 'kerja' ? Math.sin(t) * 0.06 : 0;
    const maju = bawa || pegang ? 0.12 : 0;
    if (tKiri.current) tKiri.current.position.z = 0.16 + ayun + maju;
    if (tKanan.current) tKanan.current.position.z = 0.16 - ayun + maju;
    if (gaya === 'kerja' && tKanan.current) tKanan.current.position.y = 0.62 + Math.abs(Math.sin(t)) * 0.08;
  });

  return (
    <group position={posisi} rotation={[0, putar, 0]}>
      {cincin && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.38, 0.48, 48]} />
          <meshBasicMaterial color={warna} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.33, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
      <group ref={badan}>
        {/* kaki */}
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.08, 0.02]} castShadow>
            <capsuleGeometry args={[0.07, 0.06, 4, 10]} />
            <meshStandardMaterial color="#3d3935" />
          </mesh>
        ))}
        {/* badan + celemek */}
        <mesh position={[0, 0.48, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.3, 6, 18]} />
          <meshStandardMaterial color={warna} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.42, 0.2]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[0.3, 0.36, 0.06]} />
          <meshStandardMaterial color="#fbfaf3" />
        </mesh>
        <mesh position={[0, 0.46, 0.235]}>
          <boxGeometry args={[0.12, 0.08, 0.02]} />
          <meshStandardMaterial color="#d8d0c0" />
        </mesh>
        {/* kepala */}
        <mesh position={[0, 0.98, 0]} castShadow>
          <sphereGeometry args={[0.3, 24, 18]} />
          <meshStandardMaterial color={kulit} roughness={0.8} />
        </mesh>
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 1.0, 0.27]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshBasicMaterial color="#231e16" />
          </mesh>
        ))}
        {[-0.17, 0.17].map((x) => (
          <mesh key={x} position={[x, 0.92, 0.23]}>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshBasicMaterial color="#ef8a7a" transparent opacity={0.6} />
          </mesh>
        ))}
        {/* topi toko (atau rambut untuk pelanggan) */}
        {topi ? (
          <group position={[0, 1.08, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.31, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={warna} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.005, 0.24]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[0.36, 0.035, 0.24]} />
              <meshStandardMaterial color="#2a2163" />
            </mesh>
            <mesh position={[0, 0.31, 0]}>
              <sphereGeometry args={[0.05, 10, 8]} />
              <meshStandardMaterial color="#2a2163" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, 1.08, -0.02]} castShadow>
            <sphereGeometry args={[0.31, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
            <meshStandardMaterial color={rambut} roughness={0.9} />
          </mesh>
        )}
        {/* tangan melayang */}
        <mesh ref={tKiri} position={[-0.32, 0.55, 0.16]} castShadow>
          <sphereGeometry args={[0.085, 14, 10]} />
          <meshStandardMaterial color={kulit} />
        </mesh>
        <mesh ref={tKanan} position={[0.32, 0.55, 0.16]} castShadow>
          <sphereGeometry args={[0.085, 14, 10]} />
          <meshStandardMaterial color={kulit} />
        </mesh>
        {pegang && <group position={[0, 0.66, 0.36]}>{pegang}</group>}
        {bawa && (
          <mesh position={[0, 0.6, 0.36]} rotation={[-0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.44, 0.025, 0.32]} />
            <meshStandardMaterial color={WARNA_BAWA[bawa]} />
          </mesh>
        )}
      </group>
    </group>
  );
}
