// /lobi — lobi (desain): dua slot pemain ala pilih-chef Overcooked + peta lokasi + tombol mulai sesi.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { motion } from 'motion/react';
import { useState } from 'react';
import '../arena/arena.css';
import { IkonOrder } from '../arena/Ikon';
import { PALET, type NamaPalet } from '../arena/kamera';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Cahaya, PanggungLobi } from '../arena3d/Adegan';
import '../arena3d/arena3d.css';

const WARNA: NamaPalet[] = ['ungu', 'tomato', 'mustard', 'mint', 'cobalt', 'blush'];

type Slot = { nama: string; warna: NamaPalet; siap: boolean; alamat: string; akun: string; tombol: string };

const LOKASI = [
  { kode: '1-1', nama: 'Depan Kampus', bintang: 2, x: 120, y: 230, buka: true },
  { kode: '1-2', nama: 'Malioboro', bintang: 0, x: 300, y: 150, buka: true },
  { kode: '1-3', nama: 'Selokan Mataram', bintang: 0, x: 470, y: 250, buka: false },
];

function Bintang({ n }: { n: number }) {
  return (
    <span className="bintang">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'isi' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

function KartuSlot({ s, onWarna, onSiap }: { s: Slot; onWarna: (w: NamaPalet) => void; onSiap: () => void }) {
  return (
    <motion.div className={`slot ${s.siap ? 'siap' : ''}`} layout style={{ ['--warna' as string]: PALET[s.warna].m }}>
      <div className="slot-kepala">
        <span className="slot-nama">{s.nama}</span>
        <span className="slot-akun">{s.akun}</span>
      </div>
      <div className="ruang-karakter" />
      <div className="slot-alamat">{s.alamat}</div>
      <div className="pilih-warna">
        {WARNA.map((w) => (
          <button key={w} className={w === s.warna ? 'aktif' : ''} style={{ background: PALET[w].m }} onClick={() => onWarna(w)} aria-label={w} />
        ))}
      </div>
      <button className={`tombol-game ${s.siap ? 'hijau' : 'putih'}`} onClick={onSiap}>
        {s.siap ? 'SIAP!' : 'BELUM SIAP'}
      </button>
      <div className="slot-tombol">{s.tombol}</div>
    </motion.div>
  );
}

export default function Lobi() {
  const [slot, setSlot] = useState<Slot[]>([
    { nama: 'TOKO A', warna: 'ungu', siap: true, alamat: '0x7099…79C8', akun: 'Passkey', tombol: 'P1 · WASD + SPASI' },
    { nama: 'TOKO B', warna: 'tomato', siap: false, alamat: '0x3C44…93BC', akun: 'Passkey', tombol: 'P2 · PANAH + ENTER' },
  ]);
  const [pilih, setPilih] = useState('1-1');
  const ubah = (i: number, f: (s: Slot) => Slot) => setSlot((xs) => xs.map((s, j) => (j === i ? f(s) : s)));
  const lokasi = LOKASI.find((l) => l.kode === pilih)!;

  return (
    <main className="halaman-game lobi">
      <header className="kepala-lobi">
        <a className="tombol-game putih kecil" href="/">
          ‹ KEMBALI
        </a>
        <h1 className="judul-game">LOBI</h1>
        <div className="pil-live">
          <span className="titik" /> MONAD TESTNET · SESI #3
        </div>
      </header>

      <div className="isi-lobi">
        <section className="panggung-lobi">
          <Canvas shadows flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 2.2, 7.4] }} onCreated={({ camera }) => camera.lookAt(0, 1.0, 0)}>
            <color attach="background" args={['#2c2170']} />
            <Cahaya />
            <Suspense fallback={null}>
              <PanggungLobi warna={slot.map((s) => PALET[s.warna].m)} />
            </Suspense>
          </Canvas>
          <div className="slot-grid">
          {slot.map((s, i) => (
            <KartuSlot key={i} s={s} onWarna={(w) => ubah(i, (x) => ({ ...x, warna: w }))} onSiap={() => ubah(i, (x) => ({ ...x, siap: !x.siap }))} />
          ))}
          </div>
        </section>

        <aside className="peta-lobi">
          <h2 className="judul-kecil">PILIH LOKASI</h2>
          <svg className="peta" viewBox="0 0 600 340">
            <rect width={600} height={340} rx={22} fill="#93d3b0" stroke="#231e16" strokeWidth={4} />
            <path d="M0 300 C120 260 160 330 260 300 S420 220 600 260 V340 H0 Z" fill="#76a0e2" stroke="#231e16" strokeWidth={3} />
            <path d="M120 230 C180 180 240 160 300 150 S420 200 470 250" fill="none" stroke="#f2efe7" strokeWidth={16} strokeLinecap="round" />
            <path d="M120 230 C180 180 240 160 300 150 S420 200 470 250" fill="none" stroke="#231e16" strokeWidth={3} strokeDasharray="10 10" />
            {[
              [60, 90],
              [200, 70],
              [520, 100],
              [400, 60],
              [80, 170],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={22} fill="#71b693" stroke="#231e16" strokeWidth={3} />
                <rect x={x - 4} y={y + 18} width={8} height={12} fill="#7a5a3a" stroke="#231e16" strokeWidth={2} />
              </g>
            ))}
            {LOKASI.map((l) => (
              <g key={l.kode} onClick={() => l.buka && setPilih(l.kode)} style={{ cursor: l.buka ? 'pointer' : 'not-allowed' }}>
                <circle cx={l.x} cy={l.y} r={pilih === l.kode ? 30 : 24} fill={l.buka ? (pilih === l.kode ? '#f4b829' : '#f2efe7') : '#8f989b'} stroke="#231e16" strokeWidth={4} />
                <text x={l.x} y={l.y + 7} textAnchor="middle" className="teks-peta">
                  {l.buka ? l.kode : '🔒'}
                </text>
                <text x={l.x} y={l.y - 38} textAnchor="middle" className="label-peta">
                  {l.nama}
                </text>
              </g>
            ))}
          </svg>
          <div className="detail-lokasi">
            <div>
              <b>
                {lokasi.kode} · {lokasi.nama}
              </b>
              <Bintang n={lokasi.bintang} />
            </div>
            <div className="baris-info">
              <span>⏱ 3:00</span>
              <span>👥 2 toko</span>
              <span>📄 4 jenis order</span>
            </div>
            <div className="ikon-order-baris">
              {(['ktp', 'boarding', 'ijazah', 'menu'] as const).map((j) => (
                <IkonOrder key={j} jenis={j} ukuran={38} />
              ))}
            </div>
            <div className="target-bintang">
              ★ 0,01 MON · ★★ 0,03 MON · ★★★ 0,05 MON
            </div>
          </div>
        </aside>
      </div>

      <footer className="kaki-lobi">
        <span className="muted-game">Setelah sesi dibuka, penonton scan QR di layar proyektor untuk memesan.</span>
        <a className={`tombol-game kuning besar ${slot.every((s) => s.siap) ? '' : 'redup'}`} href="/main">
          MULAI SESI ▸
        </a>
      </footer>
    </main>
  );
}
