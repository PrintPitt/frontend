// /toko — layar pemain (BLZ-10): rebut order, mainkan resep mini-game, 1 tx completeStep per langkah, HUD payout.
// Anvil: /toko?dev=1 (Toko A) atau /toko?dev=2 (Toko B). Testnet: alamat passkey harus didaftarkan operator (registerShop).
// v2.1 (toko fotokopi nyata): lokasi toko → feed radius dari backend (1,5 km; Toko Pro 3 km), unduh dokumen order,
// langkah ditandai manual, order Siap → pindai QR pelanggan → `serahkan`. Order mini-game (kodeHash 0) tetap seperti dulu.
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRupiah, hitungPayout } from '../../../shared/src/index.ts';
import PindaiQr from '../components/PindaiQr';
import Fotokopi from '../game/Fotokopi';
import '../game/game.css';
import Laminating from '../game/Laminating';
import Print from '../game/Print';
import { sfx } from '../game/sfx';
import type { PropsMiniGame } from '../game/tipe';
import { akunBurner, masuk, passkeyMungkin, type Akun } from '../lib/akun';
import { mon, NAMA_LANGKAH, pendek, ZERO } from '../lib/format';
import { NAMA } from '../lib/merek';
import { ambilFeed, infoDokumen, kirimLokasiToko, lokasiPerangkat, unduhDokumen, type Feed } from '../lib/backend';
import { bacaPro, payoutBersih, type Katalog, type Order } from '../lib/katalog';
import { bacaLive, useJamChain, useLive } from '../lib/live';
import { bacaQr, cocok } from '../lib/serah';
import { izinkanToken, kirim, kirimLangkah, pesanError } from '../lib/tx';

const MINIGAME: Record<number, (p: PropsMiniGame) => React.JSX.Element> = { 1: Fotokopi, 2: Print, 3: Laminating };
const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
/** Order dokumen nyata (bukan mini-game): punya file atau kode serah terima. */
const orderNyata = (o: Order) => BigInt(o.dokumen) !== 0n || BigInt(o.kodeHash) !== 0n;
const FEED_MS = 3000;
const pesanGalat = (e: unknown) => (e instanceof Error && !('walk' in e) ? e.message : pesanError(e));

type Toast = { teks: string; jenis: 'ok' | 'kalah' | 'info' };
type Hasil = { payout: bigint; refund: bigint; kerja: number; label: string };

export default function Toko() {
  const s = useLive();
  const now = Math.floor(useJamChain(s.offset));
  const [akun, setAkun] = useState<Akun | null>(null);
  const [masukJalan, setMasukJalan] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [rebut, setRebut] = useState<bigint | null>(null);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dingTerakhir = useRef('');
  // feed radius dari backend + id order tertinggi saat feed diambil (order lebih baru belum terindeks: tetap tampil)
  const [feed, setFeed] = useState<{ f: Feed; batas: bigint } | null>(null);
  const [pro, setPro] = useState<{ pro: boolean; sampai: number; harga: bigint } | null>(null);
  const [alatJalan, setAlatJalan] = useState('');
  const [pindai, setPindai] = useState(false);
  const [halamanFile, setHalamanFile] = useState<Record<string, number>>({});

  const tampil = useCallback((t: Toast, ms = 2400) => {
    setToast(t);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(location.search).has('dev')) masuk().then(setAkun);
  }, []);

  // Bunyi "ding" saat order baru masuk.
  useEffect(() => {
    const k = s.kejadian.find((x) => x.jenis === 'baru');
    if (k && k.kunci !== dingTerakhir.current) {
      dingTerakhir.current = k.kunci;
      sfx('ding');
    }
  }, [s.kejadian]);

  const saya = akun ? s.toko.find((t) => sama(t.alamat, akun.address)) : undefined;
  const aktif = saya && saya.orderAktif ? s.order[String(saya.orderAktif)] : undefined;
  const kerjaAktif = aktif?.status === 'Claimed' ? aktif : undefined;
  const dalamFeed = feed?.f.toko ? new Map(feed.f.order.map((x) => [x.id, x])) : null;
  const antre = Object.values(s.order)
    .filter((o) => o.status === 'Open' && o.sesi === s.sesiId && now - o.dibuatPada < s.batasAntre)
    // lokasi toko diatur → hanya order dalam radius (+ order tanpa lokasi / yang belum sempat terindeks backend)
    .filter((o) => !dalamFeed || dalamFeed.has(String(o.id)) || o.id > feed!.batas)
    .sort((a, b) => a.dibuatPada - b.dibuatPada);
  const siapSerah = akun ? Object.values(s.order).filter((o) => o.status === 'Siap' && sama(o.toko, akun.address)) : [];

  // Feed radius (backend) dipolling pelan; order live tetap dari event chain supaya rebutan tidak tertunda indeks.
  const alamatSaya = saya?.alamat;
  useEffect(() => {
    if (!alamatSaya) return;
    let berhenti = false;
    let t: ReturnType<typeof setTimeout>;
    const putar = async () => {
      const batas = Object.keys(bacaLive().order).reduce((m, k) => (BigInt(k) > m ? BigInt(k) : m), 0n);
      try {
        const f = await ambilFeed(alamatSaya);
        if (!berhenti) setFeed({ f, batas });
      } catch {
        /* backend mati: tampilkan semua order dari chain */
      }
      if (!berhenti) t = setTimeout(putar, FEED_MS);
    };
    putar();
    return () => {
      berhenti = true;
      clearTimeout(t);
    };
  }, [alamatSaya]);

  useEffect(() => {
    if (alamatSaya) bacaPro(alamatSaya).then(setPro).catch(() => {});
  }, [alamatSaya]);

  // Perkiraan halaman dari file (backend) untuk dibandingkan dengan halaman yang dibayar, sebelum claim (BLZ-22.T4).
  useEffect(() => {
    for (const o of antre) {
      const k = String(o.id);
      if (BigInt(o.dokumen) === 0n || k in halamanFile) continue;
      setHalamanFile((h) => ({ ...h, [k]: 0 }));
      infoDokumen(o.dokumen)
        .then((d) => setHalamanFile((h) => ({ ...h, [k]: d.halaman })))
        .catch(() => {});
    }
  }, [antre, halamanFile]);

  async function aturLokasi() {
    if (!akun) return;
    setAlatJalan('lokasi');
    try {
      const r = await kirimLokasiToko(akun, await lokasiPerangkat());
      tampil({ teks: `Lokasi toko tersimpan · radius feed ${r.radiusKm} km`, jenis: 'ok' });
    } catch (e) {
      tampil({ teks: pesanGalat(e), jenis: 'kalah' });
    } finally {
      setAlatJalan('');
    }
  }

  async function langganan() {
    if (!akun || !pro) return;
    setAlatJalan('pro');
    try {
      await izinkanToken(akun, pro.harga);
      await kirim(akun, 'langgananPro', [1]);
      setPro(await bacaPro(akun.address));
      tampil({ teks: 'Toko Pro aktif 30 hari · radius feed 3 km', jenis: 'ok' });
    } catch (e) {
      tampil({ teks: pesanError(e), jenis: 'kalah' });
    } finally {
      setAlatJalan('');
    }
  }

  async function serahkan(teks: string) {
    if (!akun) return;
    setPindai(false);
    const q = bacaQr(teks);
    const o = q && siapSerah.find((x) => x.id === q.orderId);
    if (!q) return tampil({ teks: 'QR bukan kode serah terima PrintPitt', jenis: 'kalah' });
    if (!o) return tampil({ teks: `QR untuk order #${q.orderId}, bukan order Siap milik tokomu`, jenis: 'kalah' });
    if (!cocok(q.rahasia, o.kodeHash)) return tampil({ teks: 'QR tidak cocok dengan order ini', jenis: 'kalah' });
    setAlatJalan(`serah-${o.id}`);
    try {
      const r = await kirim(akun, 'serahkan', [o.id, q.rahasia]);
      const ev = r.events.find((e) => e.eventName === 'OrderFinished');
      if (ev) selesai({ payout: ev.args.payout as bigint, refund: ev.args.refund as bigint, kerja: Number(ev.args.kerja), label: s.katalog[o.jenis]?.label ?? '' });
    } catch (e) {
      tampil({ teks: pesanError(e), jenis: 'kalah' });
    } finally {
      setAlatJalan('');
    }
  }

  async function unduh(o: Order) {
    if (!akun) return;
    try {
      await unduhDokumen(akun, o.dokumen, o.id);
    } catch (e) {
      tampil({ teks: pesanGalat(e), jenis: 'kalah' });
    }
  }

  async function claim(id: bigint) {
    if (!akun || rebut !== null) return;
    setRebut(id);
    setHasil(null);
    sfx('klik');
    try {
      await kirim(akun, 'claim', [id]);
      sfx('ambil');
      tampil({ teks: `Order #${id} milikmu! Kerjakan secepatnya`, jenis: 'ok' });
    } catch (e) {
      sfx('kalah');
      const pesan = pesanError(e);
      const o = bacaLive().order[String(id)];
      const nama = o && o.toko !== ZERO ? bacaLive().toko.find((t) => sama(t.alamat, o.toko))?.nama : undefined;
      tampil({ teks: pesan === 'Diambil toko lain' && nama ? `Kalah cepat! Diambil ${nama}` : pesan, jenis: 'kalah' });
    } finally {
      setRebut(null);
    }
  }

  const selesai = useCallback((h: Hasil) => {
    setHasil(h);
    sfx('selesai');
    confetti({ particleCount: 140, spread: 90, startVelocity: 42, origin: { x: 0.62, y: 0.5 }, colors: ['#836ef9', '#f6f6f5', '#f4b829', '#5fd39a'] });
    setTimeout(() => setHasil(null), 4500);
  }, []);
  const galat = useCallback((t: string) => (sfx('gagal'), tampil({ teks: t, jenis: 'kalah' })), [tampil]);

  async function mulai(burner: boolean) {
    setMasukJalan(true);
    try {
      setAkun(burner ? akunBurner() : await masuk());
    } catch {
      tampil({ teks: 'Passkey dibatalkan', jenis: 'info' });
    } finally {
      setMasukJalan(false);
    }
  }

  if (!akun)
    return (
      <main className="pesan">
        <header className="pesan-head">
          <div className="brand">{NAMA} · Toko</div>
        </header>
        <section className="kartu mulai">
          <h2>Buka toko</h2>
          <p className="muted">Rebut order penonton, kerjakan lewat mini-game. Makin kilat, makin cuan.</p>
          <button className="tombol utama besar" disabled={masukJalan} onClick={() => mulai(false)}>
            {passkeyMungkin() ? 'Masuk dengan passkey' : 'Masuk'}
          </button>
          <button className="tautan" disabled={masukJalan} onClick={() => mulai(true)}>
            Pakai akun sementara
          </button>
        </section>
        {toast && <p className="galat">{toast.teks}</p>}
      </main>
    );

  return (
    <main className="toko">
      <header className="toko-head">
        <div>
          <div className="brand">{saya?.nama ?? 'Belum terdaftar'}</div>
          <div className="muted kecil">{pendek(akun.address)}</div>
        </div>
        <div className="papan-skor">
          {s.toko.map((t) => (
            <div key={t.alamat} className={`skor ${sama(t.alamat, akun.address) ? 'saya' : ''}`}>
              <span className="muted kecil">{t.nama}</span>
              <motion.b key={String(t.omzet)} initial={{ scale: 1.3, color: '#5fd39a' }} animate={{ scale: 1, color: '#e9eaea' }}>
                {mon(t.omzet)}
              </motion.b>
            </div>
          ))}
        </div>
      </header>

      {s.siap && !saya && (
        <div className="kartu galat kecil">
          Alamat ini belum terdaftar sebagai toko. Kirim ke operator untuk registerShop: <code>{akun.address}</code>
        </div>
      )}
      {s.siap && !s.sesiAktif && <div className="kartu muted kecil">Sesi belum dibuka operator.</div>}
      {s.galat && <div className="banner-galat">RPC: {s.galat}</div>}

      {saya && (
        <section className="toko-alat kecil">
          <span className="muted">
            {feed?.f.toko ? `Feed radius ${feed.f.radiusKm} km` : 'Lokasi toko belum diatur · semua order tampil'}
          </span>
          <button className="tombol" disabled={!!alatJalan} onClick={aturLokasi}>
            {alatJalan === 'lokasi' ? 'Membaca lokasi…' : feed?.f.toko ? 'Perbarui lokasi' : 'Atur lokasi toko'}
          </button>
          {pro &&
            (pro.pro ? (
              <span className="badge mera">PRO s.d. {new Date(pro.sampai * 1000).toLocaleDateString('id-ID')}</span>
            ) : (
              pro.harga > 0n && (
                <button className="tombol" disabled={!!alatJalan} onClick={langganan} title="Radius feed 3 km, dibayar tIDRX dari saldo toko">
                  {alatJalan === 'pro' ? 'Memproses…' : `Toko Pro ${formatRupiah(pro.harga)}/30 hari`}
                </button>
              )
            ))}
          {siapSerah.length > 0 && (
            <button className="tombol utama" disabled={!!alatJalan} onClick={() => setPindai(true)}>
              Pindai QR · {siapSerah.length} siap diambil
            </button>
          )}
        </section>
      )}
      {pindai && <PindaiQr onHasil={serahkan} onTutup={() => setPindai(false)} />}
      {siapSerah.length > 0 && (
        <section className="kartu kecil">
          {siapSerah.map((o) => (
            <div key={String(o.id)} className="baris-siap">
              <span>
                #{String(o.id)} · {s.katalog[o.jenis]?.label} · “{o.teks}” · bayaran {mon(payoutBersih(hitungPayout(o.harga, o.batasKerja, o.kerja), s.feeBps))}
              </span>
              {BigInt(o.dokumen) !== 0n && (
                <button className="tautan inline" onClick={() => unduh(o)}>
                  unduh dokumen
                </button>
              )}
              {alatJalan === `serah-${o.id}` && <span className="muted"> menyerahkan…</span>}
            </div>
          ))}
        </section>
      )}

      <div className="toko-isi">
        <aside className="feed">
          <h3 className="judul-bagian">
            Order masuk <span className="muted">{antre.length}</span>
          </h3>
          <AnimatePresence initial={false}>
            {antre.map((o) => (
              <motion.div
                key={String(o.id)}
                layout
                className="item-feed"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <div className="isi-feed">
                  <b>{s.katalog[o.jenis]?.label}</b>
                  <div className="teks-kecil">“{o.teks}”</div>
                  <div className="muted kecil">
                    {o.langkah.map((l) => NAMA_LANGKAH[l]).join(' → ')} · {mon(o.harga)}
                    {orderNyata(o) && ` · ${o.halaman} hlm`}
                    {halamanFile[String(o.id)] ? ` (file ±${halamanFile[String(o.id)]})` : ''}
                    {BigInt(o.kodeHash) !== 0n && ' · QR'}
                    {dalamFeed?.get(String(o.id))?.jarakKm != null && ` · ${dalamFeed.get(String(o.id))!.jarakKm} km`}
                  </div>
                  <div className="bar tipis">
                    <div style={{ width: `${Math.max(0, ((s.batasAntre - (now - o.dibuatPada)) / s.batasAntre) * 100)}%` }} />
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="tombol utama tombol-rebut"
                  disabled={!saya || !!kerjaAktif || rebut !== null}
                  onClick={() => claim(o.id)}
                >
                  {rebut === o.id ? '…' : 'REBUT!'}
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
          {antre.length === 0 && <p className="muted">{s.siap ? 'Belum ada order…' : 'Menyambung…'}</p>}
        </aside>

        <section className="meja">
          {kerjaAktif ? (
            <Runner
              key={String(kerjaAktif.id)}
              akun={akun}
              o={kerjaAktif}
              k={s.katalog[kerjaAktif.jenis]}
              feeBps={s.feeBps}
              now={now}
              onSelesai={selesai}
              onSiap={() => tampil({ teks: 'Siap! Minta pelanggan menunjukkan QR, lalu pindai', jenis: 'ok' }, 4000)}
              onUnduh={unduh}
              onGalat={galat}
            />
          ) : hasil ? (
            <motion.div className="hasil" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="muted">{hasil.label} selesai dalam {hasil.kerja} dtk</div>
              <div className="angka-hasil">+{mon(hasil.payout, 5)}</div>
              <div className="muted">Kembali ke pelanggan {mon(hasil.refund, 5)} · NFT terkirim · potongan platform {s.feeBps / 100}%</div>
            </motion.div>
          ) : (
            <div className="meja-kosong">{saya ? 'Rebut order dari antrean!' : 'Menunggu pendaftaran toko'}</div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className={`toast-toko ${toast.jenis}`} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            {toast.teks}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/** Menjalankan resep: satu mini-game per langkah; tiap lulus → completeStep (tx jalan sambil langkah berikutnya dimainkan). */
function Runner(p: {
  akun: Akun;
  o: Order;
  k?: Katalog;
  feeBps: number;
  now: number;
  onSelesai: (h: Hasil) => void;
  onSiap: () => void;
  onUnduh: (o: Order) => void;
  onGalat: (t: string) => void;
}) {
  const { o } = p;
  const [idx, setIdx] = useState(o.langkahSelesai);
  const [tercatat, setTercatat] = useState<number[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);
  const sudah = useRef(new Set<number>());
  const n = o.langkah.length;
  const kerja = Math.max(0, p.now - o.diclaimPada);
  const telat = kerja >= o.batasKerja;
  const kotor = hitungPayout(o.harga, o.batasKerja, kerja);
  const payout = payoutBersih(kotor, p.feeBps);
  const frac = Number((kotor * 1000n) / o.harga) / 1000;
  const nyata = orderNyata(o);
  // order dokumen nyata: langkah dikerjakan di mesin sungguhan, ditandai dengan tombol (bukan mini-game)
  const Game = nyata ? undefined : MINIGAME[o.langkah[idx]];

  const lulus = useCallback(async () => {
    if (sudah.current.has(idx)) return;
    sudah.current.add(idx);
    const kode = o.langkah[idx];
    const terakhir = idx === n - 1;
    if (terakhir) setMenyimpan(true);
    else setIdx(idx + 1);
    try {
      const r = await kirimLangkah(p.akun, o.id, kode); // tunggu/ulang sebentar kalau RPC tertinggal setelah claim
      setTercatat((t) => [...t, idx]);
      const ev = r.events.find((e) => e.eventName === 'OrderFinished');
      if (ev)
        p.onSelesai({ payout: ev.args.payout as bigint, refund: ev.args.refund as bigint, kerja: Number(ev.args.kerja), label: p.k?.label ?? '' });
      else if (r.events.some((e) => e.eventName === 'OrderReady')) p.onSiap();
    } catch (e) {
      p.onGalat(pesanError(e));
      sudah.current.delete(idx);
      setMenyimpan(false);
      setIdx(idx); // ulangi langkah yang gagal tercatat
    }
  }, [idx, n, o.id, o.langkah, p]);

  return (
    <div className="runner">
      <div className="hud">
        <div className="hud-order">
          <div className="muted kecil">
            #{String(o.id)} · {p.k?.label}
          </div>
          <div className="kertas kertas-hud">“{o.teks}”</div>
          {nyata && (
            <div className="muted kecil">
              {o.halaman} halaman
              {BigInt(o.dokumen) !== 0n && (
                <>
                  {' · '}
                  <button className="tautan inline" onClick={() => p.onUnduh(o)}>
                    unduh dokumen
                  </button>
                </>
              )}
            </div>
          )}
          <div className="langkah">
            {o.langkah.map((l, i) => (
              <span key={i} className={i < idx ? (tercatat.includes(i) ? 'done' : 'pending') : i === idx ? 'now' : ''}>
                {i < idx ? (tercatat.includes(i) ? '✓ ' : '⧗ ') : ''}
                {NAMA_LANGKAH[l]}
              </span>
            ))}
          </div>
        </div>
        <div className="hud-payout">
          <span className="muted kecil">Bayaranmu kalau selesai sekarang</span>
          <span className="angka-payout">{mon(payout, 5)}</span>
          <div className="bar tebal">
            <div style={{ width: `${frac * 100}%` }} />
          </div>
          <span className="muted kecil">
            {kerja} / {o.batasKerja} dtk · sisanya kembali ke pelanggan · bersih setelah potongan platform
          </span>
        </div>
      </div>
      {telat ? (
        <div className="meja-kosong telat">Waktu habis! Dana dikembalikan penuh ke pelanggan.</div>
      ) : menyimpan ? (
        <div className="meja-kosong">Mencatat langkah terakhir ke Monad…</div>
      ) : Game ? (
        <Game key={`${String(o.id)}-${idx}`} teks={o.teks} label={p.k?.label ?? ''} onLulus={lulus} />
      ) : nyata && idx < n ? (
        <div className="meja-kosong">
          <button className="tombol utama besar" onClick={lulus}>
            ✓ {NAMA_LANGKAH[o.langkah[idx]]} selesai
          </button>
          {idx === n - 1 && BigInt(o.kodeHash) !== 0n && <p className="muted kecil">Setelah ini order Siap: bayaran terkunci, dana cair saat QR pelanggan dipindai.</p>}
        </div>
      ) : null}
    </div>
  );
}
