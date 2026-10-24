// /pesan — halaman penonton di HP (BLZ-09): akun → saldo awal → pilih order → bayar → status live → NFT / refund.
// Read dibuat seminimal mungkin (SPK-05): katalog sekali, lalu polling satu order saja.
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hitungPayout, MAX_TEXT, teksValid } from '../../../shared/src/index.ts';
import { akunBurner, lupakanPasskey, masuk, passkeyMungkin, punyaPasskey, type Akun } from '../lib/akun';
import { kontrak, offsetChain, pub } from '../lib/chain';
import { mon, NAMA_LANGKAH, pendek } from '../lib/format';
import { NAMA } from '../lib/merek';
import { bacaKatalog, bacaNft, bacaOrder, bacaToko, type Katalog, type Order } from '../lib/katalog';
import { useJamChain } from '../lib/live';
import { biayaMaks, kirim, pesanError } from '../lib/tx';

const POLL_MS = Number(import.meta.env.VITE_POLL_MS || 1500);
const DEBUG = new URLSearchParams(location.search).has('debug'); // SPK-07: waktu onboarding + alasan fallback
const KUNCI_ORDER = 'fk.order.aktif';
const CONTOH: Record<number, string> = {
  1: 'KTP Budi bolak-balik 10x',
  2: 'Boarding JOG-CGK 05.40',
  3: 'Ijazah S1 Teknik Informatika',
  4: 'Menu Warung Bu Sri',
};

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

type Dana = { s: 'idle' | 'minta' | 'ok' | 'gagal'; pesan?: string };

export default function Pesan() {
  const [akun, setAkun] = useState<Akun | null>(null);
  const [masukJalan, setMasukJalan] = useState(false);
  const [durasiMasuk, setDurasiMasuk] = useState(0);
  const [galatAkun, setGalatAkun] = useState('');
  const [saldo, setSaldo] = useState<bigint | null>(null);
  const [dana, setDana] = useState<Dana>({ s: 'idle' });
  const [katalog, setKatalog] = useState<Katalog[]>([]);
  const [namaToko, setNamaToko] = useState<Record<string, string>>({});
  const [batasAntre, setBatasAntre] = useState(45);
  const [offset, setOffset] = useState(0);
  const [pilih, setPilih] = useState<number | null>(null);
  const [teks, setTeks] = useState('');
  const [kirimJalan, setKirimJalan] = useState(false);
  const [galat, setGalat] = useState('');
  const [orderId, setOrderId] = useState<bigint | null>(() => {
    const v = baca(KUNCI_ORDER);
    return v ? BigInt(v) : null;
  });
  const [order, setOrder] = useState<Order | null>(null);
  const [nft, setNft] = useState<{ name: string; image: string } | null>(null);
  const [galatMuat, setGalatMuat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [gagalPoll, setGagalPoll] = useState(0);
  const [ulangDana, setUlangDana] = useState(0);
  const danaDiminta = useRef(false);

  // Data awal; kalau RPC gagal tampilkan pesan + tombol, dan coba ulang otomatis tiap 5 dtk.
  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [k, t, b, off] = await Promise.all([
        bacaKatalog(),
        bacaToko(),
        pub.readContract({ ...kontrak, functionName: 'batasAntre' }),
        offsetChain(),
      ]);
      setKatalog(k);
      setNamaToko(Object.fromEntries(t.map((x) => [x.alamat.toLowerCase(), x.nama])));
      setBatasAntre(b);
      setOffset(off);
      setGalatMuat('');
    } catch (e) {
      setGalatMuat(pesanError(e));
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
    const s = await pub.getBalance({ address: a.address });
    setSaldo(s);
    return s;
  }, []);

  // Saldo awal: minta ke faucet sekali kalau saldo belum cukup untuk order termahal.
  useEffect(() => {
    if (!akun || katalog.length === 0 || danaDiminta.current) return;
    danaDiminta.current = true;
    (async () => {
      try {
        const s = await segarkanSaldo(akun);
        const termahal = katalog.reduce((m, k) => (k.harga > m ? k.harga : m), 0n);
        if (s >= (await biayaMaks('createOrder', termahal))) return setDana({ s: 'ok' });
        setDana({ s: 'minta' });
        const r = await fetch('/api/faucet', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address: akun.address }),
        });
        const j = await r.json().catch(() => ({}));
        setDana(r.ok ? { s: 'ok' } : { s: 'gagal', pesan: j.error ?? `Faucet error ${r.status}` });
        await segarkanSaldo(akun);
      } catch (e) {
        danaDiminta.current = false; // boleh dicoba lagi
        setDana({ s: 'gagal', pesan: e instanceof TypeError ? 'Faucet tidak bisa dihubungi' : pesanError(e) });
      }
    })();
  }, [akun, katalog, segarkanSaldo, ulangDana]);

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
        if (o.status === 'Finished') {
          bacaNft(orderId).then(setNft).catch(() => {});
          if (akun) segarkanSaldo(akun).catch(() => {});
          return;
        }
        if (o.status === 'Expired') {
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
      setAkun(paksaBurner ? akunBurner() : await masuk());
      setDurasiMasuk(performance.now() - t0);
    } catch (e) {
      if (DEBUG) console.warn('masuk gagal', e);
      setGalatAkun('Passkey dibatalkan. Coba lagi, atau pakai akun sementara.');
    } finally {
      setMasukJalan(false);
    }
  }

  async function bayar() {
    if (!akun || pilih === null) return;
    const k = katalog.find((x) => x.jenis === pilih);
    if (!k) return;
    if (!teksValid(teks)) return setGalat('Teks 1–40 huruf biasa (tanpa emoji dan tanpa < > & " \' \\)');
    setGalat('');
    setKirimJalan(true);
    try {
      const biaya = await biayaMaks('createOrder', k.harga);
      const s = await segarkanSaldo(akun);
      if (s < biaya) throw new Error(`Saldo kurang: butuh ${mon(biaya)} MON, ada ${mon(s)} MON`);
      const r = await kirim(akun, 'createOrder', [k.jenis, teks], k.harga);
      const ev = r.events.find((e) => e.eventName === 'OrderCreated');
      const id = ev?.args.id as bigint | undefined;
      if (id === undefined) throw new Error('Order terkirim, tapi id tidak terbaca');
      tulis(KUNCI_ORDER, String(id));
      setOrder(null);
      setNft(null);
      setOrderId(id);
      setTeks('');
      setPilih(null);
    } catch (e) {
      setGalat(pesanError(e));
    } finally {
      setKirimJalan(false);
      segarkanSaldo(akun).catch(() => {});
    }
  }

  function pesanLagi() {
    tulis(KUNCI_ORDER, null);
    setOrderId(null);
    setOrder(null);
    setNft(null);
  }

  const k = katalog.find((x) => x.jenis === pilih);
  const teksOk = teks.length === 0 || teksValid(teks);

  return (
    <main className="pesan">
      <header className="pesan-head">
        <div>
          <div className="brand">{NAMA}</div>
          <div className="muted kecil">Pesan dari HP, toko rebutan order</div>
        </div>
        {akun && (
          <div className="chip" title={akun.address}>
            {saldo === null ? '…' : `${mon(saldo)} MON`}
          </div>
        )}
      </header>

      {!akun ? (
        <section className="kartu mulai">
          <h2>Pesan fotokopi kilat</h2>
          <p className="muted">
            Bayar ke escrow. Makin cepat toko selesai, makin besar bayarannya. Kalau lambat, sisanya kembali ke kamu, plus NFT hasil cetakan.
          </p>
          <button className="tombol utama besar" disabled={masukJalan} onClick={() => mulai()}>
            {masukJalan ? 'Membuka passkey…' : passkeyMungkin() ? (punyaPasskey() ? 'Lanjut dengan passkey' : 'Mulai dengan passkey') : 'Mulai'}
          </button>
          {passkeyMungkin() && (
            <button className="tautan" disabled={masukJalan} onClick={() => mulai(true)}>
              Pakai akun sementara (tanpa passkey)
            </button>
          )}
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
            <span className={`badge ${akun.jenis}`}>{akun.jenis === 'mera' ? 'Passkey' : akun.jenis === 'dev' ? 'Dev' : 'Akun sementara'}</span>
            <span>{pendek(akun.address)}</span>
            {DEBUG && (
              <span>
                · {(durasiMasuk / 1000).toFixed(1)} dtk{akun.alasanFallback ? ` · fallback: ${akun.alasanFallback}` : ''}
              </span>
            )}
            {dana.s === 'minta' && <span>· mengisi saldo awal…</span>}
            {dana.s === 'gagal' && (
              <span className="galat">
                · {dana.pesan}{' '}
                <button className="tautan inline" onClick={() => ((danaDiminta.current = false), setDana({ s: 'idle' }), setUlangDana((n) => n + 1))}>
                  coba lagi
                </button>
              </span>
            )}
          </section>

          <AnimatePresence mode="wait">
            {orderId !== null ? (
              <motion.section key="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <StatusPesanan
                  id={orderId}
                  order={order}
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
                <h3 className="judul-bagian">Pilih pesanan</h3>
                <div className="katalog">
                  {katalog.map((x) => (
                    <button key={x.jenis} className={`item-katalog ${pilih === x.jenis ? 'aktif' : ''}`} onClick={() => setPilih(x.jenis)}>
                      <span className="label">{x.label}</span>
                      <span className="resep">{x.langkah.map((l) => NAMA_LANGKAH[l]).join(' → ')}</span>
                      <span className="harga">{mon(x.harga)} MON</span>
                      <span className="muted kecil">maks. {x.batasKerja} dtk</span>
                    </button>
                  ))}
                </div>
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
                    <label htmlFor="teks">Teks di hasil cetakan</label>
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
                    <button className="tombol utama besar" disabled={kirimJalan || !teks || !teksOk} onClick={bayar}>
                      {kirimJalan ? 'Mengirim…' : `Bayar ${mon(k.harga)} MON`}
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

function StatusPesanan(p: {
  id: bigint;
  order: Order | null;
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
  const payoutAkhir = o.status === 'Finished' ? hitungPayout(o.harga, o.batasKerja, o.kerja) : 0n;

  return (
    <div className="status">
      {p.putus && <div className="banner-galat kecil">Koneksi ke Monad terputus, mencoba lagi… (ordermu aman di escrow)</div>}
      <div className="kartu">
        <div className="muted kecil">
          #{String(p.id)} · {label}
        </div>
        <div className="teks-order">“{o.teks}”</div>
        <ol className="timeline">
          <li className="ok">Dibayar {mon(o.harga)} MON, ditahan escrow</li>
          {o.status === 'Open' && sisaAntre > 0 && (
            <li className="jalan">
              Menunggu toko… {sisaAntre} dtk
              <div className="bar">
                <div style={{ width: `${(sisaAntre / p.batasAntre) * 100}%` }} />
              </div>
            </li>
          )}
          {o.status === 'Open' && sisaAntre <= 0 && <li className="refund">Tidak ada toko yang sempat. Dana {mon(o.harga)} MON sedang dikembalikan…</li>}
          {o.status === 'Claimed' && kerja >= o.batasKerja && (
            <li className="refund">Toko kehabisan waktu. Dana {mon(o.harga)} MON sedang dikembalikan…</li>
          )}
          {(o.status === 'Claimed' || o.status === 'Finished') && <li className="ok">Diambil {toko}</li>}
          {o.status === 'Claimed' && kerja < o.batasKerja && (
            <li className="jalan">
              Dikerjakan: {o.langkah.map((l, i) => (i < o.langkahSelesai ? '✓ ' : i === o.langkahSelesai ? '▸ ' : '') + NAMA_LANGKAH[l]).join(' · ')}
              <div className="muted kecil">
                Bayaran toko kalau selesai sekarang {mon(payout)} MON · kembalianmu {mon(o.harga - payout)} MON
              </div>
            </li>
          )}
          {o.status === 'Expired' && <li className="refund">Tidak keburu. Dana {mon(o.harga)} MON dikembalikan penuh.</li>}
        </ol>
      </div>

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
              <b>{mon(payoutAkhir)}</b>
            </div>
            <div>
              <span className="muted kecil">Kembalianmu</span>
              <b>{mon(o.harga - payoutAkhir)}</b>
            </div>
          </div>
          <div className="muted kecil">NFT hasil cetakan sudah ada di akunmu.</div>
        </motion.div>
      )}

      {(o.status === 'Finished' || o.status === 'Expired') && (
        <button className="tombol utama besar" onClick={p.onLagi}>
          Pesan lagi
        </button>
      )}
    </div>
  );
}
