// /toko — layar pemain (BLZ-10): rebut order, mainkan resep mini-game, 1 tx completeStep per langkah, HUD payout.
// Anvil: /toko?dev=1 (Toko A) atau /toko?dev=2 (Toko B). Testnet: alamat passkey harus didaftarkan operator (registerShop).
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hitungPayout } from '../../../shared/src/index.ts';
import Fotokopi from '../game/Fotokopi';
import '../game/game.css';
import Laminating from '../game/Laminating';
import Print from '../game/Print';
import { sfx } from '../game/sfx';
import type { PropsMiniGame } from '../game/tipe';
import { akunBurner, masuk, passkeyMungkin, type Akun } from '../lib/akun';
import { mon, NAMA_LANGKAH, pendek, ZERO } from '../lib/format';
import { NAMA } from '../lib/merek';
import type { Katalog, Order } from '../lib/katalog';
import { bacaLive, useJamChain, useLive } from '../lib/live';
import { kirim, pesanError } from '../lib/tx';

const MINIGAME: Record<number, (p: PropsMiniGame) => React.JSX.Element> = { 1: Fotokopi, 2: Print, 3: Laminating };
const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

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
  const antre = Object.values(s.order)
    .filter((o) => o.status === 'Open' && o.sesi === s.sesiId && now - o.dibuatPada < s.batasAntre)
    .sort((a, b) => a.dibuatPada - b.dibuatPada);

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
            <Runner key={String(kerjaAktif.id)} akun={akun} o={kerjaAktif} k={s.katalog[kerjaAktif.jenis]} now={now} onSelesai={selesai} onGalat={galat} />
          ) : hasil ? (
            <motion.div className="hasil" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="muted">{hasil.label} selesai dalam {hasil.kerja} dtk</div>
              <div className="angka-hasil">+{mon(hasil.payout, 5)}</div>
              <div className="muted">Kembali ke pelanggan {mon(hasil.refund, 5)} · NFT terkirim</div>
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
function Runner(p: { akun: Akun; o: Order; k?: Katalog; now: number; onSelesai: (h: Hasil) => void; onGalat: (t: string) => void }) {
  const { o } = p;
  const [idx, setIdx] = useState(o.langkahSelesai);
  const [tercatat, setTercatat] = useState<number[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);
  const sudah = useRef(new Set<number>());
  const n = o.langkah.length;
  const kerja = Math.max(0, p.now - o.diclaimPada);
  const telat = kerja >= o.batasKerja;
  const payout = hitungPayout(o.harga, o.batasKerja, kerja);
  const frac = Number((payout * 1000n) / o.harga) / 1000;
  const Game = MINIGAME[o.langkah[idx]];

  const lulus = useCallback(async () => {
    if (sudah.current.has(idx)) return;
    sudah.current.add(idx);
    const kode = o.langkah[idx];
    const terakhir = idx === n - 1;
    if (terakhir) setMenyimpan(true);
    else setIdx(idx + 1);
    try {
      const r = await kirim(p.akun, 'completeStep', [o.id, kode]);
      setTercatat((t) => [...t, idx]);
      const ev = r.events.find((e) => e.eventName === 'OrderFinished');
      if (ev)
        p.onSelesai({ payout: ev.args.payout as bigint, refund: ev.args.refund as bigint, kerja: Number(ev.args.kerja), label: p.k?.label ?? '' });
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
            {kerja} / {o.batasKerja} dtk · sisanya kembali ke pelanggan
          </span>
        </div>
      </div>
      {telat ? (
        <div className="meja-kosong telat">Waktu habis! Dana dikembalikan penuh ke pelanggan.</div>
      ) : menyimpan ? (
        <div className="meja-kosong">Mencatat langkah terakhir ke Monad…</div>
      ) : Game ? (
        <Game key={`${String(o.id)}-${idx}`} teks={o.teks} label={p.k?.label ?? ''} onLulus={lulus} />
      ) : null}
    </div>
  );
}
