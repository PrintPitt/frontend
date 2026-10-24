// Satu kamus untuk semua teks PrintPitt. Bawaan English; Indonesia lewat toggle EN · ID di bilah atas.
// Cara pakai di modul: import { t, lang } from '../i18n'; t('d.hero.h1') → string sesuai bahasa aktif.
// Kunci dikelompokkan per bagian: 'shell.*', 'd.*' (Arena Toko+), 'e.*' (Blitz+). Teks boleh berisi HTML sederhana (<b>, <br>).
export type Lang = 'en' | 'id';
type Entry = { en: string; id: string };

function readLang(): Lang {
  // ?lang=id / ?lang=en di URL menang (untuk tautan yang dibagikan); tidak disimpan
  try { const u = new URLSearchParams(location.search).get('lang'); if (u === 'en' || u === 'id') return u; } catch { /* abaikan */ }
  try { const v = localStorage.getItem('pp-lang'); if (v === 'en' || v === 'id') return v; } catch { /* storage diblokir */ }
  return 'en';
}
export const lang: Lang = readLang();
document.documentElement.lang = lang;

export function setLang(l: Lang) {
  try { localStorage.setItem('pp-lang', l); } catch { /* tetap ganti walau tidak tersimpan */ }
  const y = scrollY;
  try { sessionStorage.setItem('pp-scroll', String(y)); } catch { /* abaikan */ }
  location.reload();
}

export const DICT: Record<string, Entry> = {
  // ---------- kerangka ----------
  'shell.lang.aria': { en: 'Switch language / Ganti bahasa', id: 'Switch language / Ganti bahasa' },
  'shell.cta': { en: 'Order now', id: 'Pesan sekarang' },
  'shell.stagehelp': { en: 'Stage mode: → / ← / Space to move between scenes', id: 'Mode panggung: → / ← / Spasi untuk pindah bagian' },
  'shell.noscript': { en: 'PrintPitt — the onchain print shop on Monad. Enable JavaScript to see the demo.', id: 'PrintPitt — toko fotokopi kilat onchain di Monad. Aktifkan JavaScript untuk melihat demonya.' },
  'shell.headline': { en: 'More Blitz, More Money.', id: 'Makin kilat, makin cuan.' },
  'shell.sub': {
    en: 'Two print shops race for your order onchain. The faster they finish, the more they earn — the rest flows back to you, every second.',
    id: 'Dua toko fotokopi rebutan pesananmu onchain. Makin cepat selesai, makin besar upahnya — sisanya mengalir balik ke kamu, tiap detik.',
  },
  'shell.subline': { en: 'Every second counts. Literally.', id: 'Setiap detik dihitung. Beneran.' },
  'shell.bigword': { en: 'BLITZ', id: 'BLITZ' },

  // ---------- bagian D · Arena Toko+ (angka di D = contoh alur, bukan data chain) ----------
  'd.aria.stage': { en: 'How it works: one order, from phone to printed card', id: 'Cara kerja: satu order dari HP sampai jadi kartu cetakan' },
  'd.hero.hl': { en: 'Blitz', id: 'kilat' }, // kata yang disorot di headline
  'd.hero.qr': { en: 'Scan to order from your phone', id: 'Scan untuk pesan dari HP' },
  'd.hero.qrAria': { en: 'QR code to the order page', id: 'QR ke halaman pesan' },
  'd.hero.cue': { en: 'Scroll to start the round', id: 'Gulir untuk mulai ronde' },
  'd.shop.a': { en: 'Fotokopi Jaya', id: 'Fotokopi Jaya' },
  'd.shop.b': { en: 'Sinar Copy', id: 'Sinar Copy' },
  'd.customer': { en: 'Ratna', id: 'Ratna' },
  'd.order.kind': { en: 'Hardcover Thesis', id: 'Skripsi Hardcover' },
  'd.order.title': { en: 'Campus Copy-Shop Queues: An Analysis', id: 'Analisis Antrean Fotokopi Depan Kampus' },
  'd.phone.total': { en: 'Total', id: 'Total' },
  'd.phone.pay': { en: 'Pay', id: 'Bayar' },
  'd.phone.paid': { en: 'Paid', id: 'Dibayar' },
  'd.phone.customer': { en: 'Customer: {name}', id: 'Pelanggan: {name}' },
  'd.phone.held': { en: 'Held in escrow', id: 'Ditahan kontrak' },
  'd.phone.sent': { en: 'Sent to the arena', id: 'Terkirim ke arena' },
  'd.vault.label': { en: 'ESCROW', id: 'KONTRAK' },
  'd.steps.aria': { en: 'Steps', id: 'Langkah' },
  'd.step.1': { en: 'Order', id: 'Pesan &amp; bayar' },
  'd.step.2': { en: 'Race', id: 'Rebutan' },
  'd.step.3': { en: 'Work', id: 'Kerjakan' },
  'd.step.4': { en: 'Payout', id: 'Selesai' },
  'd.step.5': { en: 'Your print', id: 'Cetakanmu' },
  'd.sign.1': { en: 'Your money is held in escrow, not by the shop.', id: 'Uangmu ditahan kontrak, bukan tokonya.' },
  'd.sign.2': { en: 'Two shops race for the order. Monad decides who claimed first.', id: 'Dua toko berebut. Yang klaim duluan, Monad yang memutuskan.' },
  'd.sign.3': { en: 'Copy, print, laminate. The shop’s pay drops every second.', id: 'Fotokopi, print, laminating. Upah toko turun tiap detik.' },
  'd.st.print': { en: 'Print', id: 'Print' },
  'd.st.copy': { en: 'Copy', id: 'Fotokopi' },
  'd.st.lam': { en: 'Laminate', id: 'Laminating' },
  'd.st.hint': { en: 'Drag to rotate · double-tap to reset', id: 'Seret untuk memutar · ketuk 2× untuk kembali' },
  'd.st.aria.pr': { en: 'Printer actions', id: 'Aksi printer' },
  'd.st.aria.fk': { en: 'Photocopier actions', id: 'Aksi mesin fotokopi' },
  'd.st.aria.lm': { en: 'Laminator actions', id: 'Aksi laminator' },
  'd.fig.fk': { en: 'Photocopier', id: 'Mesin fotokopi' },
  'd.fig.pr': { en: 'Printer', id: 'Printer' },
  'd.fig.lm': { en: 'Laminator', id: 'Laminator' },
  // teks tombol stasiun; label yang dikirim ke figur tetap label asli (data-a)
  'd.btn.on': { en: 'Power on', id: 'Nyalakan' },
  'd.btn.print': { en: 'Print!', id: 'Print!' },
  'd.btn.take': { en: 'Collect', id: 'Ambil hasil' },
  'd.btn.lid': { en: 'Open lid', id: 'Angkat tutup' },
  'd.btn.doc': { en: 'Place document', id: 'Taruh dokumen' },
  'd.btn.copy': { en: 'Copy!', id: 'Copy!' },
  'd.btn.pouch': { en: 'Feed pouch', id: 'Masukkan pouch' },
  'd.claim': { en: 'CLAIM!', id: 'KLAIM!' },
  'd.claim.sub': { en: 'Monad decides · 1 block ~0.4 s', id: 'Monad memutuskan · 1 blok ±0,4 dtk' },
  'd.late': { en: '1 block late', id: 'Telat 1 blok' },
  'd.board.rib': { en: 'Round complete!', id: 'Ronde selesai!' },
  'd.board.sample': { en: 'example round', id: 'contoh alur' },
  'd.board.time': { en: 'Done in <b class="d-num">{t} s</b> out of {max}', id: 'Selesai dalam <b class="d-num">{t} dtk</b> dari {max}' },
  'd.board.toShop': { en: 'to the shop · {shop}', id: 'ke toko · {shop}' },
  'd.board.refund': { en: 'refunded to {name}', id: 'balik ke {name}' },
  'd.cap.4': { en: 'The shop is paid for its speed. The rest flows back automatically.', id: 'Toko dibayar sesuai kecepatan, sisanya balik otomatis.' },
  'd.cap.5': { en: 'You get an NFT of your print, with your name on it.', id: 'Kamu dapat NFT hasil cetakan, lengkap dengan namamu.' },
  'd.card.back': { en: 'Print card #0042', id: 'Kartu cetakan #0042' },
  'd.card.nft': { en: 'NFT #0042', id: 'NFT #0042' },
  'd.card.chain': { en: 'Monad', id: 'Monad' },
  'd.card.for': { en: 'printed for', id: 'dicetak untuk' },
  'd.card.meta': { en: '{shop} · {t} s', id: '{shop} · {t} dtk' },
  'd.round.pay': { en: 'Shop payout', id: 'Upah toko' },
  'd.round.late': { en: 'Late: full refund', id: 'Telat: refund penuh' },
  'd.round.payShop': { en: '{shop} payout', id: 'Upah {shop}' },
  'd.round.done': { en: 'Done: {t} s', id: 'Selesai: {t} dtk' },
  'd.round.ref': { en: 'refund to {name}', id: 'sisa balik ke {name}' },
  'd.unit.s': { en: 's', id: 'dtk' },
  'd.ticket.done': { en: 'DONE', id: 'SELESAI' },
  'd.gate': { en: 'ARENA', id: 'ARENA' },
  'd.proc.copy': { en: 'Copying…', id: 'Menyalin…' },
  'd.proc.print': { en: 'Printing & binding…', id: 'Mencetak & menjilid…' },
  'd.proc.lam': { en: 'Laminating…', id: 'Melaminasi…' },
  'd.tk.copied': { en: '3 copies', id: '3 salinan' },
  'd.tk.bound': { en: 'Printed & bound', id: 'Dicetak & dijilid' },
  'd.tk.lam': { en: 'Laminated', id: 'Dilaminasi' },
};

/** Ambil teks sesuai bahasa aktif. Kunci tidak ada → kunci itu sendiri (supaya kelihatan saat uji). */
export function t(key: string): string {
  const e = DICT[key];
  return e ? e[lang] : key;
}
/** Tambah entri dari modul bagian (dipakai d.i18n.ts / e.i18n.ts bila dipisah). */
export function addDict(entries: Record<string, Entry>) { Object.assign(DICT, entries); }
