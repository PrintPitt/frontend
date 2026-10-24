// Tukang fotokopi 3D: karakter beranimasi Delixia (Idle/Walking/Run/SambaDancing), badan diwarnai sesuai toko,
// cincin warna di kaki ala Overcooked, bisa membawa kertas/dokumen.
import { useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as klonSkin } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Aksi = 'Idle' | 'Walking' | 'Run' | 'SambaDancing' | 'Jump';
export type Bawaan3D = 'kertas' | 'ktp' | 'ijazah' | 'menu' | null;

const WARNA_BAWAAN: Record<Exclude<Bawaan3D, null>, string> = { kertas: '#fbfaf3', ktp: '#76a0e2', ijazah: '#fbfaf3', menu: '#93d3b0' };
const URL = '/models/delixia/character.glb';
const TINGGI = 1.3; // m, sedikit di atas tinggi meja seperti chef Overcooked

export function Karakter3D({
  warna,
  posisi,
  putar = 0,
  aksi = 'Idle',
  bawa = null,
  cincin = true,
}: {
  warna: string;
  posisi: [number, number, number];
  putar?: number;
  aksi?: Aksi;
  bawa?: Bawaan3D;
  cincin?: boolean;
}) {
  const { scene, animations } = useGLTF(URL);
  const klon = useMemo(() => {
    const c = klonSkin(scene);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat?.name === 'Body') {
        m.material = mat.clone();
        (m.material as THREE.MeshStandardMaterial).color = new THREE.Color(warna);
      }
    });
    return c;
  }, [scene, warna]);
  const akar = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, akar);
  useEffect(() => {
    const a = actions[aksi];
    a?.reset().fadeIn(0.25).play();
    return () => {
      a?.fadeOut(0.25);
    };
  }, [aksi, actions]);

  const skala = TINGGI / 1.84;
  return (
    <group position={posisi} rotation={[0, putar, 0]}>
      <group ref={akar} scale={skala}>
        <primitive object={klon} />
      </group>
      {cincin && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.36, 0.46, 48]} />
          <meshBasicMaterial color={warna} transparent opacity={0.9} />
        </mesh>
      )}
      {bawa && (
        <mesh position={[0, 0.72, 0.34]} rotation={[-0.25, 0, 0]} castShadow>
          <boxGeometry args={[0.34, 0.02, 0.26]} />
          <meshStandardMaterial color={WARNA_BAWAAN[bawa]} />
        </mesh>
      )}
    </group>
  );
}

useGLTF.preload(URL);
