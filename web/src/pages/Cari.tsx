// /cari — matchmaking: YOU vs RIVAL cards (another shop registered on the contract), wait for the session to open, countdown 3-2-1,
// then go to /main. The rival is read live from the on-chain shop list; the rival's look (model/color) isn't stored on-chain,
// so a contrasting look (visor, orange) is used with their shop name.
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { Canvas, useFrame } from '@react-three/fiber';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import '../arena/arena.css';
import { Cahaya } from '../arena3d/Adegan';
import '../arena3d/arena3d.css';
import { UNGU } from '../arena3d/Mesin3D';
import { Pekerja3D, type ModelKarakter } from '../arena3d/Pekerja3D';
import { akunAktif } from '../lib/akun';
import { useLive } from '../lib/live';
import { pindah } from '../lib/navigasi';
import { bacaProfil, namaTampil } from '../lib/profil';

const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const MERAH = '#ef6a4c';

function Petarung({ model, warna, kulit, rambut, hadap, kuda }: { model: ModelKarakter; warna: string; kulit?: string; rambut?: string; hadap: number; kuda: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.position.y = kuda ? Math.abs(Math.sin(t * 7)) * 0.12 : 0;
    g.current.rotation.y = hadap + Math.sin(t * 1.3) * 0.12;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#2e2470" />
      </mesh>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[1.1, 1.2, 0.24, 40]} />
        <meshStandardMaterial color={warna} />
      </mesh>
      <group ref={g} position={[0, 0.24, 0]}>
        <Pekerja3D model={model} warna={warna} kulit={kulit} rambut={rambut} posisi={[0, 0, 0]} skala={1.5} cincin={false} gaya={kuda ? 'kerja' : 'diam'} />
      </group>
    </group>
  );
}

function KartuPetarung({ nama, toko, warna, model, kulit, rambut, hadap, kuda }: { nama: string; toko: string; warna: string; model: ModelKarakter; kulit?: string; rambut?: string; hadap: number; kuda: boolean }) {
  return (
    <motion.div className="kartu-petarung" style={{ ['--warna' as string]: warna }} initial={{ x: hadap > 0 ? -60 : 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
      <Canvas shadows flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 2.6, 6.4] }} onCreated={({ camera }) => camera.lookAt(0, 1.2, 0)}>
        <color attach="background" args={['#2c2170']} />
        <Cahaya />
        <Suspense fallback={null}>
          <Petarung model={model} warna={warna} kulit={kulit} rambut={rambut} hadap={hadap} kuda={kuda} />
        </Suspense>
      </Canvas>
      <div className="nama-petarung">{nama}</div>
      <div className="toko-petarung">{toko}</div>
    </motion.div>
  );
}

export default function Cari() {
  const s = useLive();
  const [profil] = useState(bacaProfil);
  const akun = akunAktif();
  const [hitung, setHitung] = useState<number | null>(null);

  useEffect(() => {
    if (!akun) pindah('/lobi');
  }, [akun]);

  const saya = akun ? s.toko.find((t) => sama(t.alamat, akun.address)) : undefined;
  const lawan = s.toko.find((t) => !akun || !sama(t.alamat, akun.address));
  const siap = s.siap && !!saya && !!lawan && s.sesiAktif;

  // All ready → countdown 3-2-1, then enter the match (once only).
  useEffect(() => {
    if (!siap) return;
    setHitung(3);
    const t = [1, 2, 3].map((i) => setTimeout(() => setHitung(3 - i), i * 1000));
    const akhir = setTimeout(() => pindah('/main'), 3600);
    return () => [...t, akhir].forEach(clearTimeout);
  }, [siap]);

  const status = !s.siap
    ? 'Connecting to Monad…'
    : !saya
      ? "You don't have a shop yet. Register one in the lobby first (free, right on the contract)."
      : !lawan
        ? 'Finding a rival… waiting for another shop to register'
        : !s.sesiAktif
          ? `Rival found: ${lawan.nama}. Waiting for the operator to open the session…`
          : 'All set!';

  return (
    <main className="halaman-game lobi cari">
      <header className="kepala-lobi">
        <button className="tombol-game putih kecil" onClick={() => pindah('/lobi')}>
          ‹ LOBBY
        </button>
        <h1 className="judul-game">FIND MATCH</h1>
        <div className="pil-live">
          <span className={`titik ${s.sesiAktif ? '' : 'mati'}`} /> {s.sesiAktif ? `SESSION #${s.sesiId} OPEN` : 'SESSION NOT OPEN'}
        </div>
      </header>

      <div className="cari-isi">
        <KartuPetarung
          nama={namaTampil(profil, saya?.nama ?? 'You')}
          toko={saya ? saya.nama.toUpperCase() : 'NOT REGISTERED'}
          warna={profil.warna}
          model={profil.model}
          kulit={profil.kulit}
          rambut={profil.rambut}
          hadap={0.45}
          kuda={siap}
        />
        <motion.div className="vs-besar" animate={{ scale: [1, 1.12, 1], rotate: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          VS
        </motion.div>
        {lawan ? (
          <KartuPetarung
            nama={lawan.nama}
            toko={lawan.nama.toUpperCase()}
            warna={profil.warna === MERAH ? UNGU.m : MERAH}
            model={profil.model === 'tukang' ? 'tukang-visor' : 'tukang'}
            hadap={-0.45}
            kuda={siap}
          />
        ) : (
          <motion.div className="kartu-petarung kosong" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.4 }}>
            <div>
              <div className="tanya">?</div>
              Finding a rival…
            </div>
          </motion.div>
        )}
      </div>

      <footer className="kaki-lobi">
        <span className="status-cari">{status}</span>
        {import.meta.env.DEV && (
          <button className="tombol-game putih kecil" onClick={() => pindah('/main')}>
            SKIP (DEV)
          </button>
        )}
      </footer>

      <AnimatePresence>
        {hitung !== null && (
          <div className="hitung-mundur">
            <motion.span key={hitung} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: 'spring', bounce: 0.5 }}>
              {hitung === 0 ? 'GO!' : hitung}
            </motion.span>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
