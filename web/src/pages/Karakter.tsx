// /karakter — lineup pilihan rupa karakter (untuk dipilih tim), dilihat dari sudut kamera game.
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { Canvas } from '@react-three/fiber';
import { Item3D } from '../game3d/Item3D';
import { UNGU } from '../arena3d/Mesin3D';
import { Pekerja3D, TIPE_PEMBELI, type ModelKarakter } from '../arena3d/Pekerja3D';

const MODEL: { id: ModelKarakter; nama: string }[] = [
  { id: 'tukang', nama: 'A · Tukang cetak (topi koran)' },
  { id: 'tukang-visor', nama: 'B · Tukang cetak (visor hijau)' },
];
const X = [-1.5, 1.5];

export default function Karakter() {
  return (
    <main style={{ position: 'fixed', inset: 0, background: '#8cc07a' }}>
      <Canvas shadows flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 9.6, 10.2], near: 0.3, far: 60 }} onCreated={({ camera }) => camera.lookAt(0, 0.3, 1.4)}>
        <color attach="background" args={['#f1e8d4']} />
        <hemisphereLight args={['#fff4dc', '#6a5a9a', 1.2]} />
        <directionalLight position={[4, 10, 6]} intensity={2.2} color="#fff1d6" castShadow shadow-mapSize={[2048, 2048]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 20]} />
          <meshStandardMaterial color="#efe3c8" />
        </mesh>
        {TIPE_PEMBELI.map((t, i) => (
          <Pekerja3D
            key={t}
            model="pembeli"
            tipe={t}
            warna={['#76a0e2', '#ef6a4c', '#93d3b0', '#f4b829', '#c58be0', '#f08fb0'][i]}
            rambut={t === 'hijab' ? '#f08fb0' : '#3d2a1e'}
            kulit={['#f1c9a5', '#d9a27c', '#e8b48f', '#b98262', '#f1c9a5', '#e8b48f'][i]}
            posisi={[-3.75 + i * 1.5, 0, 3.4]}
            skala={1.08}
            cincin={false}
            fase={i}
          />
        ))}
        {MODEL.map((m, i) => (
          <group key={m.id}>
            <Pekerja3D model={m.id} warna={UNGU.m} posisi={[X[i], 0, -0.5]} skala={1.22} penanda gaya="diam" fase={i} />
            <Pekerja3D
              model={m.id}
              warna="#ef6a4c"
              posisi={[X[i], 0, 1.7]}
              putar={0.5}
              skala={1.22}
              penanda
              gaya="jalan"
              fase={i * 1.3}
              pegang={<Item3D item={{ jenis: 3, wujud: 'laminasi' }} />}
            />
          </group>
        ))}
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 18, display: 'flex', justifyContent: 'space-around', padding: '0 6vw', pointerEvents: 'none' }}>
        {MODEL.map((m) => (
          <div
            key={m.id}
            style={{ font: '1.5rem "Lilita One", system-ui', color: '#231e16', background: '#fbfaf3', border: '3px solid #231e16', borderRadius: 14, boxShadow: '0 4px 0 #231e16', padding: '4px 14px 6px' }}
          >
            {m.nama}
          </div>
        ))}
      </div>
    </main>
  );
}
