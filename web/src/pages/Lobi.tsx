// /lobi — player profile before matchmaking: set name, look (paper hat / visor), shirt, skin and hair color.
// The character stands big behind the shop counter (like the chef line-up in the Overcooked lobby) and jumps on every change.
// The account signs in here and is carried into the match without asking for a passkey again.
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
import { daftarkanToko, ubahNamaToko } from '../lib/toko';
import { bacaProfil, MAKS_NAMA, rapikanNama, simpanProfil, WARNA_BAJU, WARNA_KULIT, WARNA_RAMBUT, type Profil } from '../lib/profil';
import { formatRupiah } from '../../../shared/src/index.ts';
import { pesanError } from '../lib/tx';

const sama = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Character on stage: slowly looks left-right, jumps whenever `versi` changes. */
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
      {/* front counter: the character stands behind it */}
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
  const [namaTokoBaru, setNamaTokoBaru] = useState('');
  const [tokoJalan, setTokoJalan] = useState(false);
  const [tokoPesan, setTokoPesan] = useState('');
  const [gantiNama, setGantiNama] = useState(false);

  useEffect(() => {
    if (!akun && new URLSearchParams(location.search).has('dev')) masuk().then(setAkun);
  }, [akun]);
  useEffect(() => simpanProfil(profil), [profil]);
  const segarkanPro = useCallback(() => {
    if (akun) bacaPro(akun.address).then(setPro).catch(() => setPro(null));
  }, [akun]);
  useEffect(segarkanPro, [segarkanPro]);

  async function simpanToko(daftar: boolean) {
    if (!akun) return;
    const nama = namaTokoBaru.trim() || (profil.nama.trim() ? `${profil.nama.trim()}'s Shop` : '');
    if (!nama) return setTokoPesan('Enter a shop name first');
    setTokoJalan(true);
    setTokoPesan(daftar ? 'Registering shop on Monad…' : 'Renaming shop…');
    try {
      await (daftar ? daftarkanToko(akun, nama) : ubahNamaToko(akun, nama));
      setTokoPesan(daftar ? `Shop "${nama}" registered!` : 'Shop renamed');
      setGantiNama(false);
      setNamaTokoBaru('');
      segarkanPro();
    } catch (e) {
      setTokoPesan(e instanceof Error ? e.message : String(e));
    } finally {
      setTokoJalan(false);
    }
  }

  async function beliPro() {
    if (!akun || !pro) return;
    setProJalan(true);
    setProPesan('');
    try {
      await langgananPro(akun, 1, pro.hargaPro);
      setProPesan('Shop Pro active!');
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
  const namaToko = saya?.nama ?? 'SHOP';
  const namaTampil = profil.nama.trim() || namaToko;

  async function mulaiMasuk(burner: boolean) {
    setMasukJalan(true);
    try {
      setAkun(burner ? pakaiAkun(akunBurner()) : await masuk());
    } catch {
      /* passkey cancelled: stay in the lobby */
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

  const alasan = !akun ? 'Sign in to play' : !saya ? 'Register your shop in the account card first' : !s.sesiAktif ? 'Session not opened by the operator yet' : null;

  return (
    <main className="halaman-game lobi lobi-profil">
      <header className="kepala-lobi">
        <button className="tombol-game putih kecil" onClick={() => pindah('/')}>
          ‹ BACK
        </button>
        <h1 className="judul-game">LOBBY</h1>
        <div className="pil-live">
          <span className={`titik ${s.sesiAktif ? '' : 'mati'}`} /> {IS_ANVIL ? 'LOCAL ANVIL' : 'MONAD TESTNET'} · {s.sesiAktif ? `SESSION #${s.sesiId}` : 'SESSION NOT OPEN'}
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
            PLAYER NAME
          </label>
          <div className="isian-nama">
            <input
              id="nama-pemain"
              value={profil.nama}
              maxLength={MAKS_NAMA}
              placeholder={saya ? saya.nama : 'Your name'}
              onChange={(e) => setProfil((p) => ({ ...p, nama: rapikanNama(e.target.value) }))}
              onBlur={() => setVersi((v) => v + 1)}
              autoComplete="off"
            />
            <span>
              {profil.nama.length}/{MAKS_NAMA}
            </span>
          </div>

          <div className="judul-kecil">LOOK</div>
          <div className="pilih-rupa">
            {(
              [
                ['tukang', 'Paper hat'],
                ['tukang-visor', 'Green visor'],
              ] as const
            ).map(([m, label]) => (
              <button key={m} className={profil.model === m ? 'aktif' : ''} onClick={() => ubah({ model: m })}>
                {label}
              </button>
            ))}
          </div>

          <div className="judul-kecil">SHIRT COLOR</div>
          <Swatch warna={WARNA_BAJU} aktif={profil.warna} onPilih={(w) => ubah({ warna: w })} label="Shirt color" />
          <div className="judul-kecil">SKIN COLOR</div>
          <Swatch warna={WARNA_KULIT} aktif={profil.kulit} onPilih={(w) => ubah({ kulit: w })} label="Skin color" />
          {profil.model === 'tukang-visor' && (
            <>
              <div className="judul-kecil">HAIR</div>
              <Swatch warna={WARNA_RAMBUT} aktif={profil.rambut} onPilih={(w) => ubah({ rambut: w })} label="Hair color" />
            </>
          )}

          <div className="kartu-akun">
            {!akun ? (
              <>
                <b>Account</b>
                <span>Not signed in</span>
                <div className="tombol-akun">
                  <button className="tombol-game kuning kecil" disabled={masukJalan} onClick={() => pindah('/masuk?ke=/lobi', false)}>
                    SIGN IN / SIGN UP
                  </button>
                  <button className="tombol-game putih kecil" disabled={masukJalan} onClick={() => mulaiMasuk(true)}>
                    GUEST
                  </button>
                </div>
              </>
            ) : (
              <>
                <b>
                  {saya ? `✓ ${saya.nama.toUpperCase()}` : 'No shop yet'}
                  {saya && !gantiNama && (
                    <button className="tautan-kecil" onClick={() => (setGantiNama(true), setNamaTokoBaru(saya.nama))}>
                      rename
                    </button>
                  )}
                </b>
                {saya && !saya.aktif && <span className="kecil-akun galat-teks">This shop was disabled by the operator and can't claim orders.</span>}
                <button className="alamat-akun" onClick={salinAlamat} title="Copy address">
                  {pendek(akun.address)} · {disalin ? 'copied!' : 'copy'}
                </button>
                <span className="kecil-akun">{akun.jenis === 'privy' ? (akun.label ?? 'Privy account') : akun.jenis === 'mera' ? 'Passkey' : akun.jenis === 'dev' ? 'Anvil dev account' : 'Guest account'}</span>
                {(!saya || gantiNama) && (
                  <div className="form-toko">
                    <input
                      value={namaTokoBaru}
                      maxLength={40}
                      placeholder={profil.nama.trim() ? `${profil.nama.trim()}'s Shop` : 'Your shop name, e.g. Lucky Copy'}
                      onChange={(e) => setNamaTokoBaru(e.target.value)}
                      aria-label="Shop name"
                    />
                    <button className="tombol-game kuning kecil" disabled={tokoJalan} onClick={() => simpanToko(!saya)}>
                      {tokoJalan ? '…' : saya ? 'SAVE' : 'REGISTER SHOP'}
                    </button>
                    {saya && (
                      <button className="tombol-game putih kecil" disabled={tokoJalan} onClick={() => setGantiNama(false)}>
                        CANCEL
                      </button>
                    )}
                  </div>
                )}
                {!saya && !tokoPesan && <span className="kecil-akun">Shop sign-up is free, right on the contract. The faucet covers your first gas.</span>}
                {tokoPesan && <span className="kecil-akun">{tokoPesan}</span>}
                {saya && pro && (
                  <div className="baris-pro">
                    {pro.proSampai * 1000 > Date.now() ? (
                      <span className="badge-pro">★ SHOP PRO · until {tanggalPro(pro.proSampai)}</span>
                    ) : (
                      <button className="tombol-game kuning kecil" disabled={proJalan || pro.saldo < pro.hargaPro} onClick={beliPro}>
                        {proJalan ? 'PROCESSING…' : `GET PRO ${formatRupiah(pro.hargaPro)}/30 DAYS`}
                      </button>
                    )}
                    <span className="kecil-akun">
                      Shop balance {formatRupiah(pro.saldo)} · platform fee {pro.feeBps / 100}% of payout. Pro: 3 km feed radius + badge, claiming stays fair.
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
        <span className="muted-game">{alasan ?? 'Profile saved on this device. Ready to claim orders?'}</span>
        <button className={`tombol-game kuning besar ${akun ? '' : 'redup'}`} disabled={!akun} onClick={() => pindah('/cari')}>
          FIND MATCH ▸
        </button>
      </footer>
    </main>
  );
}
