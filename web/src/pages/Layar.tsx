// /layar — layar proyektor (BLZ-12): antrean, dua toko live, omzet, payout yang turun tiap detik, uang mengalir, pemenang, QR.
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hitungPayout } from '../../../shared/src/index.ts';
import MesinFigur from '../components/MesinFigur';
import { sfx } from '../game/sfx';
import { mon, NAMA_LANGKAH } from '../lib/format';
import { NAMA } from '../lib/merek';
import type { Katalog, Order } from '../lib/katalog';
import { useJamChain, useLive, type Kejadian, type TokoLive } from '../lib/live';

const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const URL_PESAN = `${(import.meta.env.VITE_PUBLIC_URL || location.origin).replace(/\/+$/, '')}/pesan`;

export default function Layar() {
  const s = useLive();
  const now = Math.floor(useJamChain(s.offset));
  const refToko = useRef<Record<string, HTMLElement | null>>({});
  const refQR = useRef<HTMLElement | null>(null);
  const refEscrow = useRef<HTMLDivElement | null>(null);
  const terakhir = useRef<string | undefined>(undefined);
  const [suara, setSuara] = useState(false); // browser butuh satu klik sebelum audio boleh bunyi
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

  // Confetti di atas toko yang baru menyelesaikan order.
  useEffect(() => {
    const k = s.kejadian.find((x) => x.jenis === 'selesai');
    if (!k || k.kunci === terakhir.current) return;
    terakhir.current = k.kunci;
    if (k.waktu === 0) return; // riwayat dari snapshot, bukan kejadian baru
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
          <div className="muted">Rebutan order on Monad · makin kilat, makin cuan</div>
        </div>
        <div className="statistik">
          <button
            className={`tombol-suara ${suara ? 'nyala' : ''}`}
            onClick={() => {
              setSuara((v) => !v);
              if (!suara) sfx('ding');
            }}
            title="Suara layar"
          >
            {suara ? '🔊' : '🔈'}
          </button>
          <Stat label="Sesi" nilai={s.sesiId ? `#${s.sesiId} ${s.sesiAktif ? 'BUKA' : 'TUTUP'}` : '—'} nyala={s.sesiAktif} />
          <Stat label="Order selesai" nilai={String(jmlSelesai)} />
          <Stat label="Di escrow" nilai={`${mon(escrow)} MON`} refEl={refEscrow} />
        </div>
      </header>

      {s.galat && <div className="banner-galat">RPC: {s.galat}</div>}

      <div className="layar-isi">
        <aside className="kolom-kiri">
          <KartuQR refEl={refQR} />
          <section className="antrean">
            <h3 className="judul-bagian">
              Antrean <span className="muted">{antre.length}</span>
            </h3>
            <AnimatePresence initial={false}>
              {antre.map((o) => (
                <ItemAntre key={String(o.id)} o={o} k={s.katalog[o.jenis]} sisa={s.batasAntre - (now - o.dibuatPada)} batas={s.batasAntre} />
              ))}
            </AnimatePresence>
            {antre.length === 0 && <p className="muted kosong">{s.siap ? 'Belum ada order. Scan QR untuk pesan!' : 'Menyambung ke chain…'}</p>}
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
              now={now}
              kejadian={s.kejadian}
              refEl={(el) => (refToko.current[t.alamat.toLowerCase()] = el)}
              unggul={!!juara && juara.omzet > 0n && sama(juara.alamat, t.alamat)}
            />
          ))}
        </section>
      </div>

      <footer className="riwayat">
        <span className="muted">Riwayat</span>
        <AnimatePresence initial={false}>
          {riwayat.map((k) => (
            <motion.span key={k.kunci} className={`chip-riwayat ${k.jenis}`} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              #{String(k.id)} {s.katalog[s.order[String(k.id)]?.jenis]?.label ?? ''}{' '}
              {k.jenis === 'selesai' ? (
                <>
                  · {namaToko(s.toko, k.toko)} {k.kerja} dtk · <b>+{mon(k.payout ?? 0n)}</b> · kembali {mon(k.refund ?? 0n)}
                </>
              ) : (
                <>· kedaluwarsa · refund {mon(k.refund ?? 0n)}</>
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
              <div className="muted">Toko terkilat sesi #{s.sesiId}</div>
              <div className="nama-juara">{juara!.nama}</div>
              <div className="omzet-juara">{mon(juara!.omzet)} MON</div>
              <div className="peringkat">
                {peringkat.map((t, i) => (
                  <div key={t.alamat} className="baris-peringkat">
                    <span>
                      {i + 1}. {t.nama}
                    </span>
                    <b>{mon(t.omzet)} MON</b>
                  </div>
                ))}
              </div>
              <div className="muted kecil">
                {jmlSelesai} order selesai · {jmlKembali} dana dikembalikan · uang penonton hanya bisa jadi bayaran toko atau kembali ke penonton
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

/** Koin terbang: pelanggan (QR) → escrow saat order masuk; escrow → toko (bayaran) dan → pelanggan (refund) saat selesai/expire. */
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
      if (k.jenis === 'baru') semprot(k.kunci, qr, escrow, 'bayar', 'var(--aksen)');
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
        <b>Scan untuk pesan</b>
        <div className="muted kecil">{URL_PESAN.replace(/^https?:\/\//, '')}</div>
        {lokal && <div className="galat kecil">Set VITE_PUBLIC_URL supaya HP bisa membuka</div>}
      </div>
    </section>
  );
}

function ItemAntre({ o, k, sisa, batas }: { o: Order; k?: Katalog; sisa: number; batas: number }) {
  return (
    <motion.div className="item-antre" layout initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
      <div className="baris">
        <b>{k?.label ?? `Jenis ${o.jenis}`}</b>
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
  now: number;
  kejadian: Kejadian[];
  refEl: (el: HTMLElement | null) => void;
  unggul: boolean;
}) {
  const { t, o, now } = p;
  const aktif = o && o.status === 'Claimed' ? o : undefined;
  const kerja = aktif ? Math.max(0, now - aktif.diclaimPada) : 0;
  const payout = aktif ? hitungPayout(aktif.harga, aktif.batasKerja, kerja) : 0n;
  const frac = aktif ? Number((payout * 1000n) / aktif.harga) / 1000 : 0;
  const kodeSekarang = aktif ? aktif.langkah[Math.min(aktif.langkahSelesai, aktif.langkah.length - 1)] : 0;
  const kilatan = p.kejadian.filter((k) => k.jenis === 'selesai' && sama(k.toko, t.alamat) && Date.now() - k.waktu < 3500);

  return (
    <article ref={p.refEl} className={`panel-toko ${p.unggul ? 'unggul' : ''}`}>
      <header>
        <div className="nama-toko">{t.nama}</div>
        <div className="omzet">
          <span className="muted kecil">Omzet</span>
          <motion.span key={String(t.omzet)} initial={{ y: -14, opacity: 0, color: '#5fd39a' }} animate={{ y: 0, opacity: 1, color: '#e9eaea' }} transition={{ duration: 0.8 }}>
            {mon(t.omzet)} MON
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
                <span className="angka-payout telat">Waktu habis · dana kembali ke pelanggan</span>
              ) : (
                <>
                  <span className="muted kecil">Bayaran kalau selesai sekarang</span>
                  <span className="angka-payout">{mon(payout, 5)} MON</span>
                </>
              )}
              {kerja < aktif.batasKerja && (
                <>
                  <div className="bar tebal">
                    <div style={{ width: `${frac * 100}%` }} />
                  </div>
                  <span className="muted kecil">
                    {kerja} / {aktif.batasKerja} dtk · sisanya kembali ke pelanggan
                  </span>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="kosong" className="order-kosong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            Menunggu rebutan order…
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
            +{mon(k.payout ?? 0n)} MON
            <span className="kecil"> · kembali ke pelanggan {mon(k.refund ?? 0n)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </article>
  );
}
