// /layar — projector screen (BLZ-12): queue, two live shops, revenue, payout dropping every second, money flow, winner, QR.
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hitungPayout } from '../../../shared/src/index.ts';
import MesinFigur from '../components/MesinFigur';
import { sfx } from '../game/sfx';
import { IS_MAINNET } from '../lib/chain';
import { mon, NAMA_LANGKAH } from '../lib/format';
import { NAMA } from '../lib/merek';
import { payoutBersih, type Katalog, type Order } from '../lib/katalog';
import { useJamChain, useLive, type Kejadian, type TokoLive } from '../lib/live';

const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
// QR membawa jaringan yang sedang ditampilkan, supaya HP penonton memesan di chain yang sama dengan layar
const URL_PESAN = `${(import.meta.env.VITE_PUBLIC_URL || location.origin).replace(/\/+$/, '')}/pesan${IS_MAINNET ? '?jaringan=mainnet' : ''}`;

export default function Layar() {
  const s = useLive();
  const now = Math.floor(useJamChain(s.offset));
  const refToko = useRef<Record<string, HTMLElement | null>>({});
  const refQR = useRef<HTMLElement | null>(null);
  const refEscrow = useRef<HTMLDivElement | null>(null);
  const terakhir = useRef<string | undefined>(undefined);
  const [suara, setSuara] = useState(false); // browser needs one click before audio may play
  const bunyiDilihat = useRef(new Set<string>());
  const bunyiMulai = useRef(Date.now());

  useEffect(() => {
    for (const k of s.kejadian) {
      if (bunyiDilihat.current.has(k.kunci) || k.waktu < bunyiMulai.current) continue;
      bunyiDilihat.current.add(k.kunci);
      if (!suara) continue;
      sfx(k.jenis === 'baru' ? 'ding' : k.jenis === 'claim' ? 'ambil' : k.jenis === 'selesai' ? 'selesai' : 'gagal');
    }
  }, [s.kejadian, suara]);

  const daftar = useMemo(() => Object.values(s.order).filter((o) => o.sesi === s.sesiId), [s.order, s.sesiId]);
  const antre = daftar.filter((o) => o.status === 'Open' && now - o.dibuatPada < s.batasAntre).sort((a, b) => a.dibuatPada - b.dibuatPada);
  const escrow = daftar.filter((o) => o.status === 'Open' || o.status === 'Claimed').reduce((t, o) => t + o.harga, 0n);
  const jmlSelesai = daftar.filter((o) => o.status === 'Finished').length;
  const jmlKembali = daftar.filter((o) => o.status === 'Expired').length;
  const riwayat = s.kejadian.filter((k) => k.jenis === 'selesai' || k.jenis === 'expire').slice(0, 7);
  const juara = [...s.toko].sort((a, b) => (b.omzet > a.omzet ? 1 : b.omzet < a.omzet ? -1 : 0))[0];
  const tampilJuara = s.siap && !s.sesiAktif && s.sesiId > 0 && !!juara && juara.omzet > 0n;
  const peringkat = [...s.toko].sort((a, b) => (b.omzet > a.omzet ? 1 : b.omzet < a.omzet ? -1 : 0));

  useEffect(() => {
    if (!tampilJuara) return;
    if (suara) [0, 250, 500].forEach((d) => setTimeout(() => sfx('selesai'), d));
    const warna = ['#836ef9', '#f6f6f5', '#f4b829', '#5fd39a'];
    const t = [0, 400, 900].map((d, i) =>
      setTimeout(() => confetti({ particleCount: 160, spread: 100 + i * 20, startVelocity: 50, origin: { x: 0.2 + i * 0.3, y: 0.6 }, colors: warna }), d),
    );
    return () => t.forEach(clearTimeout);
  }, [tampilJuara]);

  // Confetti over the shop that just finished an order.
  useEffect(() => {
    const k = s.kejadian.find((x) => x.jenis === 'selesai');
    if (!k || k.kunci === terakhir.current) return;
    terakhir.current = k.kunci;
    if (k.waktu === 0) return; // history from snapshot, not a new event
    const el = k.toko ? refToko.current[k.toko.toLowerCase()] : null;
    const r = el?.getBoundingClientRect();
    confetti({
      particleCount: 110,
      spread: 75,
      startVelocity: 38,
      colors: ['#836ef9', '#f6f6f5', '#f4b829', '#5fd39a'],
      origin: r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.45) / innerHeight } : { x: 0.6, y: 0.5 },
    });
  }, [s.kejadian]);

  return (
    <main className="layar">
      <header className="layar-head">
        <div>
          <div className="brand besar">{NAMA}</div>
          <div className="muted">Race for orders on Monad · faster means more profit</div>
        </div>
        <div className="statistik">
          <button
            className={`tombol-suara ${suara ? 'nyala' : ''}`}
            onClick={() => {
              setSuara((v) => !v);
              if (!suara) sfx('ding');
            }}
            title="Screen sound"
          >
            {suara ? '🔊' : '🔈'}
          </button>
          <Stat label="Session" nilai={s.sesiId ? `#${s.sesiId} ${s.sesiAktif ? 'OPEN' : 'CLOSED'}` : '—'} nyala={s.sesiAktif} />
          <Stat label="Orders done" nilai={String(jmlSelesai)} />
          <Stat label="In escrow" nilai={mon(escrow)} refEl={refEscrow} />
        </div>
      </header>

      {s.galat && <div className="banner-galat">RPC: {s.galat}</div>}

      <div className="layar-isi">
        <aside className="kolom-kiri">
          <KartuQR refEl={refQR} />
          <section className="antrean">
            <h3 className="judul-bagian">
              Queue <span className="muted">{antre.length}</span>
            </h3>
            <AnimatePresence initial={false}>
              {antre.map((o) => (
                <ItemAntre key={String(o.id)} o={o} k={s.katalog[o.jenis]} sisa={s.batasAntre - (now - o.dibuatPada)} batas={s.batasAntre} />
              ))}
            </AnimatePresence>
            {antre.length === 0 && <p className="muted kosong">{s.siap ? 'No orders yet. Scan the QR to order!' : 'Connecting to chain…'}</p>}
          </section>
        </aside>

        <section className="toko-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, s.toko.length)}, 1fr)` }}>
          {s.toko.map((t, i) => (
            <PanelToko
              key={t.alamat}
              t={t}
              urut={i}
              o={t.orderAktif ? s.order[String(t.orderAktif)] : undefined}
              katalog={s.katalog}
              feeBps={s.feeBps}
              now={now}
              kejadian={s.kejadian}
              refEl={(el) => (refToko.current[t.alamat.toLowerCase()] = el)}
              unggul={!!juara && juara.omzet > 0n && sama(juara.alamat, t.alamat)}
            />
          ))}
        </section>
      </div>

      <footer className="riwayat">
        <span className="muted">History</span>
        <AnimatePresence initial={false}>
          {riwayat.map((k) => (
            <motion.span key={k.kunci} className={`chip-riwayat ${k.jenis}`} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              #{String(k.id)} {s.katalog[s.order[String(k.id)]?.jenis]?.label ?? ''}{' '}
              {k.jenis === 'selesai' ? (
                <>
                  · {namaToko(s.toko, k.toko)} {k.kerja}s · <b>+{mon(k.payout ?? 0n)}</b> · refund {mon(k.refund ?? 0n)}
                </>
              ) : (
                <>· expired · refund {mon(k.refund ?? 0n)}</>
              )}
            </motion.span>
          ))}
        </AnimatePresence>
      </footer>

      <AliranUang kejadian={s.kejadian} refQR={refQR} refEscrow={refEscrow} refToko={refToko} />

      <AnimatePresence>
        {tampilJuara && (
          <motion.div className="juara" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.4 }}>
              <div className="muted">Fastest shop of session #{s.sesiId}</div>
              <div className="nama-juara">{juara!.nama}</div>
              <div className="omzet-juara">{mon(juara!.omzet)}</div>
              <div className="peringkat">
                {peringkat.map((t, i) => (
                  <div key={t.alamat} className="baris-peringkat">
                    <span>
                      {i + 1}. {t.nama}
                    </span>
                    <b>{mon(t.omzet)}</b>
                  </div>
                ))}
              </div>
              <div className="muted kecil">
                {jmlSelesai} orders done · {jmlKembali} refunded · audience money can only pay a shop or go back to the audience
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

const namaToko = (toko: TokoLive[], a?: string) => toko.find((t) => sama(t.alamat, a))?.nama ?? '';

type Koin = { id: string; x0: number; y0: number; x1: number; y1: number; label?: string; warna: string; delay: number };
const pusat = (el: Element | null | undefined) => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};

/** Flying coins: customer (QR) → escrow on new order; escrow → shop (payout) and → customer (refund) on finish/expire. */
function AliranUang(p: {
  kejadian: Kejadian[];
  refQR: React.RefObject<HTMLElement | null>;
  refEscrow: React.RefObject<HTMLDivElement | null>;
  refToko: React.RefObject<Record<string, HTMLElement | null>>;
}) {
  const [koin, setKoin] = useState<Koin[]>([]);
  const dilihat = useRef(new Set<string>());
  const mulai = useRef(Date.now());

  useEffect(() => {
    const baru: Koin[] = [];
    const semprot = (kunci: string, a: { x: number; y: number } | null, b: { x: number; y: number } | null, label: string, warna: string, jeda = 0) => {
      if (!a || !b) return;
      for (let i = 0; i < 3; i++)
        baru.push({ id: `${kunci}:${warna}:${i}`, x0: a.x, y0: a.y, x1: b.x, y1: b.y, label: i === 0 ? label : undefined, warna, delay: jeda + i * 0.09 });
    };
    for (const k of p.kejadian) {
      if (dilihat.current.has(k.kunci) || k.waktu < mulai.current) continue;
      dilihat.current.add(k.kunci);
      const qr = pusat(p.refQR.current);
      const escrow = pusat(p.refEscrow.current);
      if (k.jenis === 'baru') semprot(k.kunci, qr, escrow, 'pay', 'var(--aksen)');
      if (k.jenis === 'selesai') {
        semprot(k.kunci, escrow, pusat(k.toko ? p.refToko.current[k.toko.toLowerCase()] : null), `+${mon(k.payout ?? 0n)}`, 'var(--ok)');
        if ((k.refund ?? 0n) > 0n) semprot(k.kunci, escrow, qr, `refund ${mon(k.refund ?? 0n)}`, 'var(--kuning)', 0.35);
      }
      if (k.jenis === 'expire') semprot(k.kunci, escrow, qr, `refund ${mon(k.refund ?? 0n)}`, 'var(--kuning)');
    }
    if (baru.length) setKoin((xs) => [...xs, ...baru]);
  }, [p.kejadian, p.refQR, p.refEscrow, p.refToko]);

  return (
    <div className="lapisan-koin">
      {koin.map((c) => {
        const mx = (c.x0 + c.x1) / 2;
        const my = Math.min(c.y0, c.y1) - 120;
        return (
          <motion.div
            key={c.id}
            className="koin"
            style={{ ['--warna' as string]: c.warna }}
            initial={{ x: c.x0, y: c.y0, opacity: 0, scale: 0.5 }}
            animate={{ x: [c.x0, mx, c.x1], y: [c.y0, my, c.y1], opacity: [0, 1, 1], scale: [0.5, 1.15, 0.8] }}
            transition={{ duration: 1.25, delay: c.delay, ease: 'easeInOut' }}
            onAnimationComplete={() => setKoin((xs) => xs.filter((x) => x.id !== c.id))}
          >
            <span className="bulat">M</span>
            {c.label && <span className="label-koin">{c.label}</span>}
          </motion.div>
        );
      })}
    </div>
  );
}

function Stat({ label, nilai, nyala, refEl }: { label: string; nilai: string; nyala?: boolean; refEl?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={refEl} className={`stat ${nyala ? 'nyala' : ''}`}>
      <div className="muted kecil">{label}</div>
      <div className="nilai">{nilai}</div>
    </div>
  );
}

function KartuQR({ refEl }: { refEl?: React.Ref<HTMLElement> }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(URL_PESAN, { type: 'svg', margin: 1, color: { dark: '#141516', light: '#f6f6f5' } }).then(setSvg);
  }, []);
  const lokal = /localhost|127\.0\.0\.1/.test(URL_PESAN);
  return (
    <section ref={refEl} className="kartu-qr">
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <div>
        <b>Scan to order</b>
        <div className="muted kecil">{URL_PESAN.replace(/^https?:\/\//, '')}</div>
        {lokal && <div className="galat kecil">Set VITE_PUBLIC_URL so phones can open it</div>}
      </div>
    </section>
  );
}

function ItemAntre({ o, k, sisa, batas }: { o: Order; k?: Katalog; sisa: number; batas: number }) {
  return (
    <motion.div className="item-antre" layout initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
      <div className="baris">
        <b>{k?.label ?? `Type ${o.jenis}`}</b>
        <span className="harga">{mon(o.harga)}</span>
      </div>
      <div className="teks-kecil">“{o.teks}”</div>
      <div className="bar tipis">
        <div style={{ width: `${Math.max(0, (sisa / batas) * 100)}%` }} />
      </div>
    </motion.div>
  );
}

function PanelToko(p: {
  t: TokoLive;
  urut: number;
  o?: Order;
  katalog: Record<number, Katalog>;
  feeBps: number;
  now: number;
  kejadian: Kejadian[];
  refEl: (el: HTMLElement | null) => void;
  unggul: boolean;
}) {
  const { t, o, now } = p;
  const aktif = o && o.status === 'Claimed' ? o : undefined;
  const kerja = aktif ? Math.max(0, now - aktif.diclaimPada) : 0;
  const kotor = aktif ? hitungPayout(aktif.harga, aktif.batasKerja, kerja) : 0n;
  const payout = payoutBersih(kotor, p.feeBps); // what the shop receives (v2.1: after platform fee)
  const frac = aktif ? Number((kotor * 1000n) / aktif.harga) / 1000 : 0;
  const kodeSekarang = aktif ? aktif.langkah[Math.min(aktif.langkahSelesai, aktif.langkah.length - 1)] : 0;
  const kilatan = p.kejadian.filter((k) => k.jenis === 'selesai' && sama(k.toko, t.alamat) && Date.now() - k.waktu < 3500);

  return (
    <article ref={p.refEl} className={`panel-toko ${p.unggul ? 'unggul' : ''}`}>
      <header>
        <div className="nama-toko">{t.nama}</div>
        <div className="omzet">
          <span className="muted kecil">Revenue</span>
          <motion.span key={String(t.omzet)} initial={{ y: -14, opacity: 0, color: '#5fd39a' }} animate={{ y: 0, opacity: 1, color: '#231e16' }} transition={{ duration: 0.8 }}>
            {mon(t.omzet)}
          </motion.span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {aktif ? (
          <motion.div key={String(aktif.id)} className="order-aktif" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="muted kecil">
              #{String(aktif.id)} · {p.katalog[aktif.jenis]?.label}
            </div>
            <div className="baris-kerja">
              <div className="kertas">“{aktif.teks}”</div>
              <MesinFigur key={kodeSekarang} kode={kodeSekarang} jalan={kerja < aktif.batasKerja} />
            </div>
            <div className="langkah">
              {aktif.langkah.map((l, i) => (
                <span key={i} className={i < aktif.langkahSelesai ? 'done' : i === aktif.langkahSelesai ? 'now' : ''}>
                  {i < aktif.langkahSelesai ? '✓ ' : ''}
                  {NAMA_LANGKAH[l]}
                </span>
              ))}
            </div>
            <div className="payout">
              {kerja >= aktif.batasKerja ? (
                <span className="angka-payout telat">Time's up · money back to customer</span>
              ) : (
                <>
                  <span className="muted kecil">Payout if done now</span>
                  <span className="angka-payout">{mon(payout, 5)}</span>
                </>
              )}
              {kerja < aktif.batasKerja && (
                <>
                  <div className="bar tebal">
                    <div style={{ width: `${frac * 100}%` }} />
                  </div>
                  <span className="muted kecil">
                    {kerja} / {aktif.batasKerja}s · the rest goes back to the customer
                  </span>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="kosong" className="order-kosong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Waiting for an order…
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {kilatan.map((k) => (
          <motion.div
            key={k.kunci}
            className="kilatan"
            initial={{ opacity: 0, y: 40, scale: 0.8 }}
            animate={{ opacity: 1, y: -30, scale: 1 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ duration: 0.9 }}
          >
            +{mon(k.payout ?? 0n)}
            <span className="kecil"> · back to customer {mon(k.refund ?? 0n)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </article>
  );
}
