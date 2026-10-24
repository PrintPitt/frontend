// / — landing (desain 3D): etalase toko fotokopi 3D ala key art Overcooked, logo besar, tombol MAIN.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { Canvas } from '@react-three/fiber';
import { motion } from 'motion/react';
import { Suspense } from 'react';
import '../arena/arena.css';
import { IkonLangkah, IkonOrder, KoinMon } from '../arena/Ikon';
import { AdeganLanding, Cahaya } from '../arena3d/Adegan';
import '../arena3d/arena3d.css';
import { NAMA } from '../lib/merek';

export default function Landing() {
  // "PrintPitt" → PRINT / PITT (dipecah di spasi atau huruf besar di tengah kata)
  const [kata1, ...sisa] = NAMA.split(/\s+|(?<=[a-z])(?=[A-Z])/).map((k) => k.toUpperCase());
  return (
    <main className="halaman-game landing-3d">
      <section className="hero-3d">
        <Canvas shadows flat dpr={[1, 2]} camera={{ fov: 34, position: [0, 3.6, 8.6] }} onCreated={({ camera }) => camera.lookAt(0, 1.75, 0)}>
          <color attach="background" args={['#2c2170']} />
          <fog attach="fog" args={['#2c2170', 12, 26]} />
          <Cahaya />
          <Suspense fallback={null}>
            <AdeganLanding />
          </Suspense>
        </Canvas>

        <nav className="nav-landing">
          <span className="logo-kecil">{NAMA}</span>
          <div>
            <a href="#cara">Cara main</a>
            <a href="/layar">Layar proyektor</a>
          </div>
        </nav>
        <div className="judul-hero">
          <motion.h1 className="logo-besar" initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
            <span className="baris1">{kata1}</span>
            <span className="baris2">{sisa.join(' ')}</span>
          </motion.h1>
          <div className="pita">REBUTAN ORDER · ON MONAD</div>
        </div>
        <div className="cta cta-3d">
          <a className="tombol-game kuning besar" href="/lobi">
            MAIN SEKARANG
          </a>
          <a className="tombol-game putih" href="/pesan">
            PESAN DARI HP
          </a>
        </div>
      </section>

      <section id="cara" className="fitur">
        <div className="kartu-fitur">
          <div className="ikon-fitur">
            <IkonOrder jenis="ktp" ukuran={52} />
          </div>
          <h3>Rebutan order</h3>
          <p>Penonton memesan dari HP. Dua toko berebut; Monad memutuskan pemenangnya dalam 0,3 detik.</p>
        </div>
        <div className="kartu-fitur">
          <div className="ikon-fitur">
            <IkonLangkah kode={2} ukuran={52} />
          </div>
          <h3>Makin kilat, makin cuan</h3>
          <p>Lari ke mesin: fotokopi, print, laminating. Bayaran turun tiap detik, sisanya kembali ke pelanggan.</p>
        </div>
        <div className="kartu-fitur">
          <div className="ikon-fitur">
            <KoinMon ukuran={52} />
          </div>
          <h3>NFT hasil cetakan</h3>
          <p>Order selesai, contract langsung membayar toko dan mengirim NFT berisi teks pelanggan.</p>
        </div>
      </section>

      <section id="bisnis" className="bisnis">
        <h2 className="judul-bisnis">DARI MANA CUANNYA?</h2>
        <div className="grid-bisnis">
          {[
            ['3%', 'Platform fee', 'Dipotong dari payout toko hanya saat order selesai. Dana sudah lewat escrow: satu baris di contract. Order Rp5.000 → toko Rp4.850, platform Rp150.'],
            ['Rp100–500', 'Fee layanan relayer', 'Per pesanan, menutup gas Monad supaya pelanggan tanpa crypto tetap bisa pesan; sisanya margin.'],
            ['0,7%', 'Convenience fee top-up', 'Biaya IDRX (QRIS 0,7%, VA Rp3.000–4.000) diteruskan ke pelanggan plus markup kecil.'],
            ['Toko Pro', 'Langganan toko', 'Radius lebih luas, badge, statistik omzet, prioritas leaderboard. Tanpa akses order lebih awal: rebutan tetap adil.'],
            ['Sponsor', 'Musim & leaderboard', 'Brand kertas/tinta mensponsori hadiah toko tercepat per sesi.'],
            ['B2B', 'Kampus & kantor', 'Akun massal untuk skripsi dan berkas CPNS, bayar langganan atau per volume. Plus margin ongkir antar.'],
          ].map(([angka, judul, isi]) => (
            <div key={judul} className="kartu-bisnis">
              <div className="angka-bisnis">{angka}</div>
              <h3>{judul}</h3>
              <p>{isi}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
