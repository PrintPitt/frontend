// /akun — panel akun: siapa yang masuk (Google/email, passkey, tamu), alamat, jaringan, saldo Rupiah + MON gas,
// status toko, kode juri (mainnet), dan keluar. Satu tempat untuk pengguna HP (PWA).
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
const NAMA_JENIS: Record<Akun['jenis'], string> = { privy: 'Google / email', mera: 'Passkey', burner: 'Tamu', dev: 'Akun dev (anvil)' };

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
          <div className="brand">{NAMA} · Akun</div>
        </header>
        <section className="kartu mulai">
          <h2>Belum masuk</h2>
          <p className="muted">Masuk dengan Google, email, atau passkey. Tanpa password, tanpa install dompet.</p>
          <button className="tombol utama besar" onClick={() => pindah('/masuk?ke=/akun', false)}>
            Masuk / daftar
          </button>
          <button className="tautan" onClick={() => setAkun(pakaiAkun(akunBurner()))}>
            Lanjut sebagai tamu
          </button>
        </section>
      </main>
    );

  return (
    <main className="pesan akun">
      <header className="pesan-head">
        <div className="brand">{NAMA} · Akun</div>
        <button className="tautan inline" onClick={() => history.length > 1 ? history.back() : pindah('/', false)}>
          ‹ kembali
        </button>
      </header>

      <section className="kartu akun-profil">
        <div className="akun-avatar" aria-hidden="true">
          {(akun.label ?? NAMA_JENIS[akun.jenis]).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <b>{akun.label ?? NAMA_JENIS[akun.jenis]}</b>
          <div className="muted kecil">Masuk dengan {NAMA_JENIS[akun.jenis]}</div>
          <button className="alamat-akun-kecil" onClick={salin} title={akun.address}>
            {pendek(akun.address)} · {disalin ? 'tersalin!' : 'salin alamat'}
          </button>
        </div>
      </section>

      <section className="kartu akun-baris-info">
        <div>
          <span className="muted kecil">Saldo Rupiah</span>
          <b>{rupiah === null ? '…' : formatRupiah(rupiah)}</b>
        </div>
        <div>
          <span className="muted kecil">MON (gas)</span>
          <b>{mon === null ? '…' : Number(formatEther(mon)).toLocaleString('id-ID', { maximumFractionDigits: 4 })}</b>
        </div>
        <div>
          <span className="muted kecil">Jaringan</span>
          <b>{IS_MAINNET ? 'Mainnet · IDRX' : 'Testnet · tIDRX'}</b>
          <button className="tautan inline kecil" onClick={gantiJaringan}>
            ganti
          </button>
        </div>
      </section>

      <section className="kartu">
        <span className="muted kecil">Toko</span>
        {toko?.terdaftar ? (
          <p>
            <b>{toko.nama}</b> {toko.aktif ? <span className="badge">aktif</span> : <span className="badge">nonaktif</span>}
          </p>
        ) : (
          <p className="muted">Belum punya toko. Pemilik fotokopi bisa daftar gratis dari dashboard toko.</p>
        )}
        <button className="tombol" onClick={() => pindah('/toko', false)}>
          {toko?.terdaftar ? 'Buka dashboard toko' : 'Daftarkan toko'}
        </button>
      </section>

      <section className="kartu">
        <span className="muted kecil">Pesanan</span>
        <p className="muted">Pesan cetak, isi saldo, dan lacak pesanan aktif.</p>
        <button className="tombol" onClick={() => pindah('/pesan', false)}>
          Buka halaman pesan
        </button>
      </section>

      {IS_MAINNET && (
        <section className="kartu">
          <span className="muted kecil">Kode juri</span>
          <p className="muted">{adaKode ? 'Tersimpan di perangkat ini (dipakai untuk saldo MON gas).' : 'Belum ada. Masukkan kode juri di halaman pesan.'}</p>
          {adaKode && (
            <button className="tautan inline" onClick={() => (simpanKode(''), setAdaKode(false))}>
              hapus kode dari perangkat
            </button>
          )}
        </section>
      )}

      <section className="kartu">
        {akun.jenis === 'burner' && <p className="muted kecil">Akun tamu tersimpan di browser ini saja. Menghapus data browser = akun dan saldonya hilang.</p>}
        <button className="tombol besar" onClick={keluar}>
          Keluar
        </button>
      </section>
    </main>
  );
}
