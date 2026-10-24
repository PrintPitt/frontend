// Mini-game Print (BLZ-11.T2): pilih file yang benar dari flashdisk penuh virus, lalu atasi kertas macet.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from './sfx';
import type { PropsMiniGame } from './tipe';

const UMPAN = ['New Folder.exe', 'FINAL_fix_revisi3.docx.lnk', 'autorun.inf', 'tugas (1) (1).pdf.scr', 'foto_ktp.jpg.exe', 'Copy of Copy of skripsi.vbs'];
const acak = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);
const TAP_MACET = 5;

export default function Print({ teks, onLulus }: PropsMiniGame) {
  const nama = useMemo(() => teks.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'dokumen', [teks]);
  const benar = `${nama}.pdf`;
  const [file, setFile] = useState(() => acak([benar, `${nama}.pdf.exe`, ...acak(UMPAN).slice(0, 4)]));
  const [fase, setFase] = useState<'pilih' | 'cetak' | 'macet' | 'selesai'>('pilih');
  const [virus, setVirus] = useState(false);
  const [progres, setProgres] = useState(0);
  const [tap, setTap] = useState(TAP_MACET);
  const titikMacet = useRef(0.35 + Math.random() * 0.35);
  const sudahMacet = useRef(false);
  const prog = useRef(0);
  const lulus = useRef(onLulus);
  lulus.current = onLulus;

  function pilih(f: string) {
    if (fase !== 'pilih' || virus) return;
    if (f === benar) {
      sfx('klik');
      setFase('cetak');
      sfx('mesin');
    } else {
      sfx('gagal');
      setVirus(true);
      setTimeout(() => {
        setVirus(false);
        setFile((xs) => acak(xs));
      }, 1100);
    }
  }

  useEffect(() => {
    if (fase !== 'cetak') return;
    let t0 = performance.now();
    let raf = 0;
    const jalan = (t: number) => {
      const dt = (t - t0) / 1000;
      t0 = t;
      prog.current = Math.min(1, prog.current + dt / 2.4);
      setProgres(prog.current);
      if (!sudahMacet.current && prog.current >= titikMacet.current) {
        sudahMacet.current = true;
        setFase('macet');
        sfx('gagal');
        return;
      }
      if (prog.current >= 1) {
        setFase('selesai');
        sfx('lulus');
        setTimeout(() => lulus.current(), 450);
        return;
      }
      raf = requestAnimationFrame(jalan);
    };
    raf = requestAnimationFrame(jalan);
    return () => cancelAnimationFrame(raf);
  }, [fase]);

  function tarik() {
    sfx('klik');
    const n = tap - 1;
    setTap(Math.max(0, n));
    if (n <= 0) {
      setFase('cetak');
      sfx('mesin');
    }
  }

  return (
    <div className="mg">
      <div className="mg-pesan">
        {fase === 'pilih' ? `Cari file "${benar}"` : fase === 'macet' ? 'KERTAS MACET! Tarik kertasnya' : fase === 'selesai' ? 'Tercetak!' : 'Mencetak…'}
      </div>
      <div className="mg-arena print">
        {fase === 'pilih' ? (
          <div className="jendela">
            <div className="jendela-judul">FLASHDISK (E:) · {file.length} item</div>
            <div className="daftar-file">
              {file.map((f) => (
                <motion.button key={f} layout className="file" onClick={() => pilih(f)} whileTap={{ scale: 0.95 }}>
                  <span className="ikon-file">{/\.(pdf)$/.test(f) ? '📄' : '⚙️'}</span>
                  {f}
                </motion.button>
              ))}
            </div>
            <AnimatePresence>
              {virus && (
                <motion.div className="virus" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: [0, -3, 3, 0] }} exit={{ opacity: 0 }}>
                  VIRUS TERDETEKSI 🦠
                  <span>Flashdisk pelanggan memang begitu…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="printer-wrap">
            <motion.div className="printer" animate={fase === 'macet' ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ repeat: fase === 'macet' ? Infinity : 0, duration: 0.4 }}>
              <div className="printer-badan">
                <span className={`lampu ${fase === 'macet' ? 'merah' : 'hijau'}`} />
                PRINT
              </div>
              <div className="kertas-keluar" style={{ height: `${progres * 100}%` }}>
                <span>{teks}</span>
              </div>
            </motion.div>
            {fase === 'macet' && (
              <motion.button className="tombol utama besar tombol-tarik" onClick={tarik} whileTap={{ scale: 0.92 }}>
                TARIK KERTAS ({tap})
              </motion.button>
            )}
            <div className="bar tebal">
              <div style={{ width: `${progres * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
