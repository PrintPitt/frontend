// /toko — dashboard pemilik fotokopi (BLZ-10, BLZ-22.T4): radar order dalam radius toko, ambil (claim), kerjakan, serahkan pakai QR.
// Anvil: /toko?dev=1 (Toko A) atau /toko?dev=2 (Toko B). Testnet: alamat passkey harus didaftarkan operator (registerShop).
// v2.1 (toko fotokopi nyata): lokasi toko → feed radius dari backend (1,5 km; Toko Pro 3 km), unduh dokumen order,
// langkah ditandai manual, order Siap → pindai QR pelanggan → `serahkan`. Order mini-game (kodeHash 0) tetap seperti dulu.
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
  const [pro, setPro] = useState<InfoPro | null>(null);
  const [alatJalan, setAlatJalan] = useState('');
  const [pindai, setPindai] = useState(false);
  const [halamanFile, setHalamanFile] = useState<Record<string, number>>({});
  const [sorot, setSorot] = useState<bigint | null>(null);
  // notifikasi order masuk ala aplikasi driver: satu kartu pop-up per order baru dalam radius
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

  // Order baru dalam radius → pop-up (sekali per order), hanya saat toko sedang tidak mengerjakan apa-apa.
  useEffect(() => {
    if (!saya || kerjaAktif || notif !== null) return;
    const baru = antre.find((o) => !sudahNotif.current.has(String(o.id)) && now - o.dibuatPada < s.batasAntre - 5);
    if (!baru) return;
    sudahNotif.current.add(String(baru.id));
    setNotif(baru.id);
  }, [antre, saya, kerjaAktif, notif, now, s.batasAntre]);
  const orderNotif = notif !== null ? antre.find((o) => o.id === notif) : undefined;
  useEffect(() => {
    if (notif !== null && !orderNotif) setNotif(null); // sudah diambil toko lain / hangus
  }, [notif, orderNotif]);

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
      await langgananPro(akun, 1, pro.hargaPro);
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
      setAkun(burner ? pakaiAkun(akunBurner()) : await masuk());
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
          <h2>Dashboard toko fotokopi</h2>
          <p className="muted">Order cetak dari pelanggan di sekitar tokomu masuk real-time. Rebut, kerjakan, serahkan pakai QR, uang langsung masuk.</p>
          <button className="tombol utama besar" disabled={masukJalan} onClick={() => pindah('/masuk?ke=/toko', false)}>
            Masuk / daftar
          </button>
          <button className="tautan" disabled={masukJalan} onClick={() => mulai(true)}>
            Coba sebagai tamu
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
          <div className="brand">{saya?.nama ?? 'Toko belum terdaftar'}</div>
          <div className="muted kecil">
            {pendek(akun.address)} · {s.sesiAktif ? <b className="online">● buka, menerima order</b> : 'sesi belum dibuka'}
          </div>
        </div>
        <div className="dasbor-stat">
          <div className="stat-kecil">
            <span>Omzet sesi</span>
            <motion.b key={String(saya?.omzet ?? 0n)} initial={{ scale: 1.3, color: '#5fd39a' }} animate={{ scale: 1, color: '#231e16' }}>
              {mon(saya?.omzet ?? 0n)}
            </motion.b>
          </div>
          <div className="stat-kecil">
            <span>Order di sekitar</span>
            <b>{antre.length}</b>
          </div>
          <div className="stat-kecil">
            <span>Siap diambil</span>
            <b>{siapSerah.length}</b>
          </div>
          {pro && pro.proSampai > now && <span className="badge-pro">★ PRO s.d. {tanggalPro(pro.proSampai)}</span>}
        </div>
      </header>

      {s.siap && !saya && (
        <div className="kartu kecil">
          Alamat ini belum punya toko. Daftarkan sekarang (gratis, langsung di contract):
          <DaftarToko akun={akun} />
        </div>
      )}
      {s.siap && !s.sesiAktif && <div className="kartu muted kecil">Sesi belum dibuka operator: order baru belum bisa direbut.</div>}
      {s.galat && <div className="banner-galat">RPC: {s.galat}</div>}

      <div className="dasbor-isi">
        <section className="dasbor-kiri">
          <div className="kartu kartu-radar">
            <div className="judul-kartu">
              <b>Order di sekitar tokomu</b>
              <span className="muted kecil">{feed?.f.toko ? `radius ${radiusKm} km` : 'lokasi toko belum diatur'}</span>
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
                  📍 {alatJalan === 'lokasi' ? 'Membaca lokasi…' : feed?.f.toko ? 'Perbarui lokasi toko' : 'Atur lokasi toko'}
                </button>
              )}
              {saya && pro && pro.proSampai <= now && pro.hargaPro > 0n && (
                <button className="tombol" disabled={!!alatJalan} onClick={langganan} title="Radius feed 3 km, dibayar tIDRX dari saldo toko">
                  {alatJalan === 'pro' ? 'Memproses…' : `★ Pro: radius 3 km · ${formatRupiah(pro.hargaPro)}/30 hari`}
                </button>
              )}
              {tanpaLokasi > 0 && <span className="muted kecil">+{tanpaLokasi} order demo tanpa lokasi</span>}
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
                        {orderNyata(o) && <span>📄 {o.halaman} hlm{halamanFile[String(o.id)] ? ` (file ±${halamanFile[String(o.id)]})` : ''}</span>}
                        {BigInt(o.kodeHash) !== 0n && <span>🔐 QR</span>}
                        <span>⏱ maks. {o.batasKerja} dtk</span>
                      </div>
                      <div className="bar tipis">
                        <div style={{ width: `${(sisa / s.batasAntre) * 100}%` }} />
                      </div>
                      <span className="muted kecil">{sisa} dtk lagi sebelum hangus</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className="tombol utama tombol-rebut"
                      disabled={!saya || !!kerjaAktif || rebut !== null}
                      onClick={() => claim(o.id)}
                    >
                      {rebut === o.id ? '…' : kerjaAktif ? 'Sibuk' : 'Ambil'}
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {antre.length === 0 && <p className="muted kosong-order">{s.siap ? 'Belum ada order di sekitarmu. Notif berbunyi saat ada yang masuk.' : 'Menyambung…'}</p>}
          </div>
        </section>

        <section className="dasbor-kanan">
          <div className="kartu kartu-kerja">
            <div className="judul-kartu">
              <b>Sedang dikerjakan</b>
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
              <div className="meja-kosong">{saya ? 'Belum ada order. Ambil order terdekat di sebelah kiri.' : 'Menunggu pendaftaran toko'}</div>
            )}
          </div>

          <div className="kartu kartu-siap">
            <div className="judul-kartu">
              <b>Siap diambil pelanggan</b>
              <button className="tombol utama" disabled={!!alatJalan || siapSerah.length === 0} onClick={() => setPindai(true)}>
                📷 Pindai QR pelanggan
              </button>
            </div>
            {siapSerah.length === 0 ? (
              <p className="muted kecil">Order yang sudah dikerjakan menunggu di sini sampai pelanggan datang dan menunjukkan QR.</p>
            ) : (
              siapSerah.map((o) => (
                <div key={String(o.id)} className="baris-siap">
                  <span>
                    <b>#{String(o.id)}</b> · {s.katalog[o.jenis]?.label} · “{o.teks}” · bayaran terkunci{' '}
                    <b>{mon(payoutBersih(hitungPayout(o.harga, o.batasKerja, o.kerja), s.feeBps))}</b>
                  </span>
                  {BigInt(o.dokumen) !== 0n && (
                    <button className="tautan inline" onClick={() => unduh(o)}>
                      unduh dokumen
                    </button>
                  )}
                  {alatJalan === `serah-${o.id}` && <span className="muted"> menyerahkan…</span>}
                </div>
              ))
            )}
          </div>

          <div className="kartu kartu-info kecil">
            <b>Cara bayaranmu dihitung</b>
            <span>Bayaran turun tiap detik sejak order kamu ambil sampai siap. Sisanya kembali ke pelanggan sebagai cashback.</span>
            <span>Dana cair saat QR pelanggan dipindai. Potongan platform {s.feeBps / 100}% hanya dari order yang selesai.</span>
          </div>
        </section>
      </div>

      {pindai && <PindaiQr onHasil={serahkan} onTutup={() => setPindai(false)} />}
      <AnimatePresence>
        {orderNotif && (
          <motion.div className="notif-order" initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: 'spring', bounce: 0.35 }}>
            <div className="notif-kepala">
              <b>🔔 Order baru di dekatmu!</b>
              <span className="notif-hitung">{Math.max(0, s.batasAntre - (now - orderNotif.dibuatPada))} dtk</span>
            </div>
            <div className="notif-isi">
              <div className="notif-jarak">{dalamFeed?.get(String(orderNotif.id))?.jarakKm != null ? `${dalamFeed.get(String(orderNotif.id))!.jarakKm} km` : 'demo'}</div>
              <div>
                <b>{s.katalog[orderNotif.jenis]?.label}</b>
                <div className="teks-kecil">“{orderNotif.teks}”</div>
                <div className="muted kecil">
                  {orderNotif.langkah.map((l) => NAMA_LANGKAH[l]).join(' → ')}
                  {orderNyata(orderNotif) && ` · ${orderNotif.halaman} hlm`}
                </div>
              </div>
              <div className="notif-harga">{mon(orderNotif.harga)}</div>
            </div>
            <div className="bar tipis">
              <div style={{ width: `${Math.max(0, ((s.batasAntre - (now - orderNotif.dibuatPada)) / s.batasAntre) * 100)}%` }} />
            </div>
            <div className="notif-tombol">
              <button className="tombol" onClick={() => setNotif(null)}>
                Lewati
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
                {rebut === orderNotif.id ? '…' : 'Ambil order'}
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

/** Radar radius toko: toko di tengah, order sebagai titik sesuai jarak (sudut dari id supaya stabil). */
function Radar(p: { radiusKm: number; adaLokasi: boolean; titik: { id: bigint; jarakKm: number; label: string; nyata: boolean }[]; sorot: bigint | null; onPilih: (id: bigint) => void }) {
  const R = 130;
  const cincin = [0.33, 0.66, 1];
  return (
    <div className="radar">
      <svg viewBox="-150 -150 300 300" role="img" aria-label={`Radar order radius ${p.radiusKm} km`}>
        <circle r={R + 6} fill="#efe8fd" stroke="#231e16" strokeWidth={3} />
        {cincin.map((c) => (
          <circle key={c} r={R * c} fill="none" stroke="#836ef9" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="5 6" />
        ))}
        {cincin.map((c) => (
          <text key={`t${c}`} x={4} y={-R * c + 14} className="label-radar">
            {(p.radiusKm * c).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km
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
      {!p.adaLokasi && <div className="radar-kosong">Atur lokasi toko supaya hanya order dalam radius yang masuk</div>}
    </div>
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
