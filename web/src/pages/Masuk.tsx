// /masuk?ke=/lobi — halaman masuk/daftar ala aplikasi biasa: Google / email (Privy, embedded wallet), passkey (Mera),
// atau tamu (burner). Wallet tidak pernah disebut ke pengguna; semua jadi "akun". Setelah masuk → pindah ke `ke`.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { motion } from 'motion/react';
import { useState } from 'react';
import '../arena/arena.css';
import '../arena3d/arena3d.css';
import { akunAktif, akunBurner, lupakanPasskey, masuk, pakaiAkun, passkeyMungkin, punyaPasskey, type Akun } from '../lib/akun';
import { NAMA } from '../lib/merek';
import { pindah } from '../lib/navigasi';
import { PRIVY_APP_ID, TombolPrivy } from '../lib/privy';

export default function Masuk() {
  const ke = new URLSearchParams(location.search).get('ke') || '/lobi';
  const [tab, setTab] = useState<'masuk' | 'daftar'>(punyaPasskey() ? 'masuk' : 'daftar');
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState('');

  const selesai = (a: Akun) => {
    pakaiAkun(a);
    pindah(ke, false);
  };
  if (akunAktif()) {
    pindah(ke, false);
    return null;
  }

  async function passkey() {
    setGalat('');
    setSibuk('passkey');
    try {
      selesai(await masuk());
    } catch {
      setGalat('Passkey dibatalkan. Coba lagi, pakai Google/email, atau masuk sebagai tamu.');
    } finally {
      setSibuk(null);
    }
  }

  return (
    <main className="halaman-game masuk-halaman">
      <motion.section className="kartu-masuk-besar" initial={{ y: 30, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', bounce: 0.35 }}>
        <div className="logo-masuk">
          <span className="logo-kecil">{NAMA}</span>
        </div>
        <div className="tab-masuk" role="tablist">
          <button role="tab" aria-selected={tab === 'masuk'} className={tab === 'masuk' ? 'aktif' : ''} onClick={() => setTab('masuk')}>
            Masuk
          </button>
          <button role="tab" aria-selected={tab === 'daftar'} className={tab === 'daftar' ? 'aktif' : ''} onClick={() => setTab('daftar')}>
            Daftar
          </button>
        </div>
        <h1>{tab === 'masuk' ? 'Selamat datang kembali' : 'Buat akun PrintPitt'}</h1>
        <p className="sub-masuk">
          {tab === 'masuk' ? 'Lanjutkan dengan cara yang kamu pakai sebelumnya.' : 'Tanpa password, tanpa install apa pun. Akun dibuat otomatis saat kamu masuk.'}
        </p>

        <div className="daftar-tombol-masuk">
          {PRIVY_APP_ID ? (
            <TombolPrivy onAkun={selesai} onGalat={setGalat} sibuk={!!sibuk} />
          ) : (
            <div className="catatan-masuk">Login Google/email (Privy) belum aktif di build ini: isi <code>VITE_PRIVY_APP_ID</code>.</div>
          )}
          {passkeyMungkin() && (
            <button className="tombol-masuk passkey" disabled={!!sibuk} onClick={passkey}>
              🔑 {sibuk === 'passkey' ? 'Membuka passkey…' : tab === 'masuk' && punyaPasskey() ? 'Lanjut dengan passkey' : 'Buat passkey (sidik jari / wajah)'}
            </button>
          )}
          <div className="pemisah-masuk">
            <span>atau</span>
          </div>
          <button className="tombol-masuk tamu" disabled={!!sibuk} onClick={() => selesai(akunBurner())}>
            Masuk sebagai tamu
          </button>
        </div>

        {galat && <p className="galat-masuk">{galat}</p>}
        {galat && punyaPasskey() && (
          <button className="tautan-masuk" onClick={() => (lupakanPasskey(), setGalat(''), setTab('daftar'))}>
            Buat passkey baru
          </button>
        )}
        <p className="kecil-masuk">
          Akun tamu tersimpan di perangkat ini saja. Dengan masuk kamu setuju bermain di Monad testnet (tanpa uang sungguhan).
        </p>
        <button className="tautan-masuk" onClick={() => pindah('/', false)}>
          ‹ Kembali ke beranda
        </button>
      </motion.section>
    </main>
  );
}
