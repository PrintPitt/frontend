// / — app home: pick a role. PrintPitt solves a real problem (customers post documents to print,
// print shops within 1–1.5 km race to take the job, faster = bigger payout, late = cashback).
// The 3D game is the stage/demo mode of the same mechanic.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { motion } from 'motion/react';
import '../arena/arena.css';
import '../arena3d/arena3d.css';
import { NAMA } from '../lib/merek';
import { pindah } from '../lib/navigasi';

const LANGKAH = [
  ['📄', 'Customer uploads a document', 'PDF/photo, pages counted automatically, pay in digital Rupiah with no gas.'],
  ['📍', 'Nearby shops get notified', 'Only print shops within 1–1.5 km see the order (Pro shops: 3 km).'],
  ['⚡', 'Race to claim, fastest wins', 'One shop claims the order. The payout drops every second until it is ready.'],
  ['🔐', 'Pick up with a QR', "Funds are released when the shop scans the customer's QR. Late? The rest is refunded to the customer."],
] as const;

export default function Beranda() {
  return (
    <main className="halaman-game beranda-app">
      <header className="kepala-beranda">
        <span className="logo-kecil">{NAMA}</span>
        <span className="pil-beranda">Quick prints near you · Monad</span>
      </header>

      <motion.h1 className="judul-beranda" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        Print documents at the nearest print shop.
        <br />
        <span>Shops race, you get the fastest.</span>
      </motion.h1>

      <div className="pilih-peran">
        <motion.button className="kartu-peran pelanggan" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => pindah('/pesan', false)}>
          <span className="ikon-peran">🖨️</span>
          <b>I want to print</b>
          <span>Upload a document, choose print / photocopy / laminate, pick it up at the nearest shop. Late = automatic cashback.</span>
          <span className="cta-peran">Order now ›</span>
        </motion.button>
        <motion.button className="kartu-peran toko" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => pindah('/toko', false)}>
          <span className="ikon-peran">🏪</span>
          <b>I own a print shop</b>
          <span>Orders from customers within your radius arrive in real time. Claim, work, hand over with a QR, get paid instantly.</span>
          <span className="cta-peran">Open shop dashboard ›</span>
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
          🎮 Stage mode: play the 3D game version of the same mechanic ›
        </button>
        <button className="tautan-panggung" onClick={() => pindah('/layar', false)}>
          📺 Projector screen (live board) ›
        </button>
      </footer>
    </main>
  );
}
