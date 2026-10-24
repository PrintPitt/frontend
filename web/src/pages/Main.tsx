// /main — halaman tanding 3D (desain): toko fotokopi ala Overcooked, kamera miring dari atas, HUD di atas kanvas.
// Data masih DEMO; nanti diganti useLive() + kontrol karakter.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence } from 'motion/react';
import { Suspense } from 'react';
import '../arena/arena.css';
import { Jam, KoinMon } from '../arena/Ikon';
import Tiket, { type DataTiket } from '../arena/Tiket';
import '../arena3d/arena3d.css';
import { UNGU } from '../arena3d/Mesin3D';
import { Toko3D } from '../arena3d/Toko3D';

const DEMO_TIKET: DataTiket[] = [
  { id: '31', jenis: 'ijazah', langkah: [1, 3], sisa: 0.82, harga: '0,02', diambil: { huruf: 'A', warna: 'ungu' } },
  { id: '32', jenis: 'ktp', langkah: [1], sisa: 0.64, harga: '0,01', diambil: { huruf: 'B', warna: 'tomato' } },
  { id: '33', jenis: 'menu', langkah: [2, 3], sisa: 0.41, harga: '0,02' },
  { id: '34', jenis: 'boarding', langkah: [2], sisa: 0.9, harga: '0,01' },
  { id: '35', jenis: 'ktp', langkah: [1], sisa: 0.18, harga: '0,01' },
];

export default function Main() {
  return (
    <main className="halaman-game main-3d">
      <Canvas
        shadows
        flat
        dpr={[1, 2]}
        camera={{ fov: 32, position: [0, 16.5, 13.2], near: 0.5, far: 80 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0.35)}
      >
        <color attach="background" args={['#241a52']} />
        <fog attach="fog" args={['#241a52', 24, 46]} />
        <hemisphereLight args={['#fff6e5', '#5a4a8a', 1.15]} />
        <directionalLight
          position={[6, 14, 8]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0004}
        />
        <Suspense fallback={null}>
          <Toko3D
            nama="TOKO A"
            progres={{ kode: 2, nilai: 0.62 }}
            pemain={[
              { posisi: [-0.6, 0, -2.25], putar: Math.PI, warna: UNGU.m, gaya: 'kerja' },
              { posisi: [-3.2, 0, 1.2], putar: -0.9, warna: '#f4b829', gaya: 'jalan', bawa: 'ktp' },
            ]}
            pelanggan={[
              { x: -1.5, warna: '#76a0e2', bawa: 'ktp', rambut: '#231e16' },
              { x: -0.3, warna: '#ef6a4c', bawa: 'ijazah', rambut: '#7a4a2a', kulit: '#d9a27c' },
              { x: 3.9, warna: '#93d3b0', rambut: '#f4d23a' },
            ]}
          />
        </Suspense>
      </Canvas>

      <div className="rel-tiket">
        <AnimatePresence>
          {DEMO_TIKET.map((t) => (
            <Tiket key={t.id} t={t} />
          ))}
        </AnimatePresence>
      </div>
      <div className="lawan-hud">
        <span>VS</span> TOKO B <b>0,0189</b>
      </div>
      <div className="koin-3d">
        <KoinMon ukuran={64} />
        <div>
          <div className="skor-angka">0,0274</div>
          <div className="skor-label">TOKO A · kilat x2</div>
        </div>
      </div>
      <div className="timer-3d">
        <div>
          <div className="timer-angka">02:14</div>
          <div className="bar-timer">
            <div style={{ width: '62%' }} />
          </div>
        </div>
        <Jam ukuran={46} />
      </div>
    </main>
  );
}
