// /pesan — halaman penonton di HP (BLZ-09, BL-D22-08): akun → saldo Rupiah (tIDRX) → isi saldo bila perlu →
// pilih pesanan → tanda tangan Pesanan + permit (tanpa MON, gas dibayar relayer) → status live → NFT / refund.
// Contract v2.1: jenis 1–4 = mode demo (1 halaman, tanpa dokumen, kodeHash 0, selesai di langkah terakhir).
// Jenis 5+ = cetak dokumen nyata: unggah file → harga dari `hargaUntuk` → rahasia QR di HP → lokasi order → QR saat Siap.
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { formatRupiah, hitungPayout, MAX_HALAMAN, MAX_TEXT, NOL32, teksValid } from '../../../shared/src/index.ts';
import { akunAktif, akunBurner, lupakanPasskey, masuk, pakaiAkun, passkeyMungkin, punyaPasskey, type Akun } from '../lib/akun';
import {
  ambilConfig,
  ambilTopup,
  bayarTopup,
  buatTopup,
  kirimLokasiOrder,
  lokasiPerangkat,
  mintaMon,
  pesanTanpaGas,
  saldoTidrx,
  unggahDokumen,
  type InfoDokumen,
  type Titik,
  type TopUp,
} from '../lib/backend';
import { BATAS_JEMPUT, BATAS_SENGKETA, kontrak, offsetChain, pub } from '../lib/chain';
import { NAMA_LANGKAH, pendek } from '../lib/format';
import { NAMA } from '../lib/merek';
import { pindah } from '../lib/navigasi';
import { bacaHarga, bacaKatalog, bacaNft, bacaOrder, bacaToko, payoutBersih, type Katalog, type Order } from '../lib/katalog';
import { useJamChain } from '../lib/live';
import { bacaRahasia, buatRahasia, hapusRahasia, isiQr, simpanRahasia } from '../lib/serah';
import { biayaMaks, kirim, pesanError } from '../lib/tx';

const POLL_MS = Number(import.meta.env.VITE_POLL_MS || 1500);
const DEBUG = new URLSearchParams(location.search).has('debug'); // SPK-07: waktu onboarding + alasan fallback
const KUNCI_ORDER = 'pp.order.aktif';
/** Jenis 1–4 = order mini-game (dikerjakan di game /main). Jenis 5+ = cetak dokumen nyata (unggah file + serah terima QR). */
const JENIS_DEMO = (k: Katalog) => k.jenis <= 4;
/** Teks order dari nama file: hanya karakter yang lolos `teksValid`, maks. 40. */
const teksDariFile = (nama: string) =>
  nama
    .replace(/\.[^.]+$/, '')
    .replace(/[^\x20-\x7e]|[<>&"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT) || 'Dokumen';
const CONTOH: Record<number, string> = {
  1: 'KTP Budi bolak-balik 10x',
  2: 'Boarding JOG-CGK 05.40',
  3: 'Ijazah S1 Teknik Informatika',
  4: 'Menu Warung Bu Sri',
};
const NOMINAL = [20_000, 50_000, 100_000];

const baca = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const tulis = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};
const pesanGalat = (e: unknown) => (e instanceof Error && !('walk' in e) ? e.message : pesanError(e));

export default function Pesan() {
  const [akun, setAkun] = useState<Akun | null>(akunAktif);
  const [masukJalan, setMasukJalan] = useState(false);
  const [durasiMasuk, setDurasiMasuk] = useState(0);
  const [galatAkun, setGalatAkun] = useState('');
  const [saldo, setSaldo] = useState<bigint | null>(null);
  const [fee, setFee] = useState<bigint | null>(null);
  const [feeBps, setFeeBps] = useState(300);
  const [katalog, setKatalog] = useState<Katalog[]>([]);
  const [namaToko, setNamaToko] = useState<Record<string, string>>({});
  const [batasAntre, setBatasAntre] = useState(45);
  // order dokumen nyata (jenis 5+)
  const [dok, setDok] = useState<InfoDokumen | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [halaman, setHalaman] = useState(1);
  const [hargaDok, setHargaDok] = useState<{ harga: bigint; batasKerja: number } | null>(null);
  const [titik, setTitik] = useState<Titik | null>(null);
  const [infoLokasi, setInfoLokasi] = useState('');
  const [offset, setOffset] = useState(0);
  const [pilih, setPilih] = useState<number | null>(null);
  const [teks, setTeks] = useState('');
  const [tahap, setTahap] = useState<'' | 'tanda' | 'kirim' | 'tunggu'>('');
  const [galat, setGalat] = useState('');
  const [isiSaldo, setIsiSaldo] = useState(false);
  const [orderId, setOrderId] = useState<bigint | null>(() => {
    const v = baca(KUNCI_ORDER);
    return v ? BigInt(v) : null;
  });
  const [order, setOrder] = useState<Order | null>(null);
  const [nft, setNft] = useState<{ name: string; image: string } | null>(null);
  const [galatMuat, setGalatMuat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [gagalPoll, setGagalPoll] = useState(0);

  // Data awal (katalog, toko, fee relayer); kalau gagal tampilkan pesan + coba ulang otomatis tiap 5 dtk.
  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      // fee dibaca dari contract (sumber kebenaran); backend hanya untuk top-up & relay, jadi katalog tetap tampil saat backend mati
      const [k, t, b, off, feeRelay, bps] = await Promise.all([
        bacaKatalog(),
        bacaToko(),
        pub.readContract({ ...kontrak, functionName: 'batasAntre' }),
        offsetChain(),
        pub.readContract({ ...kontrak, functionName: 'feeRelay' }),
        pub.readContract({ ...kontrak, functionName: 'platformFeeBps' }),
      ]);
      setKatalog(k);
      setNamaToko(Object.fromEntries(t.map((x) => [x.alamat.toLowerCase(), x.nama])));
      setBatasAntre(b);
      setOffset(off);
      setFee(feeRelay);
      setFeeBps(Number(bps));
      ambilConfig().catch(() => setGalat('Server top-up/relayer tidak bisa dihubungi. Pesan tanpa gas mungkin gagal.'));
      setGalatMuat('');
    } catch (e) {
      setGalatMuat(pesanGalat(e));
    } finally {
      setMemuat(false);
    }
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);
  useEffect(() => {
    if (!galatMuat) return;
    const t = setTimeout(muat, 5000);
    return () => clearTimeout(t);
  }, [galatMuat, muat]);

  const segarkanSaldo = useCallback(async (a: Akun) => {
    const s = await saldoTidrx(a.address);
    setSaldo(s);
    return s;
  }, []);
  useEffect(() => {
    if (akun) segarkanSaldo(akun).catch(() => {});
  }, [akun, segarkanSaldo]);

  // Polling satu order sampai final.
  useEffect(() => {
    if (orderId === null) return;
    let berhenti = false;
    let t: ReturnType<typeof setTimeout>;
    const putar = async () => {
      try {
        const o = await bacaOrder(orderId);
        if (berhenti) return;
        setOrder(o);
        setGagalPoll(0);
        if (o.status === 'Finished' || o.status === 'Diputuskan') {
          if (BigInt(o.kodeHash) !== 0n) hapusRahasia(o.kodeHash);
          if (o.status === 'Finished') bacaNft(orderId).then(setNft).catch(() => {});
          if (akun) segarkanSaldo(akun).catch(() => {});
          return;
        }
        if (o.status === 'Expired') {
          if (BigInt(o.kodeHash) !== 0n) hapusRahasia(o.kodeHash);
          if (akun) segarkanSaldo(akun).catch(() => {});
          return;
        }
      } catch {
        if (!berhenti) setGagalPoll((n) => n + 1);
      }
      if (!berhenti) t = setTimeout(putar, POLL_MS);
    };
    putar();
    return () => {
      berhenti = true;
      clearTimeout(t);
    };
  }, [orderId, akun, segarkanSaldo]);

  async function mulai(paksaBurner = false) {
    setGalatAkun('');
    setMasukJalan(true);
    const t0 = performance.now();
    try {
      setAkun(paksaBurner ? pakaiAkun(akunBurner()) : await masuk());
      setDurasiMasuk(performance.now() - t0);
    } catch (e) {
      if (DEBUG) console.warn('masuk gagal', e);
      setGalatAkun('Passkey dibatalkan. Coba lagi, atau pakai akun sementara.');
    } finally {
      setMasukJalan(false);
    }
  }

  const k = katalog.find((x) => x.jenis === pilih);
  const nyata = !!k && !JENIS_DEMO(k);
  // Harga order dokumen dibaca dari contract (`hargaUntuk`) untuk jumlah halaman yang dibayar.
  useEffect(() => {
    if (!k || JENIS_DEMO(k)) return setHargaDok(null);
    let batal = false;
    setHargaDok(null);
    bacaHarga(k.jenis, halaman)
      .then((h) => !batal && setHargaDok(h))
      .catch((e) => !batal && setGalat(pesanGalat(e)));
    return () => void (batal = true);
  }, [k, halaman]);
  const harga = !k ? null : nyata ? (hargaDok?.harga ?? null) : k.harga;
  const total = harga !== null && fee !== null ? harga + fee : null;
  const kurang = total !== null && saldo !== null && saldo < total;

  async function pilihFile(f: File | undefined) {
    if (!f) return;
    setGalat('');
    setMengunggah(true);
    try {
      const d = await unggahDokumen(f);
      setDok(d);
      setHalaman(Math.min(MAX_HALAMAN, Math.max(1, d.halaman)));
      if (!teks) setTeks(teksDariFile(f.name));
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setMengunggah(false);
    }
  }

  async function ambilLokasi() {
    setInfoLokasi('Membaca lokasi…');
    try {
      setTitik(await lokasiPerangkat());
      setInfoLokasi('');
    } catch (e) {
      setInfoLokasi(pesanGalat(e));
    }
  }

  async function bayar() {
    if (!akun || !k || fee === null || harga === null) return;
    if (!teksValid(teks)) return setGalat('Teks 1–40 huruf biasa (tanpa emoji dan tanpa < > & " \' \\)');
    if (nyata && !dok) return setGalat('Unggah dokumen dulu');
    setGalat('');
    try {
      const s = await segarkanSaldo(akun);
      if (s < harga + fee) {
        setIsiSaldo(true);
        throw new Error(`Saldo kurang: butuh ${formatRupiah(harga + fee)}, ada ${formatRupiah(s)}`);
      }
      setTahap('tanda');
      // Order dokumen: rahasia QR disimpan di HP SEBELUM dikirim; hanya kodeHash yang masuk chain.
      let dokumen: Hex = NOL32;
      let kodeHash: Hex = NOL32;
      if (nyata && dok) {
        const r = buatRahasia();
        simpanRahasia(r.kodeHash, r.rahasia);
        dokumen = dok.dokumen;
        kodeHash = r.kodeHash;
      }
      const jalan = pesanTanpaGas(akun, { jenis: k.jenis, teks, harga, fee, halaman: nyata ? halaman : 1, dokumen, kodeHash });
      setTahap('kirim');
      const { id } = await jalan;
      tulis(KUNCI_ORDER, String(id));
      setOrder(null);
      setNft(null);
      setOrderId(id);
      setTeks('');
      setPilih(null);
      setDok(null);
      setHalaman(1);
      // Lokasi kasar order (±110 m) supaya muncul di feed toko dalam radius; hanya selama order masih Open.
      if (nyata && titik)
        kirimLokasiOrder(akun, id, titik)
          .then(() => setInfoLokasi('Lokasi terkirim: toko terdekat bisa melihat ordermu'))
          .catch((e) => setInfoLokasi(`Lokasi gagal dikirim: ${pesanGalat(e)}`));
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setTahap('');
      segarkanSaldo(akun).catch(() => {});
    }
  }

  function pesanLagi() {
    tulis(KUNCI_ORDER, null);
    setInfoLokasi('');
    setOrderId(null);
    setOrder(null);
    setNft(null);
  }

  const teksOk = teks.length === 0 || teksValid(teks);
  const labelTombol = tahap === 'tanda' ? 'Menandatangani…' : tahap === 'kirim' ? 'Mengirim ke Monad…' : total !== null ? `Bayar ${formatRupiah(total)}` : 'Bayar';

  return (
    <main className="pesan">
      <header className="pesan-head">
        <div>
          <div className="brand">{NAMA}</div>
          <div className="muted kecil">Pesan dari HP, toko rebutan order</div>
        </div>
        {akun && (
          <button className="chip chip-saldo" title={akun.address} onClick={() => setIsiSaldo((x) => !x)}>
            {saldo === null ? '…' : formatRupiah(saldo)} <span className="plus">＋</span>
          </button>
        )}
      </header>

      {!akun ? (
        <section className="kartu mulai">
          <h2>Pesan cetak kilat</h2>
          <p className="muted">
            Bayar pakai Rupiah digital ke escrow, tanpa biaya gas. Makin cepat toko selesai, makin besar bayarannya. Kalau lambat, sisanya kembali ke kamu, plus NFT hasil cetakan.
          </p>
          <button className="tombol utama besar" disabled={masukJalan} onClick={() => pindah('/masuk?ke=/pesan', false)}>
            Masuk / daftar
          </button>
          <button className="tautan" disabled={masukJalan} onClick={() => mulai(true)}>
            Lanjut sebagai tamu
          </button>
          {galatAkun && <p className="galat">{galatAkun}</p>}
          {galatAkun && punyaPasskey() && (
            <button className="tautan" onClick={() => (lupakanPasskey(), setGalatAkun(''))}>
              Buat passkey baru
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="akun-baris muted kecil">
            <span className={`badge ${akun.jenis}`}>{akun.jenis === 'privy' ? (akun.label ?? 'Privy') : akun.jenis === 'mera' ? 'Passkey' : akun.jenis === 'dev' ? 'Dev' : 'Tamu'}</span>
            <span>{pendek(akun.address)}</span>
            <span>· tanpa gas</span>
            {DEBUG && (
              <span>
                · {(durasiMasuk / 1000).toFixed(1)} dtk{akun.alasanFallback ? ` · fallback: ${akun.alasanFallback}` : ''}
              </span>
            )}
          </section>

          <AnimatePresence>
            {(isiSaldo || saldo === 0n) && orderId === null && (
              <motion.section key="isi" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <IsiSaldo
                  akun={akun}
                  onMasuk={() => {
                    segarkanSaldo(akun).catch(() => {});
                    setIsiSaldo(false);
                  }}
                  onTutup={saldo !== 0n ? () => setIsiSaldo(false) : undefined}
                />
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {orderId !== null ? (
              <motion.section key="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <StatusPesanan
                  id={orderId}
                  akun={akun}
                  order={order}
                  feeBps={feeBps}
                  batasJemput={BATAS_JEMPUT}
                  infoLokasi={infoLokasi}
                  katalog={katalog}
                  namaToko={namaToko}
                  batasAntre={batasAntre}
                  offset={offset}
                  nft={nft}
                  putus={gagalPoll >= 3}
                  onLagi={pesanLagi}
                />
              </motion.section>
            ) : (
              <motion.section key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {(
                  [
                    ['Pilih pesanan', katalog.filter(JENIS_DEMO)],
                    ['Cetak dokumenmu', katalog.filter((x) => !JENIS_DEMO(x))],
                  ] as const
                ).map(([judul, daftar]) =>
                  daftar.length === 0 ? null : (
                    <div key={judul}>
                      <h3 className="judul-bagian">{judul}</h3>
                      <div className="katalog">
                        {daftar.map((x) => (
                          <button key={x.jenis} className={`item-katalog ${pilih === x.jenis ? 'aktif' : ''}`} onClick={() => setPilih(x.jenis)}>
                            <span className="label">{x.label}</span>
                            <span className="resep">{x.langkah.map((l) => NAMA_LANGKAH[l]).join(' → ')}</span>
                            {JENIS_DEMO(x) ? (
                              <>
                                <span className="harga">{formatRupiah(x.harga)}</span>
                                <span className="muted kecil">maks. {x.batasKerja} dtk</span>
                              </>
                            ) : (
                              <>
                                <span className="harga">
                                  {formatRupiah(x.hargaDasar)} + {formatRupiah(x.hargaPerHalaman)}/hlm
                                </span>
                                <span className="muted kecil">
                                  maks. {x.batasDasar} + {x.batasPerHalaman} dtk/hlm
                                </span>
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ),
                )}
                {katalog.length === 0 &&
                  (galatMuat ? (
                    <div className="kartu galat-kartu">
                      <b>{galatMuat}</b>
                      <p className="muted kecil">Katalog belum bisa dimuat. Mencoba lagi otomatis tiap 5 detik.</p>
                      <button className="tombol" disabled={memuat} onClick={muat}>
                        {memuat ? 'Mencoba…' : 'Coba lagi'}
                      </button>
                    </div>
                  ) : (
                    <p className="muted">Memuat katalog…</p>
                  ))}

                {k && (
                  <div className="kartu form-teks">
                    {nyata && (
                      <>
                        <label htmlFor="dok">Dokumen (PDF, PNG, JPEG)</label>
                        <input id="dok" type="file" accept="application/pdf,image/png,image/jpeg" disabled={mengunggah || !!tahap} onChange={(e) => pilihFile(e.target.files?.[0])} />
                        <div className="kecil muted">
                          {mengunggah
                            ? 'Mengunggah & mengenkripsi…'
                            : dok
                              ? `Terunggah · perkiraan ${dok.halaman} halaman · file dihapus otomatis setelah order selesai`
                              : 'File disimpan terenkripsi; hanya kamu dan toko yang mengambil order bisa mengunduh'}
                        </div>
                        {dok && (
                          <>
                            <label htmlFor="hlm">Jumlah halaman yang dibayar</label>
                            <input
                              id="hlm"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={MAX_HALAMAN}
                              value={halaman}
                              onChange={(e) => setHalaman(Math.min(MAX_HALAMAN, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
                            />
                          </>
                        )}
                        <div className="kecil">
                          {titik ? (
                            <span className="muted">Lokasi ±110 m siap dikirim ke toko terdekat ✓</span>
                          ) : (
                            <button className="tautan inline" onClick={ambilLokasi}>
                              Bagikan lokasi kasar (supaya toko terdekat melihat ordermu)
                            </button>
                          )}
                          {infoLokasi && <div className="muted">{infoLokasi}</div>}
                        </div>
                      </>
                    )}
                    <label htmlFor="teks">{nyata ? 'Judul pesanan (tercetak di NFT)' : 'Teks di hasil cetakan'}</label>
                    <input
                      id="teks"
                      value={teks}
                      maxLength={MAX_TEXT}
                      placeholder={CONTOH[k.jenis] ?? 'Tulis teks custom'}
                      onChange={(e) => setTeks(e.target.value)}
                      autoComplete="off"
                    />
                    <div className={`kecil ${teksOk ? 'muted' : 'galat'}`}>
                      {teksOk ? `${teks.length}/${MAX_TEXT}` : 'Hanya huruf biasa, tanpa emoji dan tanpa < > & " \' \\'}
                    </div>
                    <div className="rincian kecil">
                      <span>
                        Harga {harga === null ? '…' : formatRupiah(harga)}
                        {nyata && hargaDok ? ` · ${halaman} hlm · maks. ${hargaDok.batasKerja} dtk` : ''}
                      </span>
                      <span>Biaya layanan {fee === null ? '…' : formatRupiah(fee)}</span>
                      <span className="muted">Gas Monad dibayar relayer</span>
                    </div>
                    {nyata && <span className="muted kecil">Saat siap, tunjukkan QR dari HP ini ke toko. Dana baru cair ke toko setelah QR dipindai.</span>}
                    <button
                      className="tombol utama besar"
                      disabled={!!tahap || !teks || !teksOk || fee === null || harga === null || (nyata && !dok) || mengunggah}
                      onClick={kurang ? () => setIsiSaldo(true) : bayar}
                    >
                      {kurang ? `Saldo kurang · isi saldo dulu` : labelTombol}
                    </button>
                  </div>
                )}
                {galat && <p className="galat">{galat}</p>}
              </motion.section>
            )}
          </AnimatePresence>
        </>
      )}
    </main>
  );
}

/** Isi saldo Rupiah → tIDRX lewat backend (simulasi API mint IDRX: VA / QRIS, lalu tombol "bayar" tiruan). */
function IsiSaldo({ akun, onMasuk, onTutup }: { akun: Akun; onMasuk: () => void; onTutup?: () => void }) {
  const [rp, setRp] = useState(NOMINAL[1]);
  const [metode, setMetode] = useState<'qris' | 'BRI' | 'MANDIRI'>('qris');
  const [tagihan, setTagihan] = useState<TopUp | null>(null);
  const [qr, setQr] = useState('');
  const [jalan, setJalan] = useState(false);
  const [galat, setGalat] = useState('');
  const hidup = useRef(true);
  useEffect(() => {
    hidup.current = true;
    return () => void (hidup.current = false);
  }, []);

  useEffect(() => {
    if (!tagihan?.qrString) return setQr('');
    QRCode.toString(tagihan.qrString, { type: 'svg', margin: 1, color: { dark: '#141516', light: '#f6f6f5' } }).then(setQr);
  }, [tagihan?.qrString]);

  async function buat() {
    setGalat('');
    setJalan(true);
    try {
      setTagihan(await buatTopup(akun.address, rp, metode === 'qris' ? 'qris' : 'va', metode === 'qris' ? undefined : metode));
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setJalan(false);
    }
  }

  async function bayar() {
    if (!tagihan) return;
    setGalat('');
    setJalan(true);
    try {
      let t = await bayarTopup(tagihan.id);
      setTagihan(t);
      for (let i = 0; i < 40 && hidup.current && t.userMintStatus !== 'MINTED' && t.userMintStatus !== 'FAILED'; i++) {
        await new Promise((r) => setTimeout(r, 750));
        t = await ambilTopup(tagihan.id);
        setTagihan(t);
      }
      if (t.userMintStatus === 'MINTED') onMasuk();
      else if (t.userMintStatus === 'FAILED') setGalat('Pembayaran diterima, tapi saldo gagal dicetak. Hubungi panitia');
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setJalan(false);
    }
  }

  return (
    <div className="kartu isi-saldo">
      <div className="isi-saldo-kepala">
        <b>Isi saldo Rupiah</b>
        {onTutup && (
          <button className="tautan inline" onClick={onTutup}>
            tutup
          </button>
        )}
      </div>
      {!tagihan ? (
        <>
          <div className="pilih-nominal">
            {NOMINAL.map((n) => (
              <button key={n} className={rp === n ? 'aktif' : ''} onClick={() => setRp(n)}>
                {formatRupiah(BigInt(n * 100))}
              </button>
            ))}
          </div>
          <div className="pilih-nominal metode">
            {(
              [
                ['qris', 'QRIS'],
                ['BRI', 'VA BRI'],
                ['MANDIRI', 'VA Mandiri'],
              ] as const
            ).map(([m, l]) => (
              <button key={m} className={metode === m ? 'aktif' : ''} onClick={() => setMetode(m)}>
                {l}
              </button>
            ))}
          </div>
          <button className="tombol utama besar" disabled={jalan} onClick={buat}>
            {jalan ? 'Membuat tagihan…' : `Lanjut bayar ${formatRupiah(BigInt(rp * 100))}`}
          </button>
        </>
      ) : (
        <div className="tagihan">
          {tagihan.paymentMethod === 'qris' ? (
            <div className="qr-bayar" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="va">
              <span className="muted kecil">Virtual account {tagihan.channelId}</span>
              <b className="va-no">{tagihan.virtualAccountNo}</b>
              <span className="muted kecil">{tagihan.virtualAccountName}</span>
            </div>
          )}
          <div className="rincian kecil">
            <span>Saldo masuk {formatRupiah(BigInt(tagihan.baseAmount * 100))}</span>
            {tagihan.fees.map((f) => (
              <span key={f.name}>
                {f.name} {formatRupiah(BigInt(Math.round(f.amount * 100)))}
              </span>
            ))}
            <b>Total bayar {formatRupiah(BigInt(Math.round(tagihan.amount * 100)))}</b>
          </div>
          {tagihan.userMintStatus === 'MINTED' ? (
            <p className="ok-teks">Saldo masuk!</p>
          ) : tagihan.paymentStatus === 'EXPIRED' ? (
            <button className="tombol besar" onClick={() => setTagihan(null)}>
              Tagihan kedaluwarsa · buat baru
            </button>
          ) : (
            <button className="tombol utama besar" disabled={jalan} onClick={bayar}>
              {tagihan.paymentStatus === 'PAID' ? 'Mencetak saldo…' : jalan ? 'Memproses…' : 'Bayar sekarang (simulasi)'}
            </button>
          )}
          <p className="muted kecil">Mode simulasi testnet: tidak ada uang sungguhan. Saldo berupa tIDRX (Rupiah digital).</p>
        </div>
      )}
      {galat && <p className="galat kecil">{galat}</p>}
    </div>
  );
}

function StatusPesanan(p: {
  id: bigint;
  akun: Akun;
  order: Order | null;
  feeBps: number;
  batasJemput: number;
  infoLokasi: string;
  katalog: Katalog[];
  namaToko: Record<string, string>;
  batasAntre: number;
  offset: number;
  nft: { name: string; image: string } | null;
  putus: boolean;
  onLagi: () => void;
}) {
  const now = Math.floor(useJamChain(p.offset, 500));
  const o = p.order;
  const [qr, setQr] = useState('');
  const [komplainJalan, setKomplainJalan] = useState(false);
  const [galat, setGalat] = useState('');
  const pakaiKode = !!o && BigInt(o.kodeHash) !== 0n;
  const rahasia = pakaiKode && o ? bacaRahasia(o.kodeHash) : null;
  const qrSiap = o?.status === 'Siap' && rahasia ? isiQr(o.id, rahasia) : '';
  useEffect(() => {
    if (!qrSiap) return setQr('');
    QRCode.toString(qrSiap, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#141516', light: '#f6f6f5' } }).then(setQr);
  }, [qrSiap]);

  /** Komplain dibayar sendiri (butuh MON gas): minta saldo awal MON dari faucet backend bila belum cukup. */
  async function komplain() {
    if (!o) return;
    setGalat('');
    setKomplainJalan(true);
    try {
      const [mon, perlu] = await Promise.all([pub.getBalance({ address: p.akun.address }), biayaMaks('komplain')]);
      if (mon < perlu) {
        const { hash } = await mintaMon(p.akun.address);
        await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
      }
      await kirim(p.akun, 'komplain', [o.id]);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setKomplainJalan(false);
    }
  }
  const label = o ? (p.katalog.find((k) => k.jenis === o.jenis)?.label ?? `Order #${p.id}`) : `Order #${p.id}`;
  const toko = o ? (p.namaToko[o.toko.toLowerCase()] ?? pendek(o.toko)) : '';

  if (!o)
    return (
      <div className="kartu">
        Memuat order #{String(p.id)}…
        {p.putus && <p className="galat kecil">Koneksi ke Monad terputus, mencoba lagi…</p>}
      </div>
    );

  const sisaAntre = Math.max(0, p.batasAntre - (now - o.dibuatPada));
  const kerja = Math.max(0, now - o.diclaimPada);
  const payout = o.status === 'Claimed' ? hitungPayout(o.harga, o.batasKerja, kerja) : 0n;
  const selesai = o.status === 'Finished' || o.status === 'Diputuskan';
  // Kotor = yang keluar dari escrow ke toko + platform; kembalian pelanggan = harga − kotor (utuh, tidak dipotong).
  const payoutAkhir = o.status === 'Finished' || o.status === 'Siap' ? hitungPayout(o.harga, o.batasKerja, o.kerja) : 0n;
  const sisaJemput = Math.max(0, o.siapPada + p.batasJemput - now);
  const feePlatform = (payoutAkhir * BigInt(p.feeBps)) / 10_000n;

  return (
    <div className="status">
      {p.putus && <div className="banner-galat kecil">Koneksi ke Monad terputus, mencoba lagi… (ordermu aman di escrow)</div>}
      <div className="kartu">
        <div className="muted kecil">
          #{String(p.id)} · {label}
        </div>
        <div className="teks-order">“{o.teks}”</div>
        <ol className="timeline">
          <li className="ok">Dibayar {formatRupiah(o.harga)}, ditahan escrow</li>
          {o.status === 'Open' && sisaAntre > 0 && (
            <li className="jalan">
              Menunggu toko… {sisaAntre} dtk
              <div className="bar">
                <div style={{ width: `${(sisaAntre / p.batasAntre) * 100}%` }} />
              </div>
            </li>
          )}
          {o.status === 'Open' && sisaAntre <= 0 && <li className="refund">Tidak ada toko yang sempat. Dana {formatRupiah(o.harga)} sedang dikembalikan…</li>}
          {o.status === 'Claimed' && kerja >= o.batasKerja && <li className="refund">Toko kehabisan waktu. Dana {formatRupiah(o.harga)} sedang dikembalikan…</li>}
          {(o.status === 'Claimed' || o.status === 'Siap' || selesai) && <li className="ok">Diambil {toko}</li>}
          {o.status === 'Claimed' && kerja < o.batasKerja && (
            <li className="jalan">
              Dikerjakan: {o.langkah.map((l, i) => (i < o.langkahSelesai ? '✓ ' : i === o.langkahSelesai ? '▸ ' : '') + NAMA_LANGKAH[l]).join(' · ')}
              <div className="muted kecil">
                Bayaran toko kalau selesai sekarang {formatRupiah(payoutBersih(payout, p.feeBps))} · kembalianmu {formatRupiah(o.harga - payout)}
              </div>
            </li>
          )}
          {o.status === 'Siap' && (
            <li className="jalan">
              Siap diambil di loket {toko} · kembalianmu {formatRupiah(o.harga - payoutAkhir)}
              {pakaiKode && <div className="muted kecil">Tunjukkan QR di bawah ke toko. Tanpa QR, order ditutup otomatis dalam {Math.ceil(sisaJemput / 60)} menit.</div>}
            </li>
          )}
          {o.status === 'Sengketa' && (
            <li className="refund">
              Komplain diterima, menunggu keputusan panitia
              <div className="muted kecil">Tanpa keputusan dalam {Math.round(BATAS_SENGKETA / 3600)} jam, dana dibagi otomatis 50/50 dengan toko.</div>
            </li>
          )}
          {o.status === 'Diputuskan' && <li className="ok">Sengketa selesai (keputusan panitia atau dibagi otomatis). Bagianmu sudah dikembalikan ke saldo</li>}
          {o.status === 'Expired' && <li className="refund">Tidak keburu. Dana {formatRupiah(o.harga)} dikembalikan penuh.</li>}
        </ol>
        {o.status === 'Open' && p.infoLokasi && <div className="muted kecil">{p.infoLokasi}</div>}
      </div>

      {o.status === 'Siap' && pakaiKode && (
        <div className="kartu">
          {qr ? (
            <div className="qr-bayar" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <p className="galat kecil">Kode QR tidak ada di perangkat ini. Order akan ditutup otomatis setelah batas jemput, dana tetap aman.</p>
          )}
          {sisaJemput > 0 && (
            <button className="tautan" disabled={komplainJalan} onClick={komplain}>
              {komplainJalan ? 'Mengirim komplain…' : 'Hasil tidak sesuai? Komplain (dana ditahan sampai panitia memutuskan)'}
            </button>
          )}
          {galat && <p className="galat kecil">{galat}</p>}
        </div>
      )}

      {o.status === 'Finished' && (
        <motion.div className="kartu nft" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {p.nft ? <img src={p.nft.image} alt={p.nft.name} /> : <div className="muted">Memuat NFT…</div>}
          <div className="angka">
            <div>
              <span className="muted kecil">Selesai</span>
              <b>{o.kerja} dtk</b>
            </div>
            <div>
              <span className="muted kecil">Toko dibayar</span>
              <b>{formatRupiah(payoutAkhir - feePlatform)}</b>
            </div>
            <div>
              <span className="muted kecil">Kembalianmu</span>
              <b>{formatRupiah(o.harga - payoutAkhir)}</b>
            </div>
          </div>
          <div className="muted kecil">
            NFT hasil cetakan sudah ada di akunmu. Fee platform {p.feeBps / 100}% ({formatRupiah(feePlatform)}) dari bayaran toko, bukan dari kembalianmu.
          </div>
        </motion.div>
      )}

      {(selesai || o.status === 'Expired') && (
        <button className="tombol utama besar" onClick={p.onLagi}>
          Pesan lagi
        </button>
      )}
    </div>
  );
}
