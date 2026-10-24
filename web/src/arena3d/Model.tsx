// GLB model loader (Delixia assets, Apache-2.0): clone, scale to target size, base at y = 0, footprint centered at (0, 0).
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

export function Model({
  url,
  posisi = [0, 0, 0],
  putar = 0,
  lebar,
  tinggi,
  warna,
}: {
  url: string;
  posisi?: [number, number, number];
  putar?: number;
  /** Target width (m) along the model's x axis before rotation. */
  lebar?: number;
  /** Target height (m). */
  tinggi?: number;
  /** Tint color applied to all materials. */
  warna?: string;
}) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);
    const ukuran = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3());
    const s = lebar ? lebar / ukuran.x : tinggi ? tinggi / ukuran.y : 1;
    c.scale.multiplyScalar(s);
    // width + height together: height is scaled separately (e.g. counter made waist-high)
    if (lebar && tinggi) c.scale.y *= tinggi / (ukuran.y * s);
    c.updateMatrixWorld(true);
    const kotak = new THREE.Box3().setFromObject(c);
    const pusat = kotak.getCenter(new THREE.Vector3());
    c.position.set(c.position.x - pusat.x, c.position.y - kotak.min.y, c.position.z - pusat.z);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (warna) {
        m.material = (m.material as THREE.MeshStandardMaterial).clone();
        (m.material as THREE.MeshStandardMaterial).color = new THREE.Color(warna);
      }
    });
    const g = new THREE.Group();
    g.add(c);
    return g;
  }, [scene, lebar, tinggi, warna]);
  return <primitive object={obj} position={posisi} rotation={[0, putar, 0]} />;
}

export const MODEL = (nama: string) => `/models/delixia/${nama}.glb`;
