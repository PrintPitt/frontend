// Small 3D scenes for the landing page (shop window) and lobby (character select stage).
import { Float } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type * as THREE from 'three';
import { Fotokopi3D, Laminator3D, Printer3D, UNGU } from './Mesin3D';
import { Model, MODEL } from './Model';
import { Pekerja3D } from './Pekerja3D';

export function Cahaya() {
  return (
    <>
      <hemisphereLight args={['#fff6e5', '#5a4a8a', 1.2]} />
      <directionalLight position={[4, 9, 7]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.5, 30]} />
      </directionalLight>
    </>
  );
}

function KertasTerbang({ posisi, putar = 0, cepat = 1 }: { posisi: [number, number, number]; putar?: number; cepat?: number }) {
  return (
    <Float speed={2 * cepat} rotationIntensity={1.4} floatIntensity={1.6} position={posisi}>
      <mesh rotation={[0.4, putar, 0.2]} castShadow>
        <boxGeometry args={[0.42, 0.006, 0.3]} />
        <meshStandardMaterial color="#fbfaf3" />
      </mesh>
    </Float>
  );
}

function Lompat({ children, tunda = 0, tinggi = 0.35 }: { children: ReactNode; tunda?: number; tinggi?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 3 + tunda)) * tinggi;
  });
  return <group ref={g}>{children}</group>;
}

/** Shop window: counter + machines + two jumping copy-shop workers + floating paper. */
export function AdeganLanding() {
  const tMeja = 0.78;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#3a2f78" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.6]} receiveShadow>
        <circleGeometry args={[5.2, 48]} />
        <meshStandardMaterial color="#efe6d2" />
      </mesh>
      {[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((x, i) => (
        <Model key={x} url={MODEL(i % 2 ? 'Counter_Drawers' : 'Counter_Doors')} lebar={1} tinggi={tMeja} posisi={[x, 0, -1.2]} />
      ))}
      <Fotokopi3D posisi={[-3.8, 0, -1.1]} skala={1.55} putar={0.35} />
      <Printer3D posisi={[-1, tMeja, -1.2]} skala={3} putar={0.1} />
      <Laminator3D posisi={[1.6, tMeja, -1.2]} skala={3.3} putar={-0.1} />
      <Lompat>
        <Pekerja3D model="tukang" skala={1.15} warna={UNGU.m} posisi={[-1.4, 0, 1.1]} putar={0.3} gaya="jalan" bawa="ktp" />
      </Lompat>
      <Lompat tunda={1.3}>
        <Pekerja3D model="tukang-visor" skala={1.15} warna="#ef6a4c" posisi={[1.5, 0, 1.2]} putar={-0.35} gaya="jalan" bawa="ijazah" fase={1} />
      </Lompat>
      <KertasTerbang posisi={[-2.6, 2.4, 0.4]} />
      <KertasTerbang posisi={[2.9, 2.8, 0]} putar={1} cepat={1.3} />
      <KertasTerbang posisi={[0.2, 3.1, -0.4]} putar={2} cepat={0.8} />
      <KertasTerbang posisi={[-0.9, 1.9, 1.8]} putar={0.5} cepat={1.6} />
      <KertasTerbang posisi={[3.6, 1.6, 1.4]} putar={2.5} />
    </group>
  );
}

/** Lobby stage: two colored podiums + copy-shop workers. */
export function PanggungLobi({ warna }: { warna: string[] }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#2e2470" />
      </mesh>
      {warna.map((w, i) => {
        const x = (i - (warna.length - 1) / 2) * 2.6;
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.95, 1.05, 0.3, 40]} />
              <meshStandardMaterial color={w} />
            </mesh>
            <mesh position={[0, 0.31, 0]} receiveShadow>
              <cylinderGeometry args={[0.8, 0.8, 0.02, 40]} />
              <meshStandardMaterial color="#fbfaf3" />
            </mesh>
            <Pekerja3D warna={w} posisi={[0, 0.32, 0]} gaya="diam" cincin={false} fase={i * 2} />
          </group>
        );
      })}
    </group>
  );
}
