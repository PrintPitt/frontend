// /pesan — halaman penonton di HP (BLZ-09, BL-D22-08): akun → saldo Rupiah (tIDRX) → isi saldo bila perlu →
// pilih pesanan → tanda tangan Pesanan + permit (tanpa MON, gas dibayar relayer) → status live → NFT / refund.
// Kontrak v2 mode demo: 1 halaman, tanpa dokumen, tanpa kode serah terima (selesai di langkah terakhir).
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRupiah, hitungPayout, MAX_TEXT, teksValid } from '../../../shared/src/index.ts';
import { akunAktif, akunBurner, lupakanPasskey, masuk, pakaiAkun, passkeyMungkin, punyaPasskey, type Akun } from '../lib/akun';
import { ambilConfig, ambilTopup, bayarTopup, buatTopup, pesanTanpaGas, saldoTidrx, type TopUp } from '../lib/backend';
import { kontrak, offsetChain, pub } from '../lib/chain';
import { NAMA_LANGKAH, pendek } from '../lib/format';
import { NAMA } from '../lib/merek';
import { bacaKatalog, bacaNft, bacaOrder, bacaToko, type Katalog, type Order } from '../lib/katalog';
import { useJamChain } from '../lib/live';
import { pesanError } from '../lib/tx';

const POLL_MS = Number(import.meta.env.VITE_POLL_MS || 1500);
const DEBUG = new URLSearchParams(location.search).has('debug'); // SPK-07: waktu onboarding + alasan fallback
const KUNCI_ORDER = 'pp.order.aktif';
/** Jenis 1–4 = order mini-game (dikerjakan di game /main). Jenis 5+ = cetak dokumen nyata (butuh upload, belum di FE). */
const JENIS_DEMO = (k: Katalog) => k.jenis <= 4;
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
  const [katalog, setKatalog] = useState<Katalog[]>([]);
  const [namaToko, setNamaToko] = useState<Record<string, string>>({});
  const [batasAntre, setBatasAntre] = useState(45);
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
      const [k, t, b, off, cfg] = await Promise.all([
        bacaKatalog(),
        bacaToko(),
        pub.readContract({ ...kontrak, functionName: 'batasAntre' }),
        offsetChain(),
        ambilConfig(),
      ]);
      setKatalog(k.filter(JENIS_DEMO));
      setNamaToko(Object.fromEntries(t.map((x) => [x.alamat.toLowerCase(), x.nama])));
      setBatasAntre(b);
      setOffset(off);
      setFee(BigInt(cfg.feeRelay));
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
  const total = k && fee !== null ? k.harga + fee : null;
  const kurang = total !== null && saldo !== null && saldo < total;

  async function bayar() {
    if (!akun || !k || fee === null) return;
    if (!teksValid(teks)) return setGalat('Teks 1–40 huruf biasa (tanpa emoji dan tanpa < > & " \' \\)');
    setGalat('');
    try {
      const s = await segarkanSaldo(akun);
      if (s < k.harga + fee) {
        setIsiSaldo(true);
        throw new Error(`Saldo kurang: butuh ${formatRupiah(k.harga + fee)}, ada ${formatRupiah(s)}`);
      }
      setTahap('tanda');
      const jalan = pesanTanpaGas(akun, { jenis: k.jenis, teks, harga: k.harga, fee });
      setTahap('kirim');
      const { id } = await jalan;
      tulis(KUNCI_ORDER, String(id));
      setOrder(null);
      setNft(null);
      setOrderId(id);
      setTeks('');
      setPilih(null);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setTahap('');
      segarkanSaldo(akun).catch(() => {});
    }
  }

  function pesanLagi() {
    tulis(KUNCI_ORDER, null);
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
                      <span className="harga">{formatRupiah(x.harga)}</span>
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
                    <div className="rincian kecil">
                      <span>Harga {formatRupiah(k.harga)}</span>
                      <span>Biaya layanan {fee === null ? '…' : formatRupiah(fee)}</span>
                      <span className="muted">Gas Monad dibayar relayer</span>
                    </div>
                    <button className="tombol utama besar" disabled={!!tahap || !teks || !teksOk || fee === null} onClick={kurang ? () => setIsiSaldo(true) : bayar}>
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
  const selesai = o.status === 'Finished' || o.status === 'Diputuskan';
  const payoutAkhir = selesai || o.status === 'Siap' ? hitungPayout(o.harga, o.batasKerja, o.kerja) : 0n;

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
                Bayaran toko kalau selesai sekarang {formatRupiah(payout)} · kembalianmu {formatRupiah(o.harga - payout)}
              </div>
            </li>
          )}
          {o.status === 'Siap' && <li className="jalan">Siap diambil di loket {toko}</li>}
          {o.status === 'Sengketa' && <li className="refund">Komplain diterima, menunggu keputusan panitia</li>}
          {o.status === 'Expired' && <li className="refund">Tidak keburu. Dana {formatRupiah(o.harga)} dikembalikan penuh.</li>}
        </ol>
      </div>

      {selesai && (
        <motion.div className="kartu nft" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {p.nft ? <img src={p.nft.image} alt={p.nft.name} /> : <div className="muted">Memuat NFT…</div>}
          <div className="angka">
            <div>
              <span className="muted kecil">Selesai</span>
              <b>{o.kerja} dtk</b>
            </div>
            <div>
              <span className="muted kecil">Toko dibayar</span>
              <b>{formatRupiah(payoutAkhir)}</b>
            </div>
            <div>
              <span className="muted kecil">Kembalianmu</span>
              <b>{formatRupiah(o.harga - payoutAkhir)}</b>
            </div>
          </div>
          <div className="muted kecil">NFT hasil cetakan sudah ada di akunmu.</div>
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
