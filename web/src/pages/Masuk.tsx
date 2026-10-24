// /masuk?ke=/lobi — regular-app style sign-in/sign-up page: Google / email (Privy, embedded wallet), passkey (Mera),
// or guest (burner). Wallets are never mentioned to the user; everything is an "account". After sign-in → go to `ke`.
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
      setGalat('Passkey cancelled. Try again, use Google/email, or sign in as a guest.');
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
            Sign in
          </button>
          <button role="tab" aria-selected={tab === 'daftar'} className={tab === 'daftar' ? 'aktif' : ''} onClick={() => setTab('daftar')}>
            Sign up
          </button>
        </div>
        <h1>{tab === 'masuk' ? 'Welcome back' : 'Create a PrintPitt account'}</h1>
        <p className="sub-masuk">
          {tab === 'masuk' ? 'Continue the same way you did before.' : 'No password, nothing to install. Your account is created automatically when you sign in.'}
        </p>

        <div className="daftar-tombol-masuk">
          {PRIVY_APP_ID ? (
            <TombolPrivy onAkun={selesai} onGalat={setGalat} sibuk={!!sibuk} />
          ) : (
            <div className="catatan-masuk">Google/email sign-in (Privy) is not enabled in this build: set <code>VITE_PRIVY_APP_ID</code>.</div>
          )}
          {passkeyMungkin() && (
            <button className="tombol-masuk passkey" disabled={!!sibuk} onClick={passkey}>
              🔑 {sibuk === 'passkey' ? 'Opening passkey…' : tab === 'masuk' && punyaPasskey() ? 'Continue with passkey' : 'Create a passkey (fingerprint / face)'}
            </button>
          )}
          <div className="pemisah-masuk">
            <span>or</span>
          </div>
          <button className="tombol-masuk tamu" disabled={!!sibuk} onClick={() => selesai(akunBurner())}>
            Sign in as guest
          </button>
        </div>

        {galat && <p className="galat-masuk">{galat}</p>}
        {galat && punyaPasskey() && (
          <button className="tautan-masuk" onClick={() => (lupakanPasskey(), setGalat(''), setTab('daftar'))}>
            Create a new passkey
          </button>
        )}
        <p className="kecil-masuk">
          Guest accounts are stored on this device only. By signing in you agree to play on Monad testnet (no real money).
        </p>
        <button className="tautan-masuk" onClick={() => pindah('/', false)}>
          ‹ Back to home
        </button>
      </motion.section>
    </main>
  );
}
