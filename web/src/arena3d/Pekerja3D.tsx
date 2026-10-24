// Procedural 3D copy-shop worker, Overcooked-chef style: round body, big head with expressive eyes, shop cap, apron,
// floating hands, ink outline. Animated in useFrame: walk (hop, squash-stretch, lean, stepping feet),
// idle (breathing + blinking), work (fast hands). Items are held in both hands with a "pop" effect when they change.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';

export type Gaya = 'diam' | 'jalan' | 'kerja';
export type ModelKarakter = 'pembeli' | 'tukang' | 'tukang-visor' | 'chef' | 'chef-polos' | 'chef-kucing' | 'topi' | 'kertas' | 'landak' | 'chibi';
export type Bawa = 'kertas' | 'ktp' | 'ijazah' | 'menu' | null;
const WARNA_BAWA: Record<Exclude<Bawa, null>, string> = { kertas: '#fbfaf3', ktp: '#76a0e2', ijazah: '#fbfaf3', menu: '#93d3b0' };
const TINTA = '#231e16';
const GARIS = 0.024;
/** Illustration-style ink outline: a slightly larger shell, only back faces drawn (inverted hull). */
const BAHAN_TINTA = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });

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
  kunciPegang,
  skala = 1,
  penanda = false,
  model = 'topi',
  tipe = 'mahasiswa',
}: {
  /** Customer type (only for model 'pembeli'). */
  tipe?: TipePembeli;
  /** Character look: baseball cap, folded paper hat, purple hedgehog, or chibi with bandana. */
  model?: ModelKarakter;
  /** 3D item in hand (replaces `bawa`). */
  pegang?: ReactNode;
  /** Changes when the held item changes → pop effect. */
  kunciPegang?: string;
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
  skala?: number;
  /** Facing-direction marker on the ring (for the player). */
  penanda?: boolean;
}) {
  const badan = useRef<THREE.Group>(null);
  const tKiri = useRef<THREE.Mesh>(null);
  const tKanan = useRef<THREE.Mesh>(null);
  const kKiri = useRef<THREE.Mesh>(null);
  const kKanan = useRef<THREE.Mesh>(null);
  const mata = useRef<THREE.Group>(null);
  const barang = useRef<THREE.Group>(null);
  const pop = useRef(0);
  const kedip = useRef(2 + (fase % 3));
  const bawaSesuatu = !!(bawa || pegang);

  useEffect(() => {
    if (kunciPegang) pop.current = 1;
  }, [kunciPegang]);

  useFrame(({ clock }, dt) => {
    const kec = gaya === 'jalan' ? 11 : gaya === 'kerja' ? 14 : 2.2;
    const t = clock.elapsedTime * kec + fase;
    const b = badan.current;
    if (b) {
      if (gaya === 'jalan') {
        const lompat = Math.abs(Math.sin(t));
        b.position.y = lompat * 0.1;
        const tekan = 1 - (1 - lompat) * 0.09;
        b.scale.set(1 + (1 - tekan) * 0.6, tekan, 1 + (1 - tekan) * 0.6);
        b.rotation.x = 0.16;
        b.rotation.z = Math.sin(t) * 0.07;
      } else {
        const napas = Math.sin(t) * 0.018;
        b.position.y = gaya === 'kerja' ? Math.abs(Math.sin(t)) * 0.03 : 0;
        b.scale.set(1 - napas * 0.5, 1 + napas, 1 - napas * 0.5);
        b.rotation.x = gaya === 'kerja' ? 0.12 : 0;
        b.rotation.z = 0;
      }
    }
    // stepping feet
    const langkah = gaya === 'jalan' ? Math.sin(t) : 0;
    if (kKiri.current) {
      kKiri.current.position.z = 0.03 + langkah * 0.11;
      kKiri.current.position.y = 0.08 + Math.max(0, langkah) * 0.06;
    }
    if (kKanan.current) {
      kKanan.current.position.z = 0.03 - langkah * 0.11;
      kKanan.current.position.y = 0.08 + Math.max(0, -langkah) * 0.06;
    }
    // hands: holding item (both in front), work (fast alternating), walk (swinging)
    if (tKiri.current && tKanan.current) {
      if (bawaSesuatu) {
        tKiri.current.position.set(-0.24, 0.62, 0.36);
        tKanan.current.position.set(0.24, 0.62, 0.36);
      } else if (gaya === 'kerja') {
        tKiri.current.position.set(-0.26, 0.66 + Math.max(0, Math.sin(t)) * 0.12, 0.36);
        tKanan.current.position.set(0.26, 0.66 + Math.max(0, -Math.sin(t)) * 0.12, 0.36);
      } else {
        const ayun = gaya === 'jalan' ? Math.sin(t) * 0.16 : 0;
        tKiri.current.position.set(-0.36, 0.52, 0.12 - ayun);
        tKanan.current.position.set(0.36, 0.52, 0.12 + ayun);
      }
    }
    // blink
    kedip.current -= dt;
    if (mata.current) mata.current.scale.y = kedip.current < 0.12 ? 0.12 : 1;
    if (kedip.current < 0) kedip.current = 2.2 + Math.random() * 2.5;
    // item pop
    if (barang.current) {
      pop.current = Math.max(0, pop.current - dt * 4);
      const p = pop.current;
      barang.current.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.45);
      barang.current.position.y = 0.7 + Math.sin(p * Math.PI) * 0.12;
    }
  });

  return (
    <group position={posisi} rotation={[0, putar, 0]} scale={skala}>
      {cincin && (
        <group position={[0, 0.02, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.54, 48]} />
            <meshBasicMaterial color={warna} toneMapped={false} />
          </mesh>
          {penanda && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.62]}>
              <circleGeometry args={[0.12, 3]} />
              <meshBasicMaterial color={warna} toneMapped={false} />
            </mesh>
          )}
        </group>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.36, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
      {/* feet */}
      {[kKiri, kKanan].map((r, i) => (
        <mesh key={i} ref={r} position={[i ? 0.11 : -0.11, 0.08, 0.03]}>
          <capsuleGeometry args={[0.075, 0.07, 4, 10]} />
          <meshStandardMaterial color="#3d3935" />
          <mesh material={BAHAN_TINTA}>
            <capsuleGeometry args={[0.075 + GARIS, 0.07, 4, 10]} />
          </mesh>
        </mesh>
      ))}
      <group ref={badan}>
        {model === 'pembeli' ? (
          <RupaPembeli warna={warna} kulit={kulit} rambut={rambut} mata={mata} tipe={tipe} />
        ) : model === 'tukang' || model === 'tukang-visor' ? (
          <RupaTukang warna={warna} kulit={kulit} rambut={rambut} mata={mata} varian={model === 'tukang' ? 'koran' : 'visor'} />
        ) : model === 'chef' || model === 'chef-polos' || model === 'chef-kucing' ? (
          <RupaChef warna={warna} kulit={kulit} mata={mata} varian={model === 'chef' ? 'kumis' : model === 'chef-polos' ? 'polos' : 'kucing'} />
        ) : model === 'kertas' ? (
          <RupaKertas warna={warna} kulit={kulit} mata={mata} />
        ) : model === 'landak' ? (
          <RupaLandak warna={warna} mata={mata} />
        ) : model === 'chibi' ? (
          <RupaChibi warna={warna} kulit={kulit} rambut={rambut} mata={mata} />
        ) : (
          <RupaTopi warna={warna} kulit={kulit} rambut={rambut} topi={topi} mata={mata} />
        )}
        {/* floating hands */}
        <mesh ref={tKiri} position={[-0.36, 0.52, 0.12]}>
          <sphereGeometry args={[0.09, 14, 10]} />
          <meshStandardMaterial color={model === 'landak' ? warna : model === 'chef-kucing' ? '#f4a259' : kulit} />
          <mesh material={BAHAN_TINTA}>
            <sphereGeometry args={[0.09 + GARIS * 0.8, 14, 10]} />
          </mesh>
        </mesh>
        <mesh ref={tKanan} position={[0.36, 0.52, 0.12]}>
          <sphereGeometry args={[0.09, 14, 10]} />
          <meshStandardMaterial color={model === 'landak' ? warna : model === 'chef-kucing' ? '#f4a259' : kulit} />
          <mesh material={BAHAN_TINTA}>
            <sphereGeometry args={[0.09 + GARIS * 0.8, 14, 10]} />
          </mesh>
        </mesh>
        {pegang && (
          <group ref={barang} position={[0, 0.7, 0.42]}>
            {pegang}
          </group>
        )}
        {bawa && (
          <mesh position={[0, 0.62, 0.38]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[0.44, 0.025, 0.32]} />
            <meshStandardMaterial color={WARNA_BAWA[bawa]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

type PropsRupa = { warna: string; kulit?: string; rambut?: string; mata: RefObject<THREE.Group | null> };

/** Original look: capsule body, big head, backwards baseball cap (customers: hair). */
function RupaTopi({ warna, kulit, rambut, topi, mata }: PropsRupa & { topi: boolean }) {
  return (
    <>
        {/* round body + apron */}
        <mesh position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.27, 0.24, 8, 20]} />
          <meshStandardMaterial color={warna} roughness={0.7} />
          <mesh material={BAHAN_TINTA}>
            <capsuleGeometry args={[0.27 + GARIS, 0.24, 8, 20]} />
          </mesh>
        </mesh>
        <mesh position={[0, 0.44, 0.215]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.32, 0.36, 0.07]} />
          <meshStandardMaterial color="#fbfaf3" />
        </mesh>
        <mesh position={[0, 0.5, 0.255]} rotation={[0.1, 0, 0]}>
          <circleGeometry args={[0.06, 20]} />
          <meshBasicMaterial color={warna} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.65, 0.2]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.36, 0.035, 0.06]} />
          <meshStandardMaterial color="#fbfaf3" />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.03, 0]}>
          <sphereGeometry args={[0.33, 28, 20]} />
          <meshStandardMaterial color={kulit} roughness={0.8} />
          <mesh material={BAHAN_TINTA}>
            <sphereGeometry args={[0.33 + GARIS, 28, 20]} />
          </mesh>
        </mesh>
        <group ref={mata} position={[0, 1.05, 0]}>
          {[-0.115, 0.115].map((x) => (
            <group key={x} position={[x, 0, 0.275]}>
              <mesh scale={[1, 1.25, 0.6]}>
                <sphereGeometry args={[0.072, 14, 10]} />
                <meshBasicMaterial color="#fbfaf3" />
              </mesh>
              <mesh position={[0, -0.01, 0.034]} scale={[1, 1.2, 0.6]}>
                <sphereGeometry args={[0.045, 12, 8]} />
                <meshBasicMaterial color={TINTA} />
              </mesh>
              <mesh position={[0.014, 0.018, 0.06]}>
                <sphereGeometry args={[0.015, 8, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, 1.155, 0.262]} rotation={[0.3, 0, x > 0 ? -0.18 : 0.18]}>
            <boxGeometry args={[0.09, 0.022, 0.02]} />
            <meshBasicMaterial color={TINTA} />
          </mesh>
        ))}
        <mesh position={[0, 0.95, 0.305]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.045, 0.012, 6, 14, Math.PI]} />
          <meshBasicMaterial color={TINTA} />
        </mesh>
        {[-0.19, 0.19].map((x) => (
          <mesh key={x} position={[x, 0.97, 0.25]}>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshBasicMaterial color="#ef8a7a" transparent opacity={0.55} />
          </mesh>
        ))}
        {/* shop cap (or hair for customers) */}
        {topi ? (
          <group position={[0, 1.17, -0.02]}>
            {/* cap turned backwards so the face shows from the top camera */}
            <mesh>
              <sphereGeometry args={[0.335, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={warna} roughness={0.6} />
              <mesh material={BAHAN_TINTA}>
                <sphereGeometry args={[0.335 + GARIS, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
            </mesh>
            <mesh position={[0, 0.01, -0.3]} rotation={[-0.12, 0, 0]}>
              <boxGeometry args={[0.38, 0.04, 0.24]} />
              <meshStandardMaterial color="#2a2163" />
            </mesh>
            <mesh position={[0, 0.2, 0.245]} rotation={[-0.68, 0, 0]}>
              <circleGeometry args={[0.085, 20]} />
              <meshBasicMaterial color="#fbfaf3" />
            </mesh>
            <mesh position={[0, 0.2, 0.25]} rotation={[-0.68, 0, 0]}>
              <circleGeometry args={[0.045, 20]} />
              <meshBasicMaterial color="#f4b829" />
            </mesh>
            <mesh position={[0, 0.33, 0]}>
              <sphereGeometry args={[0.055, 10, 8]} />
              <meshStandardMaterial color="#2a2163" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, 1.11, -0.03]}>
            <sphereGeometry args={[0.345, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
            <meshStandardMaterial color={rambut} roughness={0.9} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.345 + GARIS, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
            </mesh>
          </mesh>
        )}
    </>
  );
}

/** Overcooked-style dot eyes (black oval + shine). */
function MataTitik({ mata, y, z, jarak = 0.12, besar = 0.045 }: { mata: RefObject<THREE.Group | null>; y: number; z: number; jarak?: number; besar?: number }) {
  return (
    <group ref={mata} position={[0, y, z]}>
      {[-jarak, jarak].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh scale={[1, 1.45, 0.6]}>
            <sphereGeometry args={[besar, 12, 10]} />
            <meshBasicMaterial color={TINTA} />
          </mesh>
          <mesh position={[besar * 0.3, besar * 0.55, besar * 0.5]}>
            <sphereGeometry args={[besar * 0.32, 8, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Pipi({ y, z, x = 0.18 }: { y: number; z: number; x?: number }) {
  return (
    <>
      {[-x, x].map((xx) => (
        <mesh key={xx} position={[xx, y, z]} scale={[1, 0.7, 0.5]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshBasicMaterial color="#f08a7e" transparent opacity={0.6} />
        </mesh>
      ))}
    </>
  );
}

function Celemek({ y, z, lebar = 0.34, tinggi = 0.32, warna }: { y: number; z: number; lebar?: number; tinggi?: number; warna: string }) {
  return (
    <group position={[0, y, z]} rotation={[0.12, 0, 0]}>
      <mesh>
        <boxGeometry args={[lebar, tinggi, 0.06]} />
        <meshStandardMaterial color="#fbfaf3" />
      </mesh>
      <mesh position={[0, -tinggi * 0.12, 0.032]}>
        <boxGeometry args={[lebar * 0.5, tinggi * 0.3, 0.01]} />
        <meshStandardMaterial color="#efe6d2" />
      </mesh>
      <mesh position={[0, tinggi * 0.22, 0.034]}>
        <circleGeometry args={[0.05, 18]} />
        <meshBasicMaterial color={warna} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Folded newspaper hat: triangular prism with print lines + shop-color band. */
function TopiKertas({ warna }: { warna: string }) {
  const [geo, geoGaris] = useMemo(() => {
    const buat = (w: number, h: number, d: number) => {
      const bentuk = new THREE.Shape();
      bentuk.moveTo(-w / 2, 0);
      bentuk.lineTo(w / 2, 0);
      bentuk.lineTo(0, h);
      bentuk.closePath();
      const g = new THREE.ExtrudeGeometry(bentuk, { depth: d, bevelEnabled: false });
      g.translate(0, 0, -d / 2);
      return g;
    };
    return [buat(0.74, 0.44, 0.34), buat(0.74 + GARIS * 3, 0.44 + GARIS * 2.2, 0.34 + GARIS * 2)];
  }, []);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#f3efe4" roughness={0.9} />
      </mesh>
      <mesh geometry={geoGaris} material={BAHAN_TINTA} position={[0, -GARIS * 0.6, 0]} />
      <mesh position={[0, 0.28, 0.172]}>
        <boxGeometry args={[0.14, 0.035, 0.004]} />
        <meshBasicMaterial color="#3d3935" />
      </mesh>
      {[0.2, 0.15, 0.1].map((y, i) => (
        <mesh key={y} position={[0, y, 0.172]}>
          <boxGeometry args={[0.18 + i * 0.1, 0.014, 0.004]} />
          <meshBasicMaterial color="#9a958a" />
        </mesh>
      ))}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.76, 0.08, 0.37]} />
        <meshStandardMaterial color={warna} />
      </mesh>
    </group>
  );
}

/** Like an Overcooked chef: head sits on the body with no neck, dot eyes, folded paper hat. */
function RupaKertas({ warna, kulit, mata }: PropsRupa) {
  return (
    <>
      <mesh position={[0, 0.42, 0]}>
        <capsuleGeometry args={[0.31, 0.1, 8, 20]} />
        <meshStandardMaterial color={warna} roughness={0.7} />
        <mesh material={BAHAN_TINTA}>
          <capsuleGeometry args={[0.31 + GARIS, 0.1, 8, 20]} />
        </mesh>
      </mesh>
      <Celemek y={0.38} z={0.25} lebar={0.36} tinggi={0.34} warna={warna} />
      <mesh position={[0, 0.88, 0]}>
        <sphereGeometry args={[0.32, 28, 20]} />
        <meshStandardMaterial color={kulit} roughness={0.8} />
        <mesh material={BAHAN_TINTA}>
          <sphereGeometry args={[0.32 + GARIS, 28, 20]} />
        </mesh>
      </mesh>
      <MataTitik mata={mata} y={0.9} z={0.29} jarak={0.12} besar={0.048} />
      <Pipi y={0.82} z={0.27} x={0.19} />
      <mesh position={[0, 0.79, 0.3]} rotation={[0.3, 0, Math.PI]}>
        <torusGeometry args={[0.04, 0.011, 6, 14, Math.PI]} />
        <meshBasicMaterial color={TINTA} />
      </mesh>
      <group position={[0, 1.08, 0]}>
        <TopiKertas warna={warna} />
      </group>
    </>
  );
}

/** Purple hedgehog mascot in an apron: round furry body, spikes on back & head, cream snout. */
function RupaLandak({ warna, mata }: PropsRupa) {
  const duri = useMemo(() => {
    const hasil: { p: [number, number, number]; q: [number, number, number, number] }[] = [];
    const atas = new THREE.Vector3(0, 1, 0);
    for (let baris = 0; baris < 5; baris++) {
      const phi = 0.25 + baris * 0.3;
      const n = 5 + baris * 2;
      for (let i = 0; i < n; i++) {
        const theta = Math.PI * (0.5 + (i + (baris % 2) * 0.5) / n);
        const normal = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), -Math.sin(phi) * Math.sin(theta));
        if (normal.z > 0.35) continue;
        const pos = normal.clone().multiplyScalar(0.36).add(new THREE.Vector3(0, 0.6, 0));
        const q = new THREE.Quaternion().setFromUnitVectors(atas, normal.normalize());
        hasil.push({ p: [pos.x, pos.y, pos.z], q: [q.x, q.y, q.z, q.w] });
      }
    }
    return hasil;
  }, []);
  const gelap = useMemo(() => '#' + new THREE.Color(warna).lerp(new THREE.Color('#1a1238'), 0.55).getHexString(), [warna]);
  return (
    <>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.34, 0.16, 8, 20]} />
        <meshStandardMaterial color={warna} roughness={0.85} />
        <mesh material={BAHAN_TINTA}>
          <capsuleGeometry args={[0.34 + GARIS, 0.16, 8, 20]} />
        </mesh>
      </mesh>
      {duri.map((d, i) => (
        <mesh key={i} position={d.p} quaternion={d.q}>
          <coneGeometry args={[0.075, 0.24, 5]} />
          <meshStandardMaterial color={gelap} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.7, 0.2]} scale={[1.05, 0.9, 0.62]}>
        <sphereGeometry args={[0.24, 20, 14]} />
        <meshStandardMaterial color="#f6e3c8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.63, 0.34]}>
        <sphereGeometry args={[0.09, 14, 10]} />
        <meshStandardMaterial color="#f6e3c8" />
      </mesh>
      <mesh position={[0, 0.65, 0.43]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshBasicMaterial color={TINTA} />
      </mesh>
      <MataTitik mata={mata} y={0.76} z={0.33} jarak={0.1} besar={0.042} />
      <Pipi y={0.66} z={0.3} x={0.17} />
      {[-0.22, 0.22].map((x) => (
        <group key={x} position={[x, 0.95, 0.08]}>
          <mesh>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color={warna} />
          </mesh>
          <mesh position={[0, 0, 0.04]} scale={[0.6, 0.6, 0.4]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshBasicMaterial color="#f3a3b4" />
          </mesh>
        </group>
      ))}
      <Celemek y={0.38} z={0.3} lebar={0.38} tinggi={0.3} warna={warna} />
    </>
  );
}

/** Chibi: big head, hair with bangs, shop-color bandana, big shiny eyes. */
function RupaChibi({ warna, kulit, rambut = '#2d2440', mata }: PropsRupa) {
  return (
    <>
      <mesh position={[0, 0.4, 0]}>
        <capsuleGeometry args={[0.23, 0.16, 8, 18]} />
        <meshStandardMaterial color={warna} roughness={0.7} />
        <mesh material={BAHAN_TINTA}>
          <capsuleGeometry args={[0.23 + GARIS, 0.16, 8, 18]} />
        </mesh>
      </mesh>
      <Celemek y={0.37} z={0.2} lebar={0.28} tinggi={0.28} warna={warna} />
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.39, 28, 20]} />
        <meshStandardMaterial color={kulit} roughness={0.8} />
        <mesh material={BAHAN_TINTA}>
          <sphereGeometry args={[0.39 + GARIS, 28, 20]} />
        </mesh>
      </mesh>
      <mesh position={[0, 1.0, -0.04]}>
        <sphereGeometry args={[0.405, 28, 14, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
        <meshStandardMaterial color={rambut} roughness={0.9} />
        <mesh material={BAHAN_TINTA}>
          <sphereGeometry args={[0.405 + GARIS, 28, 14, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
        </mesh>
      </mesh>
      {[-0.17, 0, 0.17].map((x, i) => (
        <mesh key={x} position={[x, 1.12 - (i === 1 ? 0.03 : 0), 0.28]} scale={[1, 0.8, 0.7]}>
          <sphereGeometry args={[0.13, 12, 10]} />
          <meshStandardMaterial color={rambut} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.16, -0.02]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <torusGeometry args={[0.395, 0.045, 8, 32]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 1.06, -0.43]} rotation={[0.6, 0, x * 6]}>
          <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
          <meshStandardMaterial color={warna} />
        </mesh>
      ))}
      <group ref={mata} position={[0, 0.94, 0.335]}>
        {[-0.14, 0.14].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh scale={[1, 1.2, 0.5]}>
              <sphereGeometry args={[0.085, 14, 10]} />
              <meshBasicMaterial color="#fbfaf3" />
            </mesh>
            <mesh position={[0, -0.01, 0.03]} scale={[1, 1.2, 0.5]}>
              <sphereGeometry args={[0.06, 12, 8]} />
              <meshBasicMaterial color="#3b2a20" />
            </mesh>
            <mesh position={[0.02, 0.025, 0.06]}>
              <sphereGeometry args={[0.02, 8, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
      </group>
      <Pipi y={0.84} z={0.32} x={0.22} />
      <mesh position={[0, 0.8, 0.365]} rotation={[0.3, 0, 0]} scale={[1, 0.7, 1]}>
        <circleGeometry args={[0.04, 14, 0, Math.PI]} />
        <meshBasicMaterial color="#7a2a2a" side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** Overcooked chef hat: cylinder band + puffy top made of several spheres. */
function TopiChef() {
  const putih = '#fbfaf3';
  const bola: [number, number, number, number][] = [
    [0, 0.3, 0, 0.25],
    [-0.15, 0.25, 0.05, 0.19],
    [0.15, 0.25, 0.05, 0.19],
    [0, 0.25, -0.15, 0.19],
    [0, 0.26, 0.15, 0.18],
    [0, 0.42, 0, 0.2],
  ];
  return (
    <group>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.25, 0.27, 0.16, 24]} />
        <meshStandardMaterial color={putih} roughness={0.85} />
        <mesh material={BAHAN_TINTA}>
          <cylinderGeometry args={[0.25 + GARIS, 0.27 + GARIS, 0.16, 24]} />
        </mesh>
      </mesh>
      {bola.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 18, 14]} />
          <meshStandardMaterial color={putih} roughness={0.85} />
          <mesh material={BAHAN_TINTA}>
            <sphereGeometry args={[r + GARIS, 18, 14]} />
          </mesh>
        </mesh>
      ))}
    </group>
  );
}

const PROFIL_LONCENG = [
  [0.0, 0.04],
  [0.2, 0.05],
  [0.3, 0.12],
  [0.335, 0.26],
  [0.32, 0.42],
  [0.27, 0.58],
  [0.2, 0.7],
  [0.0, 0.74],
] as const;

/** Overcooked-style chef: bell body in a white jacket, shop-color neckerchief, big round head, puffy chef hat. */
function RupaChef({ warna, kulit = '#f1c9a5', mata, varian = 'kumis' }: PropsRupa & { varian?: 'kumis' | 'polos' | 'kucing' }) {
  const [geo, geoGaris] = useMemo(() => {
    const titik = (tambah: number) => PROFIL_LONCENG.map(([r, y]) => new THREE.Vector2(r > 0 ? r + tambah : 0, y));
    return [new THREE.LatheGeometry(titik(0), 32), new THREE.LatheGeometry(titik(GARIS), 32)];
  }, []);
  const kucing = varian === 'kucing';
  const kepala = kucing ? '#f4a259' : kulit;
  return (
    <>
      {/* bell body: white chef jacket */}
      <mesh geometry={geo}>
        <meshStandardMaterial color="#f4f1ea" roughness={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geoGaris} material={BAHAN_TINTA} />
      {/* shop-color bottom trim */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.305, 0.215, 0.07, 32, 1, true]} />
        <meshStandardMaterial color={warna} side={THREE.DoubleSide} />
      </mesh>
      {/* double-breasted buttons */}
      {[-0.09, 0.09].flatMap((x) =>
        [0.24, 0.38, 0.52].map((y) => (
          <mesh key={`${x}${y}`} position={[x, y, Math.sqrt(Math.max(0, 0.33 ** 2 - x * x)) - (y > 0.45 ? 0.04 : 0.005)]}>
            <sphereGeometry args={[0.026, 8, 6]} />
            <meshStandardMaterial color="#3d3935" />
          </mesh>
        )),
      )}
      {/* neckerchief */}
      <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.055, 10, 24]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      <mesh position={[0.06, 0.62, 0.2]} rotation={[0.3, 0, -0.5]}>
        <boxGeometry args={[0.12, 0.13, 0.04]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      <mesh position={[-0.06, 0.61, 0.2]} rotation={[0.3, 0, 0.5]}>
        <boxGeometry args={[0.1, 0.12, 0.04]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.3, 28, 20]} />
        <meshStandardMaterial color={kepala} roughness={0.8} />
        <mesh material={BAHAN_TINTA}>
          <sphereGeometry args={[0.3 + GARIS, 28, 20]} />
        </mesh>
      </mesh>
      <MataTitik mata={mata} y={1.02} z={0.265} jarak={0.1} besar={0.04} />
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 1.1, 0.262]} rotation={[0.35, 0, x > 0 ? -0.15 : 0.15]}>
          <boxGeometry args={[0.085, 0.024, 0.02]} />
          <meshBasicMaterial color={TINTA} />
        </mesh>
      ))}
      {kucing ? (
        <>
          <mesh position={[0, 0.93, 0.255]} scale={[1.3, 0.8, 0.7]}>
            <sphereGeometry args={[0.08, 14, 10]} />
            <meshStandardMaterial color="#fbefe0" />
          </mesh>
          <mesh position={[0, 0.96, 0.31]}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshBasicMaterial color="#e86a7a" />
          </mesh>
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} position={[x, 1.2, 0.05]} rotation={[0, 0, x > 0 ? -0.35 : 0.35]}>
              <coneGeometry args={[0.08, 0.16, 4]} />
              <meshStandardMaterial color={kepala} flatShading />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <mesh position={[0, 0.95, 0.3]}>
            <sphereGeometry args={[0.065, 14, 10]} />
            <meshStandardMaterial color={kulit} roughness={0.7} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.065 + GARIS * 0.6, 14, 10]} />
            </mesh>
          </mesh>
          {varian === 'kumis' &&
            [-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.07, 0.88, 0.27]} rotation={[0.2, 0, s * 0.35]} scale={[1.6, 0.55, 0.7]}>
                <sphereGeometry args={[0.06, 12, 8]} />
                <meshStandardMaterial color="#5a3a2a" />
              </mesh>
            ))}
          <Pipi y={0.93} z={0.24} x={0.17} />
        </>
      )}
      <group position={[0, kucing ? 1.16 : 1.18, -0.01]} rotation={[-0.08, 0, 0]}>
        <TopiChef />
      </group>
    </>
  );
}

/** Newspaper texture (headline + text columns) for the printer's paper hat. */
let teksturKoran: THREE.CanvasTexture | null = null;
function koran() {
  if (teksturKoran) return teksturKoran;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2eee2';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#2d2440';
  g.font = '900 38px "Lilita One", system-ui';
  g.fillText('PRINTPITT', 14, 48);
  g.fillRect(14, 60, 228, 4);
  g.fillStyle = '#8f8a80';
  for (let kol = 0; kol < 3; kol++)
    for (let b = 0; b < 12; b++) g.fillRect(14 + kol * 78, 76 + b * 14, 64 - ((b * 7 + kol * 3) % 4) * 9, 6);
  g.fillStyle = '#b9b2a4';
  g.fillRect(170, 76, 72, 56);
  teksturKoran = new THREE.CanvasTexture(c);
  teksturKoran.colorSpace = THREE.SRGBColorSpace;
  return teksturKoran;
}

/** Boxy paper hat like print workers wear (pressman's hat): newspaper box + ridge fold on top. */
function TopiPressman({ warna }: { warna: string }) {
  const tex = koran();
  const lipat = useMemo(() => {
    const bentuk = new THREE.Shape();
    bentuk.moveTo(-0.27, 0);
    bentuk.lineTo(0.27, 0);
    bentuk.lineTo(0.17, 0.12);
    bentuk.lineTo(-0.17, 0.12);
    bentuk.closePath();
    const g = new THREE.ExtrudeGeometry(bentuk, { depth: 0.5, bevelEnabled: false });
    g.translate(0, 0, -0.25);
    return g;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.58, 0.2, 0.52]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
        <mesh material={BAHAN_TINTA}>
          <boxGeometry args={[0.58 + GARIS * 2, 0.2 + GARIS * 2, 0.52 + GARIS * 2]} />
        </mesh>
      </mesh>
      <mesh geometry={lipat} position={[0, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* shop-color front fold band */}
      <mesh position={[0, 0.035, 0.265]}>
        <boxGeometry args={[0.6, 0.07, 0.02]} />
        <meshStandardMaterial color={warna} />
      </mesh>
    </group>
  );
}

/** Yellow pencil (tucked behind the ear). */
function Pensil() {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.022, 0.022, 0.26, 6]} />
        <meshStandardMaterial color="#f4b829" />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <coneGeometry args={[0.022, 0.05, 6]} />
        <meshStandardMaterial color="#e9c99a" />
      </mesh>
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[0.023, 0.023, 0.03, 6]} />
        <meshStandardMaterial color="#f08fb0" />
      </mesh>
    </group>
  );
}

/** Overcooked-style printer: bell body in a shop-color shirt, ink-stained apron + pen pocket,
 *  big round head, pencil behind the ear, newspaper hat. Variant 'visor': hair + classic green printer's eyeshade. */
function RupaTukang({ warna, kulit = '#f1c9a5', rambut = '#3d2a1e', mata, varian = 'koran' }: PropsRupa & { varian?: 'koran' | 'visor' }) {
  const [geo, geoGaris, geoCelemek] = useMemo(() => {
    const titik = (tambah: number) => PROFIL_LONCENG.map(([r, y]) => new THREE.Vector2(r > 0 ? r + tambah : 0, y));
    const celemek = new THREE.LatheGeometry(
      PROFIL_LONCENG.slice(1, 6).map(([r, y]) => new THREE.Vector2(r + 0.012, y)),
      20,
      -Math.PI * 0.32,
      Math.PI * 0.64,
    );
    return [new THREE.LatheGeometry(titik(0), 32), new THREE.LatheGeometry(titik(GARIS), 32), celemek];
  }, []);
  return (
    <>
      {/* bell body: shop-color work shirt */}
      <mesh geometry={geo}>
        <meshStandardMaterial color={warna} roughness={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geoGaris} material={BAHAN_TINTA} />
      {/* curved cream apron + ink stains + pen pocket */}
      <mesh geometry={geoCelemek}>
        <meshStandardMaterial color="#f4ecd8" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.1, 0.22, 0.318]} rotation={[0.05, 0.25, 0]}>
        <circleGeometry args={[0.035, 12]} />
        <meshBasicMaterial color="#2d2440" />
      </mesh>
      <mesh position={[0.15, 0.27, 0.3]} rotation={[0.05, 0.4, 0]}>
        <circleGeometry args={[0.018, 10]} />
        <meshBasicMaterial color="#2d2440" />
      </mesh>
      <mesh position={[-0.08, 0.42, 0.318]} rotation={[0.15, -0.1, 0]}>
        <boxGeometry args={[0.13, 0.1, 0.012]} />
        <meshStandardMaterial color="#e6dcc4" />
      </mesh>
      {[
        [-0.11, '#76a0e2'],
        [-0.075, '#ef6a4c'],
      ].map(([x, c]) => (
        <mesh key={String(c)} position={[x as number, 0.5, 0.315]} rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
      {/* collar */}
      <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.19, 0.04, 8, 24]} />
        <meshStandardMaterial color="#fbfaf3" />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.3, 28, 20]} />
        <meshStandardMaterial color={kulit} roughness={0.8} />
        <mesh material={BAHAN_TINTA}>
          <sphereGeometry args={[0.3 + GARIS, 28, 20]} />
        </mesh>
      </mesh>
      <MataTitik mata={mata} y={1.0} z={0.265} jarak={0.1} besar={0.042} />
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 1.09, 0.265]} rotation={[0.35, 0, x > 0 ? -0.12 : 0.12]}>
          <boxGeometry args={[0.085, 0.024, 0.02]} />
          <meshBasicMaterial color={TINTA} />
        </mesh>
      ))}
      <mesh position={[0, 0.93, 0.3]}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial color={kulit} roughness={0.7} />
        <mesh material={BAHAN_TINTA}>
          <sphereGeometry args={[0.055 + GARIS * 0.6, 12, 10]} />
        </mesh>
      </mesh>
      <mesh position={[0, 0.86, 0.285]} rotation={[0.35, 0, Math.PI]}>
        <torusGeometry args={[0.04, 0.011, 6, 14, Math.PI]} />
        <meshBasicMaterial color={TINTA} />
      </mesh>
      <Pipi y={0.92} z={0.245} x={0.17} />
      {/* ears + pencil */}
      {[-0.29, 0.29].map((x) => (
        <mesh key={x} position={[x, 0.98, 0.0]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color={kulit} />
        </mesh>
      ))}
      <group position={[0.3, 1.06, -0.02]} rotation={[0, 0.25, 0.25]}>
        <Pensil />
      </group>
      {varian === 'koran' ? (
        <group position={[0, 1.13, -0.02]} rotation={[-0.06, 0, 0]}>
          <TopiPressman warna={warna} />
        </group>
      ) : (
        <>
          <mesh position={[0, 1.04, -0.03]}>
            <sphereGeometry args={[0.315, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.15]} />
            <meshStandardMaterial color={rambut} roughness={0.9} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.315 + GARIS, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.15]} />
            </mesh>
          </mesh>
          <mesh position={[0, 1.15, 0.0]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <torusGeometry args={[0.305, 0.03, 8, 30]} />
            <meshStandardMaterial color="#2a2163" />
          </mesh>
          <mesh position={[0, 1.15, 0.29]} rotation={[0.55, 0, 0]}>
            <boxGeometry args={[0.46, 0.02, 0.16]} />
            <meshStandardMaterial color="#4fb37e" transparent opacity={0.85} roughness={0.3} />
          </mesh>
        </>
      )}
    </>
  );
}

export type TipePembeli = 'mahasiswa' | 'hijab' | 'kantoran' | 'ojol' | 'anak' | 'nenek';
export const TIPE_PEMBELI: TipePembeli[] = ['mahasiswa', 'hijab', 'kantoran', 'ojol', 'anak', 'nenek'];

/** Simple bell body with shirt color + ink outline. */
function BadanLonceng({ warna, bawah }: { warna: string; bawah?: string }) {
  const [geo, geoGaris] = useMemo(() => {
    const titik = (tambah: number) => PROFIL_LONCENG.map(([r, y]) => new THREE.Vector2(r > 0 ? r + tambah : 0, y));
    return [new THREE.LatheGeometry(titik(0), 28), new THREE.LatheGeometry(titik(GARIS), 28)];
  }, []);
  return (
    <>
      <mesh geometry={geo}>
        <meshStandardMaterial color={warna} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geoGaris} material={BAHAN_TINTA} />
      {bawah && (
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.322, 0.235, 0.18, 28, 1, true]} />
          <meshStandardMaterial color={bawah} side={THREE.DoubleSide} />
        </mesh>
      )}
    </>
  );
}

function Kepala({ kulit, mata, kacamata }: { kulit: string; mata: RefObject<THREE.Group | null>; kacamata?: boolean }) {
  return (
    <>
      <mesh position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.3, 26, 18]} />
        <meshStandardMaterial color={kulit} roughness={0.8} />
        <mesh material={BAHAN_TINTA}>
          <sphereGeometry args={[0.3 + GARIS, 26, 18]} />
        </mesh>
      </mesh>
      <MataTitik mata={mata} y={1.0} z={0.265} jarak={0.1} besar={0.04} />
      <Pipi y={0.92} z={0.245} x={0.17} />
      <mesh position={[0, 0.88, 0.285]} rotation={[0.35, 0, Math.PI]}>
        <torusGeometry args={[0.035, 0.01, 6, 12, Math.PI]} />
        <meshBasicMaterial color={TINTA} />
      </mesh>
      {kacamata &&
        [-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 1.0, 0.29]}>
            <torusGeometry args={[0.065, 0.012, 6, 18]} />
            <meshBasicMaterial color={TINTA} />
          </mesh>
        ))}
    </>
  );
}

/** Typical Indonesian copy-shop customer, same proportions as the worker (bell body + round head). */
function RupaPembeli({ warna, kulit = '#f1c9a5', rambut = '#3d2a1e', mata, tipe }: PropsRupa & { tipe: TipePembeli }) {
  switch (tipe) {
    case 'mahasiswa':
      return (
        <>
          <BadanLonceng warna={warna} />
          {/* hoodie hood + backpack */}
          <mesh position={[0, 0.72, -0.12]} rotation={[Math.PI / 2 + 0.4, 0, 0]}>
            <torusGeometry args={[0.17, 0.07, 8, 18]} />
            <meshStandardMaterial color={warna} />
          </mesh>
          <mesh position={[0, 0.45, -0.33]}>
            <boxGeometry args={[0.4, 0.42, 0.18]} />
            <meshStandardMaterial color="#2a2163" />
            <mesh material={BAHAN_TINTA}>
              <boxGeometry args={[0.4 + GARIS * 2, 0.42 + GARIS * 2, 0.18 + GARIS * 2]} />
            </mesh>
          </mesh>
          <mesh position={[0, 0.36, -0.43]}>
            <boxGeometry args={[0.28, 0.14, 0.04]} />
            <meshStandardMaterial color="#f4b829" />
          </mesh>
          <Kepala kulit={kulit} mata={mata} />
          <mesh position={[0, 1.03, -0.02]}>
            <sphereGeometry args={[0.315, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
            <meshStandardMaterial color={rambut} roughness={0.9} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.315 + GARIS, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
            </mesh>
          </mesh>
          {[[-0.12, 1.28, 0.05], [0.06, 1.31, -0.04], [0.14, 1.26, 0.08]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color={rambut} roughness={0.9} />
            </mesh>
          ))}
        </>
      );
    case 'hijab':
      return (
        <>
          <BadanLonceng warna={warna} />
          <Kepala kulit={kulit} mata={mata} />
          {/* hijab: covers the head except the face opening, drapes to the shoulders */}
          <mesh position={[0, 0.99, -0.01]}>
            <sphereGeometry args={[0.335, 26, 18, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.82]} />
            <meshStandardMaterial color={rambut} roughness={0.85} side={THREE.DoubleSide} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.335 + GARIS, 26, 18, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.82]} />
            </mesh>
          </mesh>
          <mesh position={[0, 0.69, 0]}>
            <cylinderGeometry args={[0.26, 0.36, 0.26, 26, 1, true]} />
            <meshStandardMaterial color={rambut} roughness={0.85} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.27, 0.12]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#f4b829" />
          </mesh>
        </>
      );
    case 'kantoran':
      return (
        <>
          <BadanLonceng warna="#f3f1ea" bawah="#3d3f55" />
          <mesh position={[0, 0.5, 0.31]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.07, 0.28, 0.02]} />
            <meshStandardMaterial color={warna} />
          </mesh>
          <mesh position={[0, 0.66, 0.27]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.09, 0.06, 0.03]} />
            <meshStandardMaterial color={warna} />
          </mesh>
          <Kepala kulit={kulit} mata={mata} kacamata />
          <mesh position={[0, 1.02, -0.04]}>
            <sphereGeometry args={[0.31, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            <meshStandardMaterial color={rambut} roughness={0.7} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.31 + GARIS, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            </mesh>
          </mesh>
          {/* document folder under the arm */}
          <mesh position={[0.32, 0.5, -0.05]} rotation={[0, 0, 0.1]}>
            <boxGeometry args={[0.05, 0.34, 0.26]} />
            <meshStandardMaterial color="#76a0e2" />
          </mesh>
        </>
      );
    case 'ojol':
      return (
        <>
          <BadanLonceng warna="#3fae5a" bawah="#2d2440" />
          <mesh position={[0, 0.5, -0.32]} rotation={[-0.15, 0, 0]}>
            <boxGeometry args={[0.36, 0.16, 0.02]} />
            <meshStandardMaterial color="#fbfaf3" />
          </mesh>
          <Kepala kulit={kulit} mata={mata} />
          {/* helmet */}
          <mesh position={[0, 1.02, -0.02]}>
            <sphereGeometry args={[0.345, 26, 14, 0, Math.PI * 2, 0, Math.PI / 1.85]} />
            <meshStandardMaterial color="#3fae5a" roughness={0.3} metalness={0.1} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.345 + GARIS, 26, 14, 0, Math.PI * 2, 0, Math.PI / 1.85]} />
            </mesh>
          </mesh>
          <mesh position={[0, 1.12, 0.29]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.38, 0.14, 0.03]} />
            <meshStandardMaterial color="#2d2440" transparent opacity={0.6} roughness={0.1} />
          </mesh>
          <mesh position={[0, 1.37, -0.02]}>
            <boxGeometry args={[0.06, 0.03, 0.5]} />
            <meshStandardMaterial color="#fbfaf3" />
          </mesh>
        </>
      );
    case 'anak':
      return (
        <>
          <BadanLonceng warna="#fbfaf3" bawah={warna} />
          <mesh position={[0, 0.66, 0.24]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.1, 0.08, 0.03]} />
            <meshStandardMaterial color="#ef6a4c" />
          </mesh>
          <Kepala kulit={kulit} mata={mata} />
          <mesh position={[0, 1.0, -0.03]}>
            <sphereGeometry args={[0.33, 24, 14, 0, Math.PI * 2, 0, Math.PI / 1.75]} />
            <meshStandardMaterial color={rambut} roughness={0.9} side={THREE.DoubleSide} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.33 + GARIS, 24, 14, 0, Math.PI * 2, 0, Math.PI / 1.75]} />
            </mesh>
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.3, 1.05, -0.12]}>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshStandardMaterial color={rambut} />
            </mesh>
          ))}
          <mesh position={[0.18, 1.2, 0.17]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.1, 0.04, 0.04]} />
            <meshStandardMaterial color={warna} />
          </mesh>
        </>
      );
    case 'nenek':
      return (
        <>
          <BadanLonceng warna={warna} />
          <mesh position={[0, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.05, 8, 22]} />
            <meshStandardMaterial color="#fbfaf3" />
          </mesh>
          <Kepala kulit={kulit} mata={mata} kacamata />
          <mesh position={[0, 1.02, -0.03]}>
            <sphereGeometry args={[0.315, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
            <meshStandardMaterial color="#e4e1dc" roughness={0.9} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.315 + GARIS, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
            </mesh>
          </mesh>
          <mesh position={[0, 1.2, -0.26]}>
            <sphereGeometry args={[0.13, 14, 10]} />
            <meshStandardMaterial color="#e4e1dc" roughness={0.9} />
            <mesh material={BAHAN_TINTA}>
              <sphereGeometry args={[0.13 + GARIS, 14, 10]} />
            </mesh>
          </mesh>
        </>
      );
  }
}
