// /akun — account panel: who is signed in (Google/email, passkey, guest), address, network, Rupiah balance + MON gas,
// shop status, judge code (mainnet) and sign out. One place for phone users (PWA).
import { useCallback, useEffect, useState } from 'react';
import { formatEther, type Hex } from 'viem';
import { formatRupiah } from '../../../shared/src/index.ts';
import { akunAktif, akunBurner, pakaiAkun, type Akun } from '../lib/akun';
import { bacaKode, saldoTidrx, simpanKode } from '../lib/backend';
import { IS_MAINNET, JARINGAN, kontrak, pub } from '../lib/chain';
import { pendek } from '../lib/format';
import { NAMA } from '../lib/merek';
import { pindah } from '../lib/navigasi';

type InfoToko = { terdaftar: boolean; aktif: boolean; nama: string };
const NAMA_JENIS: Record<Akun['jenis'], string> = { privy: 'Google / email', mera: 'Passkey', burner: 'Guest', dev: 'Dev account (anvil)' };

export default function Akun() {
  const [akun, setAkun] = useState<Akun | null>(akunAktif);
  const [rupiah, setRupiah] = useState<bigint | null>(null);
  const [mon, setMon] = useState<bigint | null>(null);
  const [toko, setToko] = useState<InfoToko | null>(null);
  const [disalin, setDisalin] = useState(false);
  const [adaKode, setAdaKode] = useState(() => !!bacaKode());

  const segarkan = useCallback(async (a: Akun) => {
    const [r, m, t] = await Promise.all([
      saldoTidrx(a.address).catch(() => null),
      pub.getBalance({ address: a.address }).catch(() => null),
      pub.readContract({ ...kontrak, functionName: 'toko', args: [a.address as Hex] }).catch(() => null),
    ]);
    setRupiah(r);
    setMon(m);
    // v2.3: toko(addr) = (terdaftar, aktif, orderAktif, nama)
    setToko(t ? { terdaftar: t[0], aktif: t[1], nama: t[3] } : null);
  }, []);
  useEffect(() => {
    if (akun) segarkan(akun);
  }, [akun, segarkan]);

  function salin() {
    if (!akun) return;
    navigator.clipboard?.writeText(akun.address).then(() => {
      setDisalin(true);
      setTimeout(() => setDisalin(false), 1500);
    });
  }

  /** Keluar: akhiri sesi (Privy logout / sesi passkey), lalu muat ulang ke /masuk. Akun tamu tetap tersimpan di perangkat. */
  function keluar() {
    akun?.akhiri();
    location.href = '/masuk?ke=/akun';
  }

  function gantiJaringan() {
    location.href = `/akun?jaringan=${JARINGAN === 'mainnet' ? 'testnet' : 'mainnet'}`;
  }

  if (!akun)
    return (
      <main className="pesan akun">
        <header className="pesan-head">
          <div className="brand">{NAMA} · Account</div>
        </header>
        <section className="kartu mulai">
          <h2>Not signed in</h2>
          <p className="muted">Sign in with Google, email or a passkey. No password, no wallet to install.</p>
          <button className="tombol utama besar" onClick={() => pindah('/masuk?ke=/akun', false)}>
            Sign in / sign up
          </button>
          <button className="tautan" onClick={() => setAkun(pakaiAkun(akunBurner()))}>
            Continue as guest
          </button>
        </section>
      </main>
    );

  return (
    <main className="pesan akun">
      <header className="pesan-head">
        <div className="brand">{NAMA} · Account</div>
        <button className="tautan inline" onClick={() => history.length > 1 ? history.back() : pindah('/', false)}>
          ‹ back
        </button>
      </header>

      <section className="kartu akun-profil">
        <div className="akun-avatar" aria-hidden="true">
          {(akun.label ?? NAMA_JENIS[akun.jenis]).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <b>{akun.label ?? NAMA_JENIS[akun.jenis]}</b>
          <div className="muted kecil">Signed in with {NAMA_JENIS[akun.jenis]}</div>
          <button className="alamat-akun-kecil" onClick={salin} title={akun.address}>
            {pendek(akun.address)} · {disalin ? 'copied!' : 'copy address'}
          </button>
        </div>
      </section>

      <section className="kartu akun-baris-info">
        <div>
          <span className="muted kecil">Rupiah balance</span>
          <b>{rupiah === null ? '…' : formatRupiah(rupiah)}</b>
        </div>
        <div>
          <span className="muted kecil">MON (gas)</span>
          <b>{mon === null ? '…' : Number(formatEther(mon)).toLocaleString('id-ID', { maximumFractionDigits: 4 })}</b>
        </div>
        <div>
          <span className="muted kecil">Network</span>
          <b>{IS_MAINNET ? 'Mainnet · IDRX' : 'Testnet · tIDRX'}</b>
          <button className="tautan inline kecil" onClick={gantiJaringan}>
            switch
          </button>
        </div>
      </section>

      <section className="kartu">
        <span className="muted kecil">Shop</span>
        {toko?.terdaftar ? (
          <p>
            <b>{toko.nama}</b> {toko.aktif ? <span className="badge">active</span> : <span className="badge">inactive</span>}
          </p>
        ) : (
          <p className="muted">No shop yet. Copy shop owners can register for free from the shop dashboard.</p>
        )}
        <button className="tombol" onClick={() => pindah('/toko', false)}>
          {toko?.terdaftar ? 'Open shop dashboard' : 'Register a shop'}
        </button>
      </section>

      <section className="kartu">
        <span className="muted kecil">Orders</span>
        <p className="muted">Order prints, top up and track your active order.</p>
        <button className="tombol" onClick={() => pindah('/pesan', false)}>
          Open the order page
        </button>
      </section>

      {IS_MAINNET && (
        <section className="kartu">
          <span className="muted kecil">Judge code</span>
          <p className="muted">{adaKode ? 'Saved on this device (used for MON gas balance).' : 'None yet. Enter the judge code on the order page.'}</p>
          {adaKode && (
            <button className="tautan inline" onClick={() => (simpanKode(''), setAdaKode(false))}>
              remove code from this device
            </button>
          )}
        </section>
      )}

      <section className="kartu">
        {akun.jenis === 'burner' && <p className="muted kecil">Guest accounts live in this browser only. Clearing browser data removes the account and its balance.</p>}
        <button className="tombol besar" onClick={keluar}>
          Sign out
        </button>
      </section>
    </main>
  );
}
