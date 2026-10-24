// /main — match: toko fotokopi 3D ala Overcooked yang bisa dimainkan, terhubung ke kontrak FotokopiKilat.
// Anvil: /main?dev=1 (Toko A) atau /main?dev=2 (Toko B). Testnet: alamat passkey harus terdaftar sebagai toko (registerShop).
// Alur: rebut order di loket (claim) → bawa dokumen/flashdisk ke mesin → tiap mesin beres = completeStep → serahkan di loket = langkah terakhir.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { Canvas, useFrame } from '@react-three/fiber';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { memo, Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { hitungPayout, satuanKeRupiah } from '../../../shared/src/index.ts';
import '../arena/arena.css';
import { Jam, JENIS_DARI_KATALOG, KoinMon } from '../arena/Ikon';
import Tiket, { type DataTiket } from '../arena/Tiket';
import '../arena3d/arena3d.css';
import { UNGU } from '../arena3d/Mesin3D';
import { Toko3D } from '../arena3d/Toko3D';
import { sfx } from '../game/sfx';
import { Item3D, wujudAwal, type Item } from '../game3d/Item3D';
import {
  acakFile,
  buangItem,
  DURASI,
  duniaBaru,
  MACET_MS,
  mesinKosong,
  namaFile,
  semuaItem,
  wujudSetelah,
  type Dunia,
  type KodeMesin,
} from '../game3d/logika';
import { PemainGame, useTombol, type PosPemain } from '../game3d/PemainGame';
import type { IdStasiun } from '../game3d/peta';
import { Antrean, BarangDunia, BarMesin, Sorotan, TandaMesin } from '../game3d/Stasiun3D';
import { akunBurner, masuk, passkeyMungkin, type Akun } from '../lib/akun';
import { NAMA_LANGKAH, ZERO } from '../lib/format';
import type { Order } from '../lib/katalog';
import { bacaLive, useJamChain, useLive } from '../lib/live';
import { kirim, pesanError } from '../lib/tx';

const TokoStatis = memo(Toko3D);
const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const MESIN_DARI: Partial<Record<IdStasiun, KodeMesin>> = { m1: 1, m2: 2, m3: 3 };
const NAMA_MESIN: Record<KodeMesin, string> = { 1: 'Mesin fotokopi', 2: 'Printer', 3: 'Laminator' };
const LABEL_JENIS: Record<number, string> = { 1: 'Fotokopi KTP', 2: 'Boarding pass', 3: 'Laminating ijazah', 4: 'Menu warung' };
/** Rupiah bulat untuk HUD (tIDRX punya 2 desimal; payout yang meluruh menghasilkan sen). */
const rp = (v: bigint) => 'Rp' + Math.round(Number(satuanKeRupiah(v))).toLocaleString('id-ID');
const batas01 = (v: number) => Math.max(0, Math.min(1, v));
const KATA_TELAT = ['Lewat batas waktu kerja', 'Order sudah tidak dikerjakan', 'Ini bukan order tokomu'];

type Toast = { teks: string; jenis: 'ok' | 'kalah' | 'info'; n: number };
type Prompt = { tombol?: string; teks: string } | null;

/** Detak game di dalam kanvas: memajukan mesin tiap frame tanpa render ulang React. */
function Detak({
  dunia,
  tombol,
  fokus,
  onSelesai,
  onUbah,
}: {
  dunia: React.RefObject<Dunia>;
  tombol: React.RefObject<Set<string>>;
  fokus: React.RefObject<IdStasiun | null>;
  onSelesai: (k: KodeMesin) => void;
  onUbah: () => void;
}) {
  useFrame((_, dtMentah) => {
    const dt = Math.min(dtMentah, 0.05);
    for (const k of [1, 2, 3] as KodeMesin[]) {
      const m = dunia.current.mesin[k];
      const maju = m.status === 'jalan' || (m.status === 'tahan' && fokus.current === 'm3' && tombol.current.has('e'));
      if (maju) {
        m.progres = Math.min(1, m.progres + dt / DURASI[k]);
        if (m.progres >= 1) onSelesai(k);
      }
      if (m.status === 'macet' && performance.now() > m.macetSampai) {
        m.status = 'pilih';
        m.file = acakFile(m.item?.teks ?? '');
        onUbah();
      }
    }
  });
  return null;
}

export default function Main() {
  const s = useLive();
  const now = useJamChain(s.offset);
  const [akun, setAkun] = useState<Akun | null>(null);
  const [masukJalan, setMasukJalan] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fokus, setFokus] = useState<IdStasiun | null>(null);
  const [, ubah] = useReducer((x: number) => x + 1, 0);

  const dunia = useRef<Dunia>(duniaBaru());
  const pos = useRef<PosPemain>({ x: 0, z: -1.3, arah: 0 });
  const tombol = useTombol();
  const fokusRef = useRef<IdStasiun | null>(null);
  const beres = useRef(new Set<string>()); // order yang sudah diserahkan/hangus (jangan dipulihkan lagi)
  const terkirim = useRef(new Map<string, number>()); // langkah yang tx-nya sudah sukses
  const antrian = useRef<Promise<unknown>>(Promise.resolve()); // completeStep dikirim berurutan
  const menyerahkan = useRef(false);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dingTerakhir = useRef('');
  const rebutTerakhir = useRef('');

  const tampil = useCallback((teks: string, jenis: Toast['jenis'] = 'info', ms = 2300) => {
    setToast({ teks, jenis, n: Date.now() });
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(location.search).has('dev')) masuk().then(setAkun);
  }, []);

  const saya = akun ? s.toko.find((t) => sama(t.alamat, akun.address)) : undefined;
  const lawan = s.toko.filter((t) => !akun || !sama(t.alamat, akun.address));
  const aktifMentah = saya && saya.orderAktif ? s.order[String(saya.orderAktif)] : undefined;
  const aktif = aktifMentah?.status === 'Claimed' && !beres.current.has(String(aktifMentah.id)) ? aktifMentah : undefined;
  const antre = Object.values(s.order)
    .filter((o) => o.status === 'Open' && o.sesi === s.sesiId && now - o.dibuatPada < s.batasAntre)
    .sort((a, b) => a.dibuatPada - b.dibuatPada);
  const d = dunia.current;

  // Bunyi "ding" saat order baru masuk; kabar kalau toko lain merebut duluan.
  useEffect(() => {
    const baru = s.kejadian.find((x) => x.jenis === 'baru');
    if (baru && baru.kunci !== dingTerakhir.current) {
      dingTerakhir.current = baru.kunci;
      if (baru.waktu > 0) sfx('ding');
    }
    const rebut = s.kejadian.find((x) => x.jenis === 'claim');
    if (rebut && rebut.kunci !== rebutTerakhir.current) {
      rebutTerakhir.current = rebut.kunci;
      if (rebut.waktu > 0 && akun && rebut.toko && !sama(rebut.toko, akun.address)) {
        const nama = s.toko.find((t) => sama(t.alamat, rebut.toko))?.nama ?? 'Toko lain';
        tampil(`${nama} merebut order #${rebut.id}!`, 'info', 1800);
      }
    }
  }, [s.kejadian, s.toko, akun, tampil]);

  /** Kirim completeStep berurutan sampai `sampai` langkah tercatat. Mengembalikan payout bila order selesai. */
  const catat = useCallback(
    (it: Item, sampai: number) => {
      const kunci = String(it.id);
      const p = antrian.current.then(async () => {
        if (!akun) throw new Error('Belum masuk');
        let hasil: { payout: bigint; refund: bigint } | undefined;
        const mulai = Math.max(bacaLive().order[kunci]?.langkahSelesai ?? 0, terkirim.current.get(kunci) ?? 0);
        for (let i = mulai; i < sampai; i++) {
          const r = await kirim(akun, 'completeStep', [it.id, it.langkah[i]]);
          terkirim.current.set(kunci, i + 1);
          const f = r.events.find((e) => e.eventName === 'OrderFinished');
          if (f) hasil = { payout: f.args.payout as bigint, refund: f.args.refund as bigint };
        }
        return hasil;
      });
      antrian.current = p.catch(() => {});
      return p;
    },
    [akun],
  );

  const hangus = useCallback(
    (id: bigint, teks: string) => {
      beres.current.add(String(id));
      buangItem(dunia.current, id);
      sfx('kalah');
      tampil(teks, 'kalah', 3400);
      if (akun) kirim(akun, 'expire', [id]).catch(() => {}); // bebaskan toko; boleh gagal kalau keeper sudah duluan
      ubah();
    },
    [akun, tampil],
  );

  // Sinkron dunia dengan chain: pulihkan barang order aktif (mis. setelah reload), buang barang order yang hangus.
  useEffect(() => {
    const dd = dunia.current;
    for (const it of semuaItem(dd)) {
      const o = s.order[String(it.id)];
      if (o?.status === 'Expired' && !beres.current.has(String(it.id))) hangus(it.id, `Order #${it.id} hangus — uang balik ke pelanggan`);
    }
    if (!aktif) return;
    if (now - aktif.diclaimPada >= aktif.batasKerja + 0.5) {
      if (!menyerahkan.current) hangus(aktif.id, `Waktu habis! Order #${aktif.id} hangus — uang balik ke pelanggan`);
      return;
    }
    if (dd.merebut === null && !semuaItem(dd).some((x) => x.id === aktif.id)) {
      const tahap = aktif.langkahSelesai;
      const it: Item = { id: aktif.id, jenis: aktif.jenis, langkah: aktif.langkah, tahap, wujud: wujudSetelah(aktif.langkah, tahap), teks: aktif.teks };
      if (!dd.pegang) dd.pegang = it;
      else if (!dd.meja[0]) dd.meja[0] = it;
      else if (!dd.meja[1]) dd.meja[1] = it;
      ubah();
    }
  }, [s.order, aktif, now, hangus]);

  async function rebut(o: Order | undefined) {
    if (!akun || d.merebut !== null) return;
    if (!saya) return tampil('Alamat ini belum terdaftar sebagai toko', 'kalah');
    if (!s.sesiAktif) return tampil('Sesi belum dibuka operator', 'info');
    if (!o) return tampil('Belum ada pelanggan. Tunggu order masuk!', 'info');
    d.merebut = o.id;
    ubah();
    sfx('klik');
    try {
      await kirim(akun, 'claim', [o.id]);
      if (!semuaItem(d).some((x) => x.id === o.id)) d.pegang = { id: o.id, jenis: o.jenis, langkah: o.langkah, tahap: 0, wujud: wujudAwal(o.langkah), teks: o.teks };
      sfx('ambil');
      tampil(`Order #${o.id} milikmu! ${o.langkah.map((l) => NAMA_LANGKAH[l]).join(' → ')} → serahkan`, 'ok', 2800);
    } catch (e) {
      sfx('kalah');
      const pesan = pesanError(e);
      const oo = bacaLive().order[String(o.id)];
      const nama = oo && oo.toko !== ZERO ? bacaLive().toko.find((t) => sama(t.alamat, oo.toko))?.nama : undefined;
      tampil(pesan === 'Diambil toko lain' && nama ? `Kalah cepat! Diambil ${nama}` : pesan, 'kalah');
    } finally {
      d.merebut = null;
      ubah();
    }
  }

  async function serahkan(it: Item) {
    menyerahkan.current = true;
    d.pegang = d.pegang?.id === it.id ? null : d.pegang;
    d.diSerah = it;
    ubah();
    sfx('klik');
    try {
      const h = await catat(it, it.langkah.length);
      beres.current.add(String(it.id));
      buangItem(d, it.id);
      sfx('selesai');
      confetti({ particleCount: 150, spread: 95, startVelocity: 45, origin: { x: 0.5, y: 0.78 }, colors: ['#836ef9', '#fbfaf3', '#f4b829', '#5fd39a'] });
      tampil(h ? `Beres! +${rp(h.payout)} · NFT terkirim ke pelanggan` : 'Beres! NFT terkirim ke pelanggan', 'ok', 3400);
    } catch (e) {
      const pesan = pesanError(e);
      if (KATA_TELAT.includes(pesan)) hangus(it.id, `Telat! Order #${it.id} hangus — uang balik ke pelanggan`);
      else {
        sfx('gagal');
        tampil(`${pesan} — tekan Spasi di loket untuk coba lagi`, 'kalah', 3400);
      }
    } finally {
      menyerahkan.current = false;
      ubah();
    }
  }

  const onSelesai = useCallback(
    (k: KodeMesin) => {
      const m = dunia.current.mesin[k];
      if (!m.item) return;
      m.status = 'selesai';
      m.progres = 1;
      m.item = { ...m.item, tahap: m.item.tahap + 1, wujud: k === 3 ? 'laminasi' : 'kertas' };
      sfx('lulus');
      // Langkah tengah dicatat sekarang; langkah terakhir dicatat saat diserahkan di loket.
      if (m.item.tahap < m.item.langkah.length) catat(m.item, m.item.tahap).catch((e) => tampil(pesanError(e), 'kalah'));
      ubah();
    },
    [catat, tampil],
  );

  function aksi() {
    const f = fokusRef.current;
    if (!f || !akun) return;
    if (f === 'serah') {
      if (d.pegang) {
        if (d.pegang.tahap >= d.pegang.langkah.length) serahkan(d.pegang);
        else tampil(`Belum beres — masih perlu ${NAMA_LANGKAH[d.pegang.langkah[d.pegang.tahap]]}`, 'info');
      } else if (d.diSerah) {
        if (!menyerahkan.current) serahkan(d.diSerah);
      } else if (aktif || semuaItem(d).length) tampil('Selesaikan order yang sedang jalan dulu', 'info');
      else rebut(antre[0]);
      return;
    }
    if (f === 'meja0' || f === 'meja1') {
      const i = f === 'meja0' ? 0 : 1;
      if (d.pegang && !d.meja[i]) {
        d.meja[i] = d.pegang;
        d.pegang = null;
        sfx('klik');
      } else if (!d.pegang && d.meja[i]) {
        d.pegang = d.meja[i];
        d.meja[i] = null;
        sfx('ambil');
      }
      return ubah();
    }
    const k = MESIN_DARI[f]!;
    const m = d.mesin[k];
    if (!d.pegang) {
      if (m.status === 'selesai' || m.status === 'pilih') {
        d.pegang = m.item;
        d.mesin[k] = mesinKosong();
        sfx('ambil');
      } else if (m.status === 'jalan') tampil('Sabar, mesin masih jalan…');
      else if (m.status === 'tahan') tampil('Tahan E buat laminating');
      else if (m.status === 'macet') tampil('Printer kena virus! Tunggu sebentar', 'kalah');
    } else if (m.status !== 'kosong') tampil(m.status === 'selesai' ? 'Tangan penuh — taruh dulu barangmu' : 'Mesin lagi dipakai');
    else {
      const butuh = d.pegang.langkah[d.pegang.tahap];
      if (butuh === undefined) tampil('Sudah beres — serahkan ke loket SERAH!', 'info');
      else if (butuh !== k) tampil(`Salah mesin! Ini butuh ${NAMA_LANGKAH[butuh]}`, 'kalah');
      else {
        m.item = d.pegang;
        d.pegang = null;
        m.progres = 0;
        m.status = k === 1 ? 'jalan' : k === 2 ? 'pilih' : 'tahan';
        m.file = k === 2 ? acakFile(m.item.teks) : [];
        sfx(k === 1 ? 'mesin' : 'klik');
      }
    }
    ubah();
  }

  function pilihFile(i: number) {
    const m = d.mesin[2];
    if (fokusRef.current !== 'm2' || m.status !== 'pilih' || !m.item || !m.file[i]) return;
    if (m.file[i] === namaFile(m.item.teks)) {
      m.status = 'jalan';
      m.progres = 0;
      sfx('mesin');
    } else {
      m.status = 'macet';
      m.macetSampai = performance.now() + MACET_MS;
      sfx('gagal');
      tampil(`VIRUS! ${m.file[i]} bikin printer macet`, 'kalah');
    }
    ubah();
  }

  if (import.meta.env.DEV) Object.assign(window, { __game: { pos: pos.current, dunia: d, fokus: fokusRef } });

  const aksiRef = useRef(aksi);
  const pilihRef = useRef(pilihFile);
  aksiRef.current = aksi;
  pilihRef.current = pilihFile;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter') aksiRef.current();
      else if (e.key === '1' || e.key === '2' || e.key === '3') pilihRef.current(Number(e.key) - 1);
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);

  const onFokus = useCallback((id: IdStasiun | null) => {
    fokusRef.current = id;
    setFokus(id);
  }, []);

  async function mulai(burner: boolean) {
    setMasukJalan(true);
    try {
      setAkun(burner ? akunBurner() : await masuk());
    } catch {
      tampil('Passkey dibatalkan', 'info');
    } finally {
      setMasukJalan(false);
    }
  }

  // ---------- HUD ----------
  const huruf = (saya?.nama ?? 'A').trim().slice(-1).toUpperCase();
  const tiket: DataTiket[] = [
    ...(aktif
      ? [
          {
            id: String(aktif.id),
            jenis: JENIS_DARI_KATALOG[aktif.jenis],
            langkah: aktif.langkah,
            sisa: batas01(1 - (now - aktif.diclaimPada) / aktif.batasKerja),
            harga: rp(aktif.harga),
            diambil: { huruf, warna: 'ungu' as const },
          },
        ]
      : []),
    ...antre.slice(0, 5).map((o) => ({
      id: String(o.id),
      jenis: JENIS_DARI_KATALOG[o.jenis],
      langkah: o.langkah,
      sisa: batas01(1 - (now - o.dibuatPada) / s.batasAntre),
      harga: rp(o.harga),
    })),
  ];
  const kerja = aktif ? Math.max(0, now - aktif.diclaimPada) : 0;
  const sisaDetik = aktif ? Math.max(0, Math.ceil(aktif.batasKerja - kerja)) : 0;
  const payoutKini = aktif ? hitungPayout(aktif.harga, aktif.batasKerja, Math.floor(kerja)) : 0n;

  const m2 = d.mesin[2];
  const pilihTerbuka = fokus === 'm2' && m2.status === 'pilih' && !!m2.item;
  const prompt = teksPrompt(fokus, d, !!aktif || semuaItem(d).length > 0, antre[0], menyerahkan.current);
  const bekerja = fokus === 'm3' && d.mesin[3].status === 'tahan';

  return (
    <main className="halaman-game main-3d">
      <Canvas
        shadows
        flat
        dpr={[1, 2]}
        camera={{ fov: 32, position: [0, 16.5, 13.2], near: 0.5, far: 80 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0.35)}
      >
        <color attach="background" args={['#241a52']} />
        <fog attach="fog" args={['#241a52', 24, 46]} />
        <hemisphereLight args={['#fff6e5', '#5a4a8a', 1.15]} />
        <directionalLight
          position={[6, 14, 8]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0004}
        />
        <Suspense fallback={null}>
          <TokoStatis nama={(saya?.nama ?? 'Toko A').toUpperCase()} warna={UNGU.m} mesinJalan={d.mesin[1].status === 'jalan'} />
          <BarangDunia dunia={d} />
          {([1, 2, 3] as KodeMesin[]).map((k) => (
            <BarMesin key={k} k={k} dunia={dunia} />
          ))}
          {([1, 2, 3] as KodeMesin[]).map((k) => (
            <TandaMesin key={k} k={k} status={d.mesin[k].status} />
          ))}
          <Sorotan id={fokus} />
          <Antrean antre={antre.map((o) => ({ id: o.id, jenis: o.jenis }))} aktif={aktif?.id} />
          <PemainGame
            warna={UNGU.m}
            tombol={tombol}
            pos={pos}
            pegang={d.pegang ? <Item3D item={d.pegang} /> : undefined}
            bekerja={bekerja}
            onFokus={onFokus}
          />
          <Detak dunia={dunia} tombol={tombol} fokus={fokusRef} onSelesai={onSelesai} onUbah={ubah} />
        </Suspense>
      </Canvas>

      <div className="rel-tiket">
        <AnimatePresence>
          {tiket.map((t) => (
            <Tiket key={t.id} t={t} />
          ))}
        </AnimatePresence>
      </div>
      {lawan.length > 0 && (
        <div className="lawan-hud">
          <span>VS</span> {lawan[0].nama.toUpperCase()} <b>{rp(lawan[0].omzet)}</b>
        </div>
      )}
      <div className="koin-3d">
        <KoinMon ukuran={64} />
        <div>
          <motion.div key={String(saya?.omzet ?? 0n)} className="skor-angka" initial={{ scale: 1.25 }} animate={{ scale: 1 }}>
            {rp(saya?.omzet ?? 0n)}
          </motion.div>
          <div className="skor-label">{saya ? `${saya.nama.toUpperCase()} · omzet sesi` : akun ? 'Belum terdaftar sebagai toko' : 'Belum masuk'}</div>
        </div>
      </div>
      <div className="timer-3d">
        <div>
          <div className="timer-angka">{aktif ? `00:${String(sisaDetik).padStart(2, '0')}` : '--:--'}</div>
          <div className="bar-timer">
            <div style={{ width: `${aktif ? batas01(sisaDetik / aktif.batasKerja) * 100 : 0}%` }} />
          </div>
          <div className="timer-label">{aktif ? `Payout ${rp(payoutKini)}` : 'Rebut order di loket'}</div>
        </div>
        <Jam ukuran={46} />
      </div>

      {pilihTerbuka && (
        <div className="pilih-file">
          <h4>FLASHDISK (E:) — {LABEL_JENIS[m2.item!.jenis]}</h4>
          {m2.file.map((f, i) => (
            <button key={f} onClick={() => pilihFile(i)}>
              <b>{i + 1}</b> {f}
            </button>
          ))}
          <p>Cetak file asli. Salah pilih = printer kena virus!</p>
        </div>
      )}
      {prompt && (
        <div className="prompt-wadah">
          <div className="prompt-3d">
            {prompt.tombol && <span className="kapsul-tombol">{prompt.tombol}</span>}
            {prompt.teks}
          </div>
        </div>
      )}
      <div className="kontrol-3d">WASD gerak · Shift lari · Spasi ambil/taruh/serah · Tahan E laminating · 1–3 pilih file</div>
      <div className="toast-wadah">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.n}
              className={`toast-3d ${toast.jenis}`}
              initial={{ y: -24, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -12, opacity: 0 }}
            >
              {toast.teks}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!akun && (
        <div className="masuk-3d">
          <div className="kartu-masuk">
            <h2>Buka toko</h2>
            <p>Rebut order penonton di loket, kerjakan di mesin, serahkan secepat kilat. Makin cepat, makin cuan.</p>
            <button className="tombol utama besar" disabled={masukJalan} onClick={() => mulai(false)}>
              {passkeyMungkin() ? 'Masuk dengan passkey' : 'Masuk'}
            </button>
            <button className="tautan" disabled={masukJalan} onClick={() => mulai(true)}>
              Pakai akun sementara
            </button>
          </div>
        </div>
      )}
      {(!s.siap || s.galat) && <div className="status-3d">{s.galat ?? 'Menyambung ke Monad…'}</div>}
    </main>
  );
}

function teksPrompt(f: IdStasiun | null, d: Dunia, adaOrder: boolean, depan: Order | undefined, menyerahkan: boolean): Prompt {
  if (!f) return null;
  if (f === 'serah') {
    if (d.pegang) {
      const butuh = d.pegang.langkah[d.pegang.tahap];
      return butuh === undefined ? { tombol: 'Spasi', teks: 'Serahkan ke pelanggan' } : { teks: `Belum beres — perlu ${NAMA_LANGKAH[butuh]}` };
    }
    if (d.diSerah) return menyerahkan ? { teks: 'Mencatat ke Monad…' } : { tombol: 'Spasi', teks: 'Coba serahkan lagi' };
    if (d.merebut !== null) return { teks: `Merebut order #${d.merebut}…` };
    if (adaOrder) return { teks: 'Satu order dulu sampai beres' };
    return depan ? { tombol: 'Spasi', teks: `Rebut order #${depan.id} · ${LABEL_JENIS[depan.jenis] ?? ''}` } : { teks: 'Menunggu pelanggan…' };
  }
  if (f === 'meja0' || f === 'meja1') {
    const isi = d.meja[f === 'meja0' ? 0 : 1];
    if (d.pegang && !isi) return { tombol: 'Spasi', teks: 'Taruh di meja' };
    if (!d.pegang && isi) return { tombol: 'Spasi', teks: 'Ambil dari meja' };
    return { teks: 'Meja kerja' };
  }
  const k = MESIN_DARI[f]!;
  const m = d.mesin[k];
  const nama = NAMA_MESIN[k];
  switch (m.status) {
    case 'kosong': {
      if (!d.pegang) return { teks: nama };
      const butuh = d.pegang.langkah[d.pegang.tahap];
      if (butuh === undefined) return { teks: 'Sudah beres — bawa ke loket SERAH' };
      return butuh === k ? { tombol: 'Spasi', teks: `Masukkan ke ${nama.toLowerCase()}` } : { teks: `Bukan di sini — perlu ${NAMA_LANGKAH[butuh]}` };
    }
    case 'pilih':
      return { tombol: '1–3', teks: 'Pilih file asli dari flashdisk' };
    case 'jalan':
      return { teks: `${nama} jalan…` };
    case 'tahan':
      return { tombol: 'Tahan E', teks: 'Laminating' };
    case 'macet':
      return { teks: 'Printer kena virus! Tunggu…' };
    case 'selesai':
      return d.pegang ? { teks: 'Tangan penuh — taruh dulu barangmu' } : { tombol: 'Spasi', teks: 'Ambil hasil' };
  }
}
