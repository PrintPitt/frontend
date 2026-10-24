// / — beranda app: pilih peran. PrintPitt menyelesaikan masalah nyata (pelanggan memposting dokumen untuk dicetak,
// toko fotokopi dalam radius 1–1,5 km berebut mengerjakannya, makin cepat makin besar bayarannya, telat = cashback).
// Game 3D adalah mode panggung/demo dari mekanik yang sama.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { motion } from 'motion/react';
import '../arena/arena.css';
import '../arena3d/arena3d.css';
import { NAMA } from '../lib/merek';
import { pindah } from '../lib/navigasi';

const LANGKAH = [
  ['📄', 'Pelanggan unggah dokumen', 'PDF/foto, jumlah halaman terhitung otomatis, bayar Rupiah digital tanpa gas.'],
  ['📍', 'Toko terdekat dapat notif', 'Hanya fotokopi dalam radius 1–1,5 km yang melihat order (Toko Pro 3 km).'],
  ['⚡', 'Rebutan, yang tercepat dapat', 'Satu toko merebut order. Bayaran turun tiap detik sampai siap.'],
  ['🔐', 'Ambil pakai QR', 'Dana cair saat toko memindai QR pelanggan. Telat? Sisanya kembali ke pelanggan.'],
] as const;

export default function Beranda() {
  return (
    <main className="halaman-game beranda-app">
      <header className="kepala-beranda">
        <span className="logo-kecil">{NAMA}</span>
        <span className="pil-beranda">Fotokopi kilat di sekitarmu · Monad</span>
      </header>

      <motion.h1 className="judul-beranda" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        Cetak dokumen di fotokopi terdekat.
        <br />
        <span>Toko berebut, kamu dapat yang tercepat.</span>
      </motion.h1>

      <div className="pilih-peran">
        <motion.button className="kartu-peran pelanggan" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => pindah('/pesan', false)}>
          <span className="ikon-peran">🖨️</span>
          <b>Saya mau cetak</b>
          <span>Unggah dokumen, pilih print / fotokopi / laminating, ambil di toko terdekat. Telat = cashback otomatis.</span>
          <span className="cta-peran">Pesan sekarang ›</span>
        </motion.button>
        <motion.button className="kartu-peran toko" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => pindah('/toko', false)}>
          <span className="ikon-peran">🏪</span>
          <b>Saya pemilik fotokopi</b>
          <span>Order dari pelanggan dalam radius tokomu masuk real-time. Rebut, kerjakan, serahkan pakai QR, uang langsung masuk.</span>
          <span className="cta-peran">Buka dashboard toko ›</span>
        </motion.button>
      </div>

      <section className="alur-beranda">
        {LANGKAH.map(([ikon, judul, isi], i) => (
          <motion.div key={judul} className="langkah-beranda" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + i * 0.07 }}>
            <span className="no-beranda">{i + 1}</span>
            <span className="ikon-langkah">{ikon}</span>
            <b>{judul}</b>
            <span>{isi}</span>
          </motion.div>
        ))}
      </section>

      <footer className="kaki-beranda">
        <button className="tautan-panggung" onClick={() => pindah('/lobi', false)}>
          🎮 Mode panggung: mainkan versi game 3D dari mekanik yang sama ›
        </button>
        <button className="tautan-panggung" onClick={() => pindah('/layar', false)}>
          📺 Layar proyektor (live board) ›
        </button>
      </footer>
    </main>
  );
}
