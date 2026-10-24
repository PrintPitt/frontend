// /pesan — customer page on the phone (BLZ-09, BL-D22-08): account → Rupiah balance (tIDRX) → top up if needed →
// pick an order → sign Pesanan + permit (no MON, gas paid by the relayer) → live status → NFT / refund.
// Contract v2.1: kinds 1–4 = demo mode (1 page, no document, kodeHash 0, finishes at the last step).
// Kind 5+ = real document printing: upload file → price from `hargaUntuk` → QR secret on the phone → order location → QR when Siap.
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
  bacaKode,
  klaimKodeJuri,
  pastikanMon,
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
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'); // SPK-07: onboarding time + fallback reason
// Prefill from landing / QR: ?jenis=3&teks=Juri (kinds missing from the catalog are ignored at render)
const PREFILL_JENIS = Number(Q.get('jenis')) || null;
const PREFILL_TEKS = (Q.get('teks') ?? '').slice(0, MAX_TEXT);
const KUNCI_ORDER = 'pp.order.aktif';
/** Kinds 1–4 = mini-game orders (worked in the /main game). Kind 5+ = real document printing (file upload + QR hand-over). */
const JENIS_DEMO = (k: Katalog) => k.jenis <= 4;
/** Order text from the file name: only characters that pass `teksValid`, max. 40. */
const teksDariFile = (nama: string) =>
  nama
    .replace(/\.[^.]+$/, '')
    .replace(/[^\x20-\x7e]|[<>&"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT) || 'Document';
const CONTOH: Record<number, string> = {
  1: 'Budi ID card both sides 10x',
  2: 'Boarding pass JOG-CGK 05.40',
  3: 'BSc diploma Informatics',
  4: 'Bu Sri diner menu',
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
  const [topupMode, setTopupMode] = useState('simulasi');
  const [feeBps, setFeeBps] = useState(300);
  const [katalog, setKatalog] = useState<Katalog[]>([]);
  const [namaToko, setNamaToko] = useState<Record<string, string>>({});
  const [batasAntre, setBatasAntre] = useState(45);
  // real document order (kind 5+)
  const [dok, setDok] = useState<InfoDokumen | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [halaman, setHalaman] = useState(1);
  const [hargaDok, setHargaDok] = useState<{ harga: bigint; batasKerja: number } | null>(null);
  const [titik, setTitik] = useState<Titik | null>(null);
  const [infoLokasi, setInfoLokasi] = useState('');
  const [offset, setOffset] = useState(0);
  const [pilih, setPilih] = useState<number | null>(PREFILL_JENIS);
  const [teks, setTeks] = useState(PREFILL_TEKS);
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

  // Initial data (catalog, shops, relayer fee); on failure show a message + auto-retry every 5 s.
  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      // fee is read from the contract (source of truth); the backend only does top-up & relay, so the catalog still shows when the backend is down
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
      ambilConfig()
        .then((c) => setTopupMode(c.topupMode))
        .catch(() => setGalat('Cannot reach the top-up/relayer server. Gasless orders may fail.'));
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

  // Poll one order until it is final.
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
      if (DEBUG) console.warn('sign-in failed', e);
      setGalatAkun('Passkey cancelled. Try again, or use a temporary account.');
    } finally {
      setMasukJalan(false);
    }
  }

  const k = katalog.find((x) => x.jenis === pilih);
  const nyata = !!k && !JENIS_DEMO(k);
  // Document order price is read from the contract (`hargaUntuk`) for the number of paid pages.
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
    setInfoLokasi('Reading location…');
    try {
      setTitik(await lokasiPerangkat());
      setInfoLokasi('');
    } catch (e) {
      setInfoLokasi(pesanGalat(e));
    }
  }

  async function bayar() {
    if (!akun || !k || fee === null || harga === null) return;
    if (!teksValid(teks)) return setGalat('Text: 1–40 plain characters (no emoji, no < > & " \' \\)');
    if (nyata && !dok) return setGalat('Upload a document first');
    setGalat('');
    try {
      const s = await segarkanSaldo(akun);
      if (s < harga + fee) {
        setIsiSaldo(true);
        throw new Error(`Balance too low: need ${formatRupiah(harga + fee)}, have ${formatRupiah(s)}`);
      }
      setTahap('tanda');
      // Document order: the QR secret is stored on the phone BEFORE sending; only kodeHash goes on-chain.
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
      // Rough order location (±110 m) so it shows in the feed of shops in range; only while the order is still Open.
      if (nyata && titik)
        kirimLokasiOrder(akun, id, titik)
          .then(() => setInfoLokasi('Location sent: nearby shops can see your order'))
          .catch((e) => setInfoLokasi(`Could not send location: ${pesanGalat(e)}`));
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
  const labelTombol = tahap === 'tanda' ? 'Signing…' : tahap === 'kirim' ? 'Sending to Monad…' : total !== null ? `Pay ${formatRupiah(total)}` : 'Pay';

  return (
    <main className="pesan">
      <header className="pesan-head">
        <div>
          <div className="brand">{NAMA}</div>
          <div className="muted kecil">Order from your phone, shops race to claim it</div>
        </div>
        {akun && (
          <button className="chip chip-saldo" title={akun.address} onClick={() => setIsiSaldo((x) => !x)}>
            {saldo === null ? '…' : formatRupiah(saldo)} <span className="plus">＋</span>
          </button>
        )}
      </header>

      {!akun ? (
        <section className="kartu mulai">
          <h2>Order a quick print</h2>
          <p className="muted">
            Pay in digital Rupiah into escrow, no gas fees. The faster the shop finishes, the more it earns. If it's slow, the rest is refunded to you, plus an NFT of your print.
          </p>
          <button className="tombol utama besar" disabled={masukJalan} onClick={() => pindah('/masuk?ke=/pesan', false)}>
            Sign in / sign up
          </button>
          <button className="tautan" disabled={masukJalan} onClick={() => mulai(true)}>
            Continue as guest
          </button>
          {galatAkun && <p className="galat">{galatAkun}</p>}
          {galatAkun && punyaPasskey() && (
            <button className="tautan" onClick={() => (lupakanPasskey(), setGalatAkun(''))}>
              Create a new passkey
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="akun-baris muted kecil">
            <span className={`badge ${akun.jenis}`}>{akun.jenis === 'privy' ? (akun.label ?? 'Privy') : akun.jenis === 'mera' ? 'Passkey' : akun.jenis === 'dev' ? 'Dev' : 'Guest'}</span>
            <span>{pendek(akun.address)}</span>
            <span>· gasless</span>
            {DEBUG && (
              <span>
                · {(durasiMasuk / 1000).toFixed(1)} s{akun.alasanFallback ? ` · fallback: ${akun.alasanFallback}` : ''}
              </span>
            )}
          </section>

          <AnimatePresence>
            {(isiSaldo || saldo === 0n) && orderId === null && (
              <motion.section key="isi" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <IsiSaldo
                  akun={akun}
                  voucher={topupMode === 'voucher'}
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
                    ['Print your document', katalog.filter((x) => !JENIS_DEMO(x))],
                    ['Quick order (stage demo)', katalog.filter(JENIS_DEMO)],
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
                                <span className="muted kecil">max. {x.batasKerja} s</span>
                              </>
                            ) : (
                              <>
                                <span className="harga">
                                  {formatRupiah(x.hargaDasar)} + {formatRupiah(x.hargaPerHalaman)}/page
                                </span>
                                <span className="muted kecil">
                                  max. {x.batasDasar} + {x.batasPerHalaman} s/page
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
                      <p className="muted kecil">Could not load the catalog. Retrying automatically every 5 seconds.</p>
                      <button className="tombol" disabled={memuat} onClick={muat}>
                        {memuat ? 'Retrying…' : 'Try again'}
                      </button>
                    </div>
                  ) : (
                    <p className="muted">Loading catalog…</p>
                  ))}

                {k && (
                  <div className="kartu form-teks">
                    {nyata && (
                      <>
                        <label htmlFor="dok">Document (PDF, PNG, JPEG)</label>
                        <input id="dok" type="file" accept="application/pdf,image/png,image/jpeg" disabled={mengunggah || !!tahap} onChange={(e) => pilihFile(e.target.files?.[0])} />
                        <div className="kecil muted">
                          {mengunggah
                            ? 'Uploading & encrypting…'
                            : dok
                              ? `Uploaded · about ${dok.halaman} pages · file is deleted automatically after the order is done`
                              : 'File is stored encrypted; only you and the shop that claims the order can download it'}
                        </div>
                        {dok && (
                          <>
                            <label htmlFor="hlm">Pages to pay for</label>
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
                            <span className="muted">Location (±110 m) ready to send to nearby shops ✓</span>
                          ) : (
                            <button className="tautan inline" onClick={ambilLokasi}>
                              Share rough location (so nearby shops can see your order)
                            </button>
                          )}
                          {infoLokasi && <div className="muted">{infoLokasi}</div>}
                        </div>
                      </>
                    )}
                    <label htmlFor="teks">{nyata ? 'Order title (printed on the NFT)' : 'Text on the print'}</label>
                    <input
                      id="teks"
                      value={teks}
                      maxLength={MAX_TEXT}
                      placeholder={CONTOH[k.jenis] ?? 'Write custom text'}
                      onChange={(e) => setTeks(e.target.value)}
                      autoComplete="off"
                    />
                    <div className={`kecil ${teksOk ? 'muted' : 'galat'}`}>
                      {teksOk ? `${teks.length}/${MAX_TEXT}` : 'Plain characters only, no emoji, no < > & " \' \\'}
                    </div>
                    <div className="rincian kecil">
                      <span>
                        Price {harga === null ? '…' : formatRupiah(harga)}
                        {nyata && hargaDok ? ` · ${halaman} pages · max. ${hargaDok.batasKerja} s` : ''}
                      </span>
                      <span>Service fee {fee === null ? '…' : formatRupiah(fee)}</span>
                      <span className="muted">Monad gas paid by the relayer</span>
                    </div>
                    {nyata && <span className="muted kecil">When it's ready, show the QR on this phone to the shop. The shop only gets paid after scanning it.</span>}
                    <button
                      className="tombol utama besar"
                      disabled={!!tahap || !teks || !teksOk || fee === null || harga === null || (nyata && !dok) || mengunggah}
                      onClick={kurang ? () => setIsiSaldo(true) : bayar}
                    >
                      {kurang ? `Balance too low · top up first` : labelTombol}
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

/** Top up Rupiah → tIDRX via the backend (simulated IDRX mint API: VA / QRIS, then a mock "pay" button). */
function IsiSaldo(p: { akun: Akun; voucher: boolean; onMasuk: () => void; onTutup?: () => void }) {
  return p.voucher ? <KodeJuri {...p} /> : <TopupSimulasi {...p} />;
}

/** Mainnet (voucher mode): one judge code → MON for gas (faucet) + IDRX balance (voucher). No amount, no checkout. */
function KodeJuri({ akun, onMasuk, onTutup }: { akun: Akun; onMasuk: () => void; onTutup?: () => void }) {
  const [kode, setKode] = useState(bacaKode);
  const [jalan, setJalan] = useState(false);
  const [galat, setGalat] = useState('');
  const [masuk, setMasuk] = useState<bigint | null>(null);

  async function klaim() {
    setGalat('');
    setJalan(true);
    try {
      const t = await klaimKodeJuri(akun, kode.trim());
      setMasuk(BigInt(Math.round(t.baseAmount * 100)));
      onMasuk();
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setJalan(false);
    }
  }

  return (
    <div className="kartu isi-saldo">
      <div className="isi-saldo-kepala">
        <b>Enter judge code</b>
        {onTutup && (
          <button className="tautan inline" onClick={onTutup}>
            tutup
          </button>
        )}
      </div>
      <div className="form-teks">
        <input value={kode} placeholder="Code from the organizers" onChange={(e) => setKode(e.target.value)} autoComplete="off" autoCapitalize="characters" />
      </div>
      <button className="tombol utama besar" disabled={jalan || !kode.trim()} onClick={klaim}>
        {jalan ? 'Sending balance…' : 'Claim balance'}
      </button>
      {masuk !== null && <p className="ok-teks">{formatRupiah(masuk)} added to your balance!</p>}
      <p className="muted kecil">Demo balance from the organizers: you pay nothing. One code per account.</p>
      {galat && <p className="galat kecil">{galat}</p>}
    </div>
  );
}

/** Testnet (simulation mode): mock Rupiah top-up via VA / QRIS, then a simulated "pay" button mints tIDRX. */
function TopupSimulasi({ akun, onMasuk, onTutup }: { akun: Akun; onMasuk: () => void; onTutup?: () => void }) {
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
      else if (t.userMintStatus === 'FAILED') setGalat('Payment received, but the balance could not be minted. Contact the organizers');
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setJalan(false);
    }
  }

  return (
    <div className="kartu isi-saldo">
      <div className="isi-saldo-kepala">
        <b>Top up Rupiah</b>
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
            {jalan ? 'Creating invoice…' : `Continue to pay ${formatRupiah(BigInt(rp * 100))}`}
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
            <span>Balance added {formatRupiah(BigInt(tagihan.baseAmount * 100))}</span>
            {tagihan.fees.map((f) => (
              <span key={f.name}>
                {f.name} {formatRupiah(BigInt(Math.round(f.amount * 100)))}
              </span>
            ))}
            <b>Total to pay {formatRupiah(BigInt(Math.round(tagihan.amount * 100)))}</b>
          </div>
          {tagihan.userMintStatus === 'MINTED' ? (
            <p className="ok-teks">Balance added!</p>
          ) : tagihan.paymentStatus === 'EXPIRED' ? (
            <button className="tombol besar" onClick={() => setTagihan(null)}>
              Invoice expired · create a new one
            </button>
          ) : (
            <button className="tombol utama besar" disabled={jalan} onClick={bayar}>
              {tagihan.paymentStatus === 'PAID' ? 'Minting balance…' : jalan ? 'Processing…' : 'Pay now (simulated)'}
            </button>
          )}
          <p className="muted kecil">Testnet simulation mode: no real money. Balance is tIDRX (digital Rupiah).</p>
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

  /** The customer pays for a complaint (needs MON gas): request starter MON from the backend faucet if short. */
  async function komplain() {
    if (!o) return;
    setGalat('');
    setKomplainJalan(true);
    try {
      await pastikanMon(p.akun, await biayaMaks('komplain'));
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
        Loading order #{String(p.id)}…
        {p.putus && <p className="galat kecil">Lost connection to Monad, retrying…</p>}
      </div>
    );

  const sisaAntre = Math.max(0, p.batasAntre - (now - o.dibuatPada));
  const kerja = Math.max(0, now - o.diclaimPada);
  const payout = o.status === 'Claimed' ? hitungPayout(o.harga, o.batasKerja, kerja) : 0n;
  const selesai = o.status === 'Finished' || o.status === 'Diputuskan';
  // Gross = what leaves escrow to shop + platform; customer refund = price − gross (in full, no deduction).
  const payoutAkhir = o.status === 'Finished' || o.status === 'Siap' ? hitungPayout(o.harga, o.batasKerja, o.kerja) : 0n;
  const sisaJemput = Math.max(0, o.siapPada + p.batasJemput - now);
  const feePlatform = (payoutAkhir * BigInt(p.feeBps)) / 10_000n;

  // Ride-hailing style tracker: one big status + 4 stages (find shop → in progress → ready for pickup → done)
  const tahapLacak = o.status === 'Open' ? 0 : o.status === 'Claimed' ? 1 : o.status === 'Siap' || o.status === 'Sengketa' ? 2 : 3;
  const judulLacak =
    o.status === 'Open'
      ? sisaAntre > 0
        ? 'Finding a nearby print shop…'
        : 'No shop picked it up in time'
      : o.status === 'Claimed'
        ? kerja >= o.batasKerja
          ? 'The shop ran out of time'
          : `${toko} is working on it`
        : o.status === 'Siap'
          ? `Ready for pickup at ${toko}`
          : o.status === 'Sengketa'
            ? 'Complaint under review'
            : o.status === 'Expired'
              ? 'Cancelled, funds refunded'
              : 'Done!';
  const subLacak =
    o.status === 'Open'
      ? `Shops within 1–1.5 km are racing to claim your order · ${sisaAntre} s`
      : o.status === 'Claimed'
        ? `Step ${Math.min(o.langkahSelesai + 1, o.langkah.length)}/${o.langkah.length}: ${NAMA_LANGKAH[o.langkah[Math.min(o.langkahSelesai, o.langkah.length - 1)]]} · your refund if it finishes now ${formatRupiah(o.harga - payout)}`
        : o.status === 'Siap'
          ? pakaiKode
            ? 'Show the QR below to the shop cashier'
            : 'Pick up your print'
          : o.status === 'Expired'
            ? `${formatRupiah(o.harga)} is back in your balance`
            : selesai
              ? `Done in ${o.kerja} s · receipt NFT is in your account`
              : '';

  return (
    <div className="status">
      {p.putus && <div className="banner-galat kecil">Lost connection to Monad, retrying… (your order is safe in escrow)</div>}
      <div className={`kartu lacak lacak-${tahapLacak} ${o.status === 'Expired' ? 'lacak-batal' : ''}`}>
        <div className="lacak-atas">
          <div className={`lacak-ikon ${o.status === 'Open' && sisaAntre > 0 ? 'mencari' : ''}`}>
            {o.status === 'Open' ? '📡' : o.status === 'Claimed' ? '🖨️' : o.status === 'Siap' ? '📦' : o.status === 'Expired' ? '↺' : '✅'}
          </div>
          <div>
            <b className="lacak-judul">{judulLacak}</b>
            <div className="lacak-sub">{subLacak}</div>
          </div>
        </div>
        <ol className="lacak-tahap">
          {['Find shop', 'In progress', 'Ready for pickup', 'Done'].map((t, i) => (
            <li key={t} className={i < tahapLacak ? 'lewat' : i === tahapLacak ? 'kini' : ''}>
              <span className="lacak-titik" />
              {t}
            </li>
          ))}
        </ol>
        {o.status === 'Claimed' && (
          <div className="bar tebal">
            <div style={{ width: `${Math.max(0, 1 - kerja / o.batasKerja) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="kartu">
        <div className="muted kecil">
          #{String(p.id)} · {label}
        </div>
        <div className="teks-order">“{o.teks}”</div>
        <ol className="timeline">
          <li className="ok">Paid {formatRupiah(o.harga)}, held in escrow</li>
          {o.status === 'Open' && sisaAntre > 0 && (
            <li className="jalan">
              Waiting for a shop… {sisaAntre} s
              <div className="bar">
                <div style={{ width: `${(sisaAntre / p.batasAntre) * 100}%` }} />
              </div>
            </li>
          )}
          {o.status === 'Open' && sisaAntre <= 0 && <li className="refund">No shop picked it up in time. Refunding {formatRupiah(o.harga)}…</li>}
          {o.status === 'Claimed' && kerja >= o.batasKerja && <li className="refund">The shop ran out of time. Refunding {formatRupiah(o.harga)}…</li>}
          {(o.status === 'Claimed' || o.status === 'Siap' || selesai) && <li className="ok">Claimed by {toko}</li>}
          {o.status === 'Claimed' && kerja < o.batasKerja && (
            <li className="jalan">
              In progress: {o.langkah.map((l, i) => (i < o.langkahSelesai ? '✓ ' : i === o.langkahSelesai ? '▸ ' : '') + NAMA_LANGKAH[l]).join(' · ')}
              <div className="muted kecil">
                Shop payout if it finishes now {formatRupiah(payoutBersih(payout, p.feeBps))} · your refund {formatRupiah(o.harga - payout)}
              </div>
            </li>
          )}
          {o.status === 'Siap' && (
            <li className="jalan">
              Ready for pickup at the {toko} counter · your refund {formatRupiah(o.harga - payoutAkhir)}
              {pakaiKode && <div className="muted kecil">Show the QR below to the shop. Without the QR, the order closes automatically in {Math.ceil(sisaJemput / 60)} min.</div>}
            </li>
          )}
          {o.status === 'Sengketa' && (
            <li className="refund">
              Complaint received, waiting for the organizers' decision
              <div className="muted kecil">If there is no decision within {Math.round(BATAS_SENGKETA / 3600)} h, funds are split 50/50 with the shop automatically.</div>
            </li>
          )}
          {o.status === 'Diputuskan' && <li className="ok">Dispute resolved (organizers' decision or automatic split). Your share is back in your balance</li>}
          {o.status === 'Expired' && <li className="refund">Not in time. {formatRupiah(o.harga)} refunded in full.</li>}
        </ol>
        {o.status === 'Open' && p.infoLokasi && <div className="muted kecil">{p.infoLokasi}</div>}
      </div>

      {o.status === 'Siap' && pakaiKode && (
        <div className="kartu">
          {qr ? (
            <div className="qr-bayar" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <p className="galat kecil">The QR code is not on this device. The order will close automatically after the pickup deadline; your funds are safe.</p>
          )}
          {sisaJemput > 0 && (
            <button className="tautan" disabled={komplainJalan} onClick={komplain}>
              {komplainJalan ? 'Sending complaint…' : 'Wrong result? File a complaint (funds held until the organizers decide)'}
            </button>
          )}
          {galat && <p className="galat kecil">{galat}</p>}
        </div>
      )}

      {o.status === 'Finished' && (
        <motion.div className="kartu nft" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {p.nft ? <img src={p.nft.image} alt={p.nft.name} /> : <div className="muted">Loading NFT…</div>}
          <div className="angka">
            <div>
              <span className="muted kecil">Done in</span>
              <b>{o.kerja} s</b>
            </div>
            <div>
              <span className="muted kecil">Shop paid</span>
              <b>{formatRupiah(payoutAkhir - feePlatform)}</b>
            </div>
            <div>
              <span className="muted kecil">Your refund</span>
              <b>{formatRupiah(o.harga - payoutAkhir)}</b>
            </div>
          </div>
          <div className="muted kecil">
            Your print NFT is in your account. Platform fee {p.feeBps / 100}% ({formatRupiah(feePlatform)}) comes from the shop payout, not your refund.
          </div>
        </motion.div>
      )}

      {(selesai || o.status === 'Expired') && (
        <button className="tombol utama besar" onClick={p.onLagi}>
          Order again
        </button>
      )}
    </div>
  );
}
