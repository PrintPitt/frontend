// /toko — print shop owner dashboard (BLZ-10, BLZ-22.T4): radar of orders within the shop radius, claim, work, hand over via QR.
// Anvil: /toko?dev=1 (Shop A) or /toko?dev=2 (Shop B). Testnet: the passkey address must be registered by the operator (registerShop).
// v2.1 (real print shops): shop location → radius feed from the backend (1.5 km; Shop Pro 3 km), download order document,
// steps marked manually, Siap order → scan customer QR → `serahkan`. Mini-game orders (kodeHash 0) work as before.
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRupiah, hitungPayout } from '../../../shared/src/index.ts';
import DaftarToko from '../components/DaftarToko';
import PindaiQr from '../components/PindaiQr';
import Fotokopi from '../game/Fotokopi';
import '../game/game.css';
import Laminating from '../game/Laminating';
import Print from '../game/Print';
import { sfx } from '../game/sfx';
import type { PropsMiniGame } from '../game/tipe';
import { akunAktif, akunBurner, masuk, pakaiAkun, type Akun } from '../lib/akun';
import { mon, NAMA_LANGKAH, pendek, ZERO } from '../lib/format';
import { NAMA } from '../lib/merek';
import { pindah } from '../lib/navigasi';
import { ambilFeed, infoDokumen, kirimLokasiToko, lokasiPerangkat, unduhDokumen, type Feed } from '../lib/backend';
import { payoutBersih, type Katalog, type Order } from '../lib/katalog';
import { bacaLive, useJamChain, useLive } from '../lib/live';
import { bacaPro, langgananPro, tanggalPro, type InfoPro } from '../lib/pro';
import { bacaQr, cocok } from '../lib/serah';
import { kirim, kirimLangkah, pesanError } from '../lib/tx';

const MINIGAME: Record<number, (p: PropsMiniGame) => React.JSX.Element> = { 1: Fotokopi, 2: Print, 3: Laminating };
const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
/** Real document order (not a mini-game): has a file or a handover code. */
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
  // radius feed from the backend + highest order id when the feed was fetched (newer orders not yet indexed: still shown)
  const [feed, setFeed] = useState<{ f: Feed; batas: bigint } | null>(null);
  const [pro, setPro] = useState<InfoPro | null>(null);
  const [alatJalan, setAlatJalan] = useState('');
  const [pindai, setPindai] = useState(false);
  const [halamanFile, setHalamanFile] = useState<Record<string, number>>({});
  const [sorot, setSorot] = useState<bigint | null>(null);
  // incoming-order notification like a driver app: one pop-up card per new order within the radius
  const [notif, setNotif] = useState<bigint | null>(null);
  const sudahNotif = useRef(new Set<string>());

  const tampil = useCallback((t: Toast, ms = 2400) => {
    setToast(t);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    const a = akunAktif();
    if (a) setAkun(a);
    else if (new URLSearchParams(location.search).has('dev')) masuk().then(setAkun);
  }, []);

  // Play a "ding" when a new order comes in.
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
    // shop location set → only orders within the radius (+ orders without a location / not yet indexed by the backend)
    .filter((o) => !dalamFeed || dalamFeed.has(String(o.id)) || o.id > feed!.batas)
    .sort((a, b) => a.dibuatPada - b.dibuatPada);
  const siapSerah = akun ? Object.values(s.order).filter((o) => o.status === 'Siap' && sama(o.toko, akun.address)) : [];

  // Radius feed (backend) is polled slowly; live orders still come from chain events so claiming is not delayed by indexing.
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
        /* backend down: show all orders from the chain */
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

  // Page estimate from the file (backend) to compare with the paid page count, before claiming (BLZ-22.T4).
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

  // New order within the radius → pop-up (once per order), only while the shop is idle.
  useEffect(() => {
    if (!saya || kerjaAktif || notif !== null) return;
    const baru = antre.find((o) => !sudahNotif.current.has(String(o.id)) && now - o.dibuatPada < s.batasAntre - 5);
    if (!baru) return;
    sudahNotif.current.add(String(baru.id));
    setNotif(baru.id);
  }, [antre, saya, kerjaAktif, notif, now, s.batasAntre]);
  const orderNotif = notif !== null ? antre.find((o) => o.id === notif) : undefined;
  useEffect(() => {
    if (notif !== null && !orderNotif) setNotif(null); // taken by another shop / expired
  }, [notif, orderNotif]);

  async function aturLokasi() {
    if (!akun) return;
    setAlatJalan('lokasi');
    try {
      const r = await kirimLokasiToko(akun, await lokasiPerangkat());
      tampil({ teks: `Shop location saved · order radius ${r.radiusKm} km`, jenis: 'ok' });
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
      await langgananPro(akun, 1, pro.hargaPro);
      setPro(await bacaPro(akun.address));
      tampil({ teks: 'Shop Pro active for 30 days · order radius 3 km', jenis: 'ok' });
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
    if (!q) return tampil({ teks: 'This QR is not a PrintPitt handover code', jenis: 'kalah' });
    if (!o) return tampil({ teks: `QR is for order #${q.orderId}, not a ready order from your shop`, jenis: 'kalah' });
    if (!cocok(q.rahasia, o.kodeHash)) return tampil({ teks: 'QR does not match this order', jenis: 'kalah' });
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
      tampil({ teks: `Order #${id} is yours! Get it done fast`, jenis: 'ok' });
    } catch (e) {
      sfx('kalah');
      const pesan = pesanError(e);
      const o = bacaLive().order[String(id)];
      const nama = o && o.toko !== ZERO ? bacaLive().toko.find((t) => sama(t.alamat, o.toko))?.nama : undefined;
      // lib/tx.ts still returns Indonesian text for AlreadyClaimed: compare it, but display English
      tampil({ teks: pesan === 'Diambil toko lain' ? (nama ? `Too slow! Taken by ${nama}` : 'Taken by another shop') : pesan, jenis: 'kalah' });
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
      setAkun(burner ? pakaiAkun(akunBurner()) : await masuk());
    } catch {
      tampil({ teks: 'Passkey cancelled', jenis: 'info' });
    } finally {
      setMasukJalan(false);
    }
  }

  if (!akun)
    return (
      <main className="pesan">
        <header className="pesan-head">
          <div className="brand">{NAMA} · Shop</div>
        </header>
        <section className="kartu mulai">
          <h2>Print shop dashboard</h2>
          <p className="muted">Print orders from customers near your shop arrive in real time. Claim, print, hand over via QR, get paid instantly.</p>
          <button className="tombol utama besar" disabled={masukJalan} onClick={() => pindah('/masuk?ke=/toko', false)}>
            Sign in / sign up
          </button>
          <button className="tautan" disabled={masukJalan} onClick={() => mulai(true)}>
            Try as guest
          </button>
        </section>
        {toast && <p className="galat">{toast.teks}</p>}
      </main>
    );

  const radiusKm = feed?.f.radiusKm ?? (pro && pro.proSampai > now ? 3 : 1.5);
  const tanpaLokasi = antre.filter((o) => dalamFeed?.get(String(o.id))?.jarakKm == null).length;

  return (
    <main className="toko dasbor">
      <header className="dasbor-head">
        <div>
          <div className="brand">{saya?.nama ?? 'Shop not registered'}</div>
          <div className="muted kecil">
            {pendek(akun.address)} · {s.sesiAktif ? <b className="online">● open, accepting orders</b> : 'session not open yet'}
          </div>
        </div>
        <div className="dasbor-stat">
          <div className="stat-kecil">
            <span>Session revenue</span>
            <motion.b key={String(saya?.omzet ?? 0n)} initial={{ scale: 1.3, color: '#5fd39a' }} animate={{ scale: 1, color: '#231e16' }}>
              {mon(saya?.omzet ?? 0n)}
            </motion.b>
          </div>
          <div className="stat-kecil">
            <span>Nearby orders</span>
            <b>{antre.length}</b>
          </div>
          <div className="stat-kecil">
            <span>Ready for pickup</span>
            <b>{siapSerah.length}</b>
          </div>
          {pro && pro.proSampai > now && <span className="badge-pro">★ PRO until {tanggalPro(pro.proSampai)}</span>}
        </div>
      </header>

      {s.siap && !saya && (
        <div className="kartu kecil">
          This address has no shop yet. Register now (free, directly on the contract):
          <DaftarToko akun={akun} />
        </div>
      )}
      {s.siap && !s.sesiAktif && <div className="kartu muted kecil">The operator has not opened the session yet: new orders can't be claimed.</div>}
      {s.galat && <div className="banner-galat">RPC: {s.galat}</div>}

      <div className="dasbor-isi">
        <section className="dasbor-kiri">
          <div className="kartu kartu-radar">
            <div className="judul-kartu">
              <b>Orders near your shop</b>
              <span className="muted kecil">{feed?.f.toko ? `radius ${radiusKm} km` : 'shop location not set'}</span>
            </div>
            <Radar
              radiusKm={radiusKm}
              adaLokasi={!!feed?.f.toko}
              titik={antre.flatMap((o) => {
                const j = dalamFeed?.get(String(o.id))?.jarakKm;
                return j == null ? [] : [{ id: o.id, jarakKm: j, label: s.katalog[o.jenis]?.label ?? '', nyata: orderNyata(o) }]
              })}
              sorot={sorot}
              onPilih={(id) => {
                setSorot(id);
                document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
            />
            <div className="baris-alat">
              {saya && (
                <button className="tombol" disabled={!!alatJalan} onClick={aturLokasi}>
                  📍 {alatJalan === 'lokasi' ? 'Reading location…' : feed?.f.toko ? 'Update shop location' : 'Set shop location'}
                </button>
              )}
              {saya && pro && pro.proSampai <= now && pro.hargaPro > 0n && (
                <button className="tombol" disabled={!!alatJalan} onClick={langganan} title="3 km order radius, paid in tIDRX from the shop balance">
                  {alatJalan === 'pro' ? 'Processing…' : `★ Pro: 3 km radius · ${formatRupiah(pro.hargaPro)}/30 days`}
                </button>
              )}
              {tanpaLokasi > 0 && <span className="muted kecil">+{tanpaLokasi} demo orders without location</span>}
            </div>
          </div>

          <div className="daftar-order">
            <AnimatePresence initial={false}>
              {antre.map((o) => {
                const f = dalamFeed?.get(String(o.id));
                const sisa = Math.max(0, s.batasAntre - (now - o.dibuatPada));
                return (
                  <motion.div
                    key={String(o.id)}
                    id={`order-${o.id}`}
                    layout
                    className={`kartu-order ${sorot === o.id ? 'sorot' : ''} ${orderNyata(o) ? 'nyata' : 'demo'}`}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onMouseEnter={() => setSorot(o.id)}
                  >
                    <div className="isi-order">
                      <div className="baris-judul-order">
                        <b>{s.katalog[o.jenis]?.label}</b>
                        <span className="harga-order">{mon(o.harga)}</span>
                      </div>
                      <div className="teks-kecil">“{o.teks}”</div>
                      <div className="chip-order">
                        {f?.jarakKm != null ? <span>📍 {f.jarakKm} km</span> : <span className="muted">demo</span>}
                        <span>{o.langkah.map((l) => NAMA_LANGKAH[l]).join(' → ')}</span>
                        {orderNyata(o) && <span>📄 {o.halaman} pp{halamanFile[String(o.id)] ? ` (file ±${halamanFile[String(o.id)]})` : ''}</span>}
                        {BigInt(o.kodeHash) !== 0n && <span>🔐 QR</span>}
                        <span>⏱ max {o.batasKerja}s</span>
                      </div>
                      <div className="bar tipis">
                        <div style={{ width: `${(sisa / s.batasAntre) * 100}%` }} />
                      </div>
                      <span className="muted kecil">{sisa}s left before it expires</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className="tombol utama tombol-rebut"
                      disabled={!saya || !!kerjaAktif || rebut !== null}
                      onClick={() => claim(o.id)}
                    >
                      {rebut === o.id ? '…' : kerjaAktif ? 'Busy' : 'Claim'}
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {antre.length === 0 && <p className="muted kosong-order">{s.siap ? 'No orders near you yet. You will hear a ding when one comes in.' : 'Connecting…'}</p>}
          </div>
        </section>

        <section className="dasbor-kanan">
          <div className="kartu kartu-kerja">
            <div className="judul-kartu">
              <b>In progress</b>
              {kerjaAktif && <span className="muted kecil">#{String(kerjaAktif.id)}</span>}
            </div>
            {kerjaAktif ? (
              <Runner
                key={String(kerjaAktif.id)}
                akun={akun}
                o={kerjaAktif}
                k={s.katalog[kerjaAktif.jenis]}
                feeBps={s.feeBps}
                now={now}
                onSelesai={selesai}
                onSiap={() => tampil({ teks: 'Ready! Ask the customer to show their QR, then scan it', jenis: 'ok' }, 4000)}
                onUnduh={unduh}
                onGalat={galat}
              />
            ) : hasil ? (
              <motion.div className="hasil" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="muted">{hasil.label} done in {hasil.kerja}s</div>
                <div className="angka-hasil">+{mon(hasil.payout, 5)}</div>
                <div className="muted">Refund to customer {mon(hasil.refund, 5)} · NFT sent · platform fee {s.feeBps / 100}%</div>
              </motion.div>
            ) : (
              <div className="meja-kosong">{saya ? 'No order yet. Claim the nearest order on the left.' : 'Waiting for shop registration'}</div>
            )}
          </div>

          <div className="kartu kartu-siap">
            <div className="judul-kartu">
              <b>Ready for customer pickup</b>
              <button className="tombol utama" disabled={!!alatJalan || siapSerah.length === 0} onClick={() => setPindai(true)}>
                📷 Scan customer QR
              </button>
            </div>
            {siapSerah.length === 0 ? (
              <p className="muted kecil">Finished orders wait here until the customer arrives and shows their QR.</p>
            ) : (
              siapSerah.map((o) => (
                <div key={String(o.id)} className="baris-siap">
                  <span>
                    <b>#{String(o.id)}</b> · {s.katalog[o.jenis]?.label} · “{o.teks}” · payout locked{' '}
                    <b>{mon(payoutBersih(hitungPayout(o.harga, o.batasKerja, o.kerja), s.feeBps))}</b>
                  </span>
                  {BigInt(o.dokumen) !== 0n && (
                    <button className="tautan inline" onClick={() => unduh(o)}>
                      download document
                    </button>
                  )}
                  {alatJalan === `serah-${o.id}` && <span className="muted"> handing over…</span>}
                </div>
              ))
            )}
          </div>

          <div className="kartu kartu-info kecil">
            <b>How your payout works</b>
            <span>Your payout drops every second from claim until the order is ready. The rest goes back to the customer as cashback.</span>
            <span>Funds are released when the customer's QR is scanned. The {s.feeBps / 100}% platform fee applies only to completed orders.</span>
          </div>
        </section>
      </div>

      {pindai && <PindaiQr onHasil={serahkan} onTutup={() => setPindai(false)} />}
      <AnimatePresence>
        {orderNotif && (
          <motion.div className="notif-order" initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: 'spring', bounce: 0.35 }}>
            <div className="notif-kepala">
              <b>🔔 New order nearby!</b>
              <span className="notif-hitung">{Math.max(0, s.batasAntre - (now - orderNotif.dibuatPada))}s</span>
            </div>
            <div className="notif-isi">
              <div className="notif-jarak">{dalamFeed?.get(String(orderNotif.id))?.jarakKm != null ? `${dalamFeed.get(String(orderNotif.id))!.jarakKm} km` : 'demo'}</div>
              <div>
                <b>{s.katalog[orderNotif.jenis]?.label}</b>
                <div className="teks-kecil">“{orderNotif.teks}”</div>
                <div className="muted kecil">
                  {orderNotif.langkah.map((l) => NAMA_LANGKAH[l]).join(' → ')}
                  {orderNyata(orderNotif) && ` · ${orderNotif.halaman} pp`}
                </div>
              </div>
              <div className="notif-harga">{mon(orderNotif.harga)}</div>
            </div>
            <div className="bar tipis">
              <div style={{ width: `${Math.max(0, ((s.batasAntre - (now - orderNotif.dibuatPada)) / s.batasAntre) * 100)}%` }} />
            </div>
            <div className="notif-tombol">
              <button className="tombol" onClick={() => setNotif(null)}>
                Skip
              </button>
              <button
                className="tombol utama"
                disabled={rebut !== null}
                onClick={() => {
                  const id = orderNotif.id;
                  setNotif(null);
                  void claim(id);
                }}
              >
                {rebut === orderNotif.id ? '…' : 'Claim order'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

/** Shop radius radar: shop in the center, orders as dots by distance (angle derived from id so it stays stable). */
function Radar(p: { radiusKm: number; adaLokasi: boolean; titik: { id: bigint; jarakKm: number; label: string; nyata: boolean }[]; sorot: bigint | null; onPilih: (id: bigint) => void }) {
  const R = 130;
  const cincin = [0.33, 0.66, 1];
  return (
    <div className="radar">
      <svg viewBox="-150 -150 300 300" role="img" aria-label={`Order radar, ${p.radiusKm} km radius`}>
        <circle r={R + 6} fill="#efe8fd" stroke="#231e16" strokeWidth={3} />
        {cincin.map((c) => (
          <circle key={c} r={R * c} fill="none" stroke="#836ef9" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="5 6" />
        ))}
        {cincin.map((c) => (
          <text key={`t${c}`} x={4} y={-R * c + 14} className="label-radar">
            {(p.radiusKm * c).toLocaleString('en-US', { maximumFractionDigits: 1 })} km
          </text>
        ))}
        <g className="sapu-radar">
          <path d={`M0 0 L${R} 0 A${R} ${R} 0 0 0 ${R * Math.cos(-0.6)} ${R * Math.sin(-0.6)} Z`} fill="#836ef9" opacity={0.18} />
        </g>
        {p.titik.map((t) => {
          const sudut = ((Number(t.id % 997n) * 137.5) % 360) * (Math.PI / 180);
          const r = Math.min(1, t.jarakKm / p.radiusKm) * R;
          const x = Math.cos(sudut) * r;
          const y = Math.sin(sudut) * r;
          const aktif = p.sorot === t.id;
          return (
            <g key={String(t.id)} transform={`translate(${x} ${y})`} onClick={() => p.onPilih(t.id)} style={{ cursor: 'pointer' }}>
              <circle r={aktif ? 16 : 12} className="denyut" fill={t.nyata ? '#f4b829' : '#5fd39a'} opacity={0.35} />
              <circle r={aktif ? 9 : 7} fill={t.nyata ? '#f4b829' : '#5fd39a'} stroke="#231e16" strokeWidth={2.5} />
              {aktif && (
                <text y={-16} textAnchor="middle" className="label-titik">
                  #{String(t.id)} · {t.jarakKm} km
                </text>
              )}
            </g>
          );
        })}
        <circle r={14} fill="#836ef9" stroke="#231e16" strokeWidth={3} />
        <text y={5} textAnchor="middle" fontSize={14}>
          🏪
        </text>
      </svg>
      {!p.adaLokasi && <div className="radar-kosong">Set your shop location so only orders within the radius come in</div>}
    </div>
  );
}

/** Runs the recipe: one mini-game per step; each pass → completeStep (tx runs while the next step is played). */
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
  // real document order: steps are done on a real machine and marked with a button (not a mini-game)
  const Game = nyata ? undefined : MINIGAME[o.langkah[idx]];

  const lulus = useCallback(async () => {
    if (sudah.current.has(idx)) return;
    sudah.current.add(idx);
    const kode = o.langkah[idx];
    const terakhir = idx === n - 1;
    if (terakhir) setMenyimpan(true);
    else setIdx(idx + 1);
    try {
      const r = await kirimLangkah(p.akun, o.id, kode); // wait/retry briefly if the RPC lags behind after claim
      setTercatat((t) => [...t, idx]);
      const ev = r.events.find((e) => e.eventName === 'OrderFinished');
      if (ev)
        p.onSelesai({ payout: ev.args.payout as bigint, refund: ev.args.refund as bigint, kerja: Number(ev.args.kerja), label: p.k?.label ?? '' });
      else if (r.events.some((e) => e.eventName === 'OrderReady')) p.onSiap();
    } catch (e) {
      p.onGalat(pesanError(e));
      sudah.current.delete(idx);
      setMenyimpan(false);
      setIdx(idx); // retry the step that failed to record
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
              {o.halaman} pages
              {BigInt(o.dokumen) !== 0n && (
                <>
                  {' · '}
                  <button className="tautan inline" onClick={() => p.onUnduh(o)}>
                    download document
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
          <span className="muted kecil">Your payout if you finish now</span>
          <span className="angka-payout">{mon(payout, 5)}</span>
          <div className="bar tebal">
            <div style={{ width: `${frac * 100}%` }} />
          </div>
          <span className="muted kecil">
            {kerja} / {o.batasKerja}s · the rest goes back to the customer · net of platform fee
          </span>
        </div>
      </div>
      {telat ? (
        <div className="meja-kosong telat">Time's up! Full refund to the customer.</div>
      ) : menyimpan ? (
        <div className="meja-kosong">Recording the final step on Monad…</div>
      ) : Game ? (
        <Game key={`${String(o.id)}-${idx}`} teks={o.teks} label={p.k?.label ?? ''} onLulus={lulus} />
      ) : nyata && idx < n ? (
        <div className="meja-kosong">
          <button className="tombol utama besar" onClick={lulus}>
            ✓ {NAMA_LANGKAH[o.langkah[idx]]} done
          </button>
          {idx === n - 1 && BigInt(o.kodeHash) !== 0n && <p className="muted kecil">After this the order is ready: payout locked, funds released when the customer's QR is scanned.</p>}
        </div>
      ) : null}
    </div>
  );
}
