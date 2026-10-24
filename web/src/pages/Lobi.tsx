// /lobi — profil pemain sebelum matchmaking: atur nama, rupa (topi koran / visor), warna baju, kulit, rambut.
// Karakter tampil besar di balik konter toko (ala barisan chef di lobi Overcooked) dan melompat tiap kali diubah.
// Akun masuk di sini dan dibawa ke match tanpa minta passkey lagi.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import { Canvas, useFrame } from '@react-three/fiber';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import '../arena/arena.css';
import { Cahaya } from '../arena3d/Adegan';
import '../arena3d/arena3d.css';
import { Fotokopi3D, Printer3D, UNGU } from '../arena3d/Mesin3D';
import { Pekerja3D } from '../arena3d/Pekerja3D';
import { Konter, RakBinder } from '../arena3d/Perabot3D';
import { gambarPapan, PapanKanvas } from '../arena3d/Toko3D';
import { akunAktif, akunBurner, masuk, pakaiAkun, passkeyMungkin, type Akun } from '../lib/akun';
import { IS_ANVIL } from '../lib/chain';
import { pendek } from '../lib/format';
import { useLive } from '../lib/live';
import { NAMA } from '../lib/merek';
import { pindah } from '../lib/navigasi';
import { bacaPro, langgananPro, tanggalPro, type InfoPro } from '../lib/pro';
import { bacaProfil, MAKS_NAMA, rapikanNama, simpanProfil, WARNA_BAJU, WARNA_KULIT, WARNA_RAMBUT, type Profil } from '../lib/profil';
import { formatRupiah } from '../../../shared/src/index.ts';
import { pesanError } from '../lib/tx';

const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Karakter di panggung: menoleh pelan ke kiri-kanan, melompat setiap `versi` berubah. */
function KarakterPanggung({ p, versi }: { p: Profil; versi: number }) {
  const grup = useRef<THREE.Group>(null);
  const mulai = useRef(-10);
  const sebelum = useRef(versi);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (versi !== sebelum.current) {
      sebelum.current = versi;
      mulai.current = t;
    }
    const u = (t - mulai.current) / 0.45;
    if (!grup.current) return;
    grup.current.position.y = u >= 0 && u < 1 ? Math.sin(u * Math.PI) * 0.45 : 0;
    grup.current.rotation.y = Math.sin(t * 0.7) * 0.35 + (u >= 0 && u < 1 ? u * Math.PI * 2 : 0);
  });
  return (
    <group ref={grup}>
      <Pekerja3D model={p.model} warna={p.warna} kulit={p.kulit} rambut={p.rambut} posisi={[0, 0, 0]} skala={1.6} cincin={false} gaya="diam" />
    </group>
  );
}

function PanggungProfil({ p, versi, nama }: { p: Profil; versi: number; nama: string }) {
  const papan = useMemo(() => gambarPapan(NAMA.toUpperCase(), UNGU.m), []);
  const papanToko = useMemo(() => gambarPapan(nama.toUpperCase(), UNGU.d), [nama]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#efe3c8" />
      </mesh>
      <mesh position={[0, 1.6, -2.3]} receiveShadow>
        <planeGeometry args={[16, 3.2]} />
        <meshStandardMaterial color="#f6efe0" />
      </mesh>
      <mesh position={[0, 0.12, -2.28]}>
        <boxGeometry args={[16, 0.24, 0.06]} />
        <meshStandardMaterial color={UNGU.m} />
      </mesh>
      <PapanKanvas posisi={[-2.6, 2.45, -2.25]} lebar={2.2} tinggi={0.42} px={800} gambar={papan} />
      <RakBinder posisi={[2.7, 1.75, -2.15]} lebar={1.6} />
      <Fotokopi3D posisi={[-2.9, 0, -1.5]} putar={0.35} skala={1.45} />
      <Konter posisi={[2.75, 0, -1.55]} lebar={1.55} dalam={1.1} muka="laci" les={UNGU.m} />
      <Printer3D posisi={[2.75, 0.78, -1.62]} skala={2.3} />
      {/* konter depan: karakter berdiri di belakangnya */}
      {[-1, 0, 1].map((x) => (
        <Konter key={x} posisi={[x, 0, 1.05]} muka={x === 0 ? 'polos' : 'pintu'} badan={x === 0 ? UNGU.l : '#fbf4e4'} les={UNGU.m} />
      ))}
      <PapanKanvas posisi={[0, 0.42, 1.43]} lebar={0.92} tinggi={0.26} px={420} gambar={papanToko} />
      <KarakterPanggung p={p} versi={versi} />
    </group>
  );
}

function Swatch({ warna, aktif, onPilih, label }: { warna: string[]; aktif: string; onPilih: (w: string) => void; label: string }) {
  return (
    <div className="baris-swatch" role="radiogroup" aria-label={label}>
      {warna.map((w) => (
        <button key={w} className={w === aktif ? 'aktif' : ''} style={{ background: w }} onClick={() => onPilih(w)} aria-label={`${label} ${w}`} />
      ))}
    </div>
  );
}

export default function Lobi() {
  const s = useLive();
  const [profil, setProfil] = useState<Profil>(bacaProfil);
  const [versi, setVersi] = useState(0);
  const [akun, setAkun] = useState<Akun | null>(akunAktif);
  const [masukJalan, setMasukJalan] = useState(false);
  const [disalin, setDisalin] = useState(false);
  const [pro, setPro] = useState<InfoPro | null>(null);
  const [proJalan, setProJalan] = useState(false);
  const [proPesan, setProPesan] = useState('');

  useEffect(() => {
    if (!akun && new URLSearchParams(location.search).has('dev')) masuk().then(setAkun);
  }, [akun]);
  useEffect(() => simpanProfil(profil), [profil]);
  const segarkanPro = useCallback(() => {
    if (akun) bacaPro(akun.address).then(setPro).catch(() => setPro(null));
  }, [akun]);
  useEffect(segarkanPro, [segarkanPro]);

  async function beliPro() {
    if (!akun || !pro) return;
    setProJalan(true);
    setProPesan('');
    try {
      await langgananPro(akun, 1, pro.hargaPro);
      setProPesan('Toko Pro aktif!');
      segarkanPro();
    } catch (e) {
      setProPesan(pesanError(e));
    } finally {
      setProJalan(false);
    }
  }

  const ubah = (f: Partial<Profil>) => {
    setProfil((p) => ({ ...p, ...f }));
    setVersi((v) => v + 1);
  };

  const saya = akun ? s.toko.find((t) => sama(t.alamat, akun.address)) : undefined;
  const namaToko = saya?.nama ?? 'TOKO';
  const namaTampil = profil.nama.trim() || namaToko;

  async function mulaiMasuk(burner: boolean) {
    setMasukJalan(true);
    try {
      setAkun(burner ? pakaiAkun(akunBurner()) : await masuk());
    } catch {
      /* passkey dibatalkan: tetap di lobi */
    } finally {
      setMasukJalan(false);
    }
  }

  function salinAlamat() {
    if (!akun) return;
    navigator.clipboard?.writeText(akun.address).then(() => {
      setDisalin(true);
      setTimeout(() => setDisalin(false), 1500);
    });
  }

  const alasan = !akun ? 'Masuk dulu untuk main' : !saya ? 'Alamatmu belum terdaftar sebagai toko' : !s.sesiAktif ? 'Sesi belum dibuka operator' : null;

  return (
    <main className="halaman-game lobi lobi-profil">
      <header className="kepala-lobi">
        <button className="tombol-game putih kecil" onClick={() => pindah('/')}>
          ‹ KEMBALI
        </button>
        <h1 className="judul-game">LOBI</h1>
        <div className="pil-live">
          <span className={`titik ${s.sesiAktif ? '' : 'mati'}`} /> {IS_ANVIL ? 'ANVIL LOKAL' : 'MONAD TESTNET'} · {s.sesiAktif ? `SESI #${s.sesiId}` : 'SESI BELUM DIBUKA'}
        </div>
      </header>

      <div className="isi-lobi">
        <section className="panggung-lobi panggung-profil">
          <Canvas shadows flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 3.0, 8.3] }} onCreated={({ camera }) => camera.lookAt(0, 1.05, 0)}>
            <color attach="background" args={['#2c2170']} />
            <Cahaya />
            <Suspense fallback={null}>
              <PanggungProfil p={profil} versi={versi} nama={namaToko} />
            </Suspense>
          </Canvas>
          <AnimatePresence mode="popLayout">
            <motion.div key={namaTampil} className="papan-nama-pemain" initial={{ y: -20, opacity: 0, rotate: -4 }} animate={{ y: 0, opacity: 1, rotate: -2 }} exit={{ opacity: 0 }}>
              {namaTampil}
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="panel-profil">
          <label className="judul-kecil" htmlFor="nama-pemain">
            NAMA PEMAIN
          </label>
          <div className="isian-nama">
            <input
              id="nama-pemain"
              value={profil.nama}
              maxLength={MAKS_NAMA}
              placeholder={saya ? saya.nama : 'Tulis namamu'}
              onChange={(e) => setProfil((p) => ({ ...p, nama: rapikanNama(e.target.value) }))}
              onBlur={() => setVersi((v) => v + 1)}
              autoComplete="off"
            />
            <span>
              {profil.nama.length}/{MAKS_NAMA}
            </span>
          </div>

          <div className="judul-kecil">RUPA</div>
          <div className="pilih-rupa">
            {(
              [
                ['tukang', 'Topi koran'],
                ['tukang-visor', 'Visor hijau'],
              ] as const
            ).map(([m, label]) => (
              <button key={m} className={profil.model === m ? 'aktif' : ''} onClick={() => ubah({ model: m })}>
                {label}
              </button>
            ))}
          </div>

          <div className="judul-kecil">WARNA BAJU</div>
          <Swatch warna={WARNA_BAJU} aktif={profil.warna} onPilih={(w) => ubah({ warna: w })} label="Warna baju" />
          <div className="judul-kecil">WARNA KULIT</div>
          <Swatch warna={WARNA_KULIT} aktif={profil.kulit} onPilih={(w) => ubah({ kulit: w })} label="Warna kulit" />
          {profil.model === 'tukang-visor' && (
            <>
              <div className="judul-kecil">RAMBUT</div>
              <Swatch warna={WARNA_RAMBUT} aktif={profil.rambut} onPilih={(w) => ubah({ rambut: w })} label="Warna rambut" />
            </>
          )}

          <div className="kartu-akun">
            {!akun ? (
              <>
                <b>Akun</b>
                <span>Belum masuk</span>
                <div className="tombol-akun">
                  <button className="tombol-game kuning kecil" disabled={masukJalan} onClick={() => pindah('/masuk?ke=/lobi', false)}>
                    MASUK / DAFTAR
                  </button>
                  <button className="tombol-game putih kecil" disabled={masukJalan} onClick={() => mulaiMasuk(true)}>
                    TAMU
                  </button>
                </div>
              </>
            ) : (
              <>
                <b>{saya ? `✓ ${saya.nama.toUpperCase()}` : 'Belum terdaftar sebagai toko'}</b>
                <button className="alamat-akun" onClick={salinAlamat} title="Salin alamat">
                  {pendek(akun.address)} · {disalin ? 'tersalin!' : 'salin'}
                </button>
                <span className="kecil-akun">{akun.jenis === 'privy' ? (akun.label ?? 'Akun Privy') : akun.jenis === 'mera' ? 'Passkey' : akun.jenis === 'dev' ? 'Akun dev anvil' : 'Akun tamu'}</span>
                {!saya && <span className="kecil-akun">Kirim alamat ini ke operator supaya didaftarkan sebagai toko.</span>}
                {saya && pro && (
                  <div className="baris-pro">
                    {pro.proSampai * 1000 > Date.now() ? (
                      <span className="badge-pro">★ TOKO PRO · sampai {tanggalPro(pro.proSampai)}</span>
                    ) : (
                      <button className="tombol-game kuning kecil" disabled={proJalan || pro.saldo < pro.hargaPro} onClick={beliPro}>
                        {proJalan ? 'MEMPROSES…' : `LANGGANAN PRO ${formatRupiah(pro.hargaPro)}/30 HARI`}
                      </button>
                    )}
                    <span className="kecil-akun">
                      Saldo toko {formatRupiah(pro.saldo)} · fee platform {pro.feeBps / 100}% dari payout. Pro: radius feed 3 km + badge, rebutan tetap adil.
                    </span>
                    {proPesan && <span className="kecil-akun">{proPesan}</span>}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      <footer className="kaki-lobi">
        <span className="muted-game">{alasan ?? 'Profil tersimpan di perangkat ini. Siap merebut order?'}</span>
        <button className={`tombol-game kuning besar ${akun ? '' : 'redup'}`} disabled={!akun} onClick={() => pindah('/cari')}>
          CARI LAWAN ▸
        </button>
      </footer>
    </main>
  );
}
