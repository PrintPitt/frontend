// Laminating mini-game (BLZ-11.T3): hold to push the paper at a steady speed in the green zone.
// Too fast → crumpled (setback). Too slow while the paper is inside → overheats → burnt (setback).
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { sfx } from './sfx';
import type { PropsMiniGame } from './tipe';

const HIJAU: [number, number] = [0.4, 0.72];
const MERAH = 0.86;

export default function Laminating({ teks, onLulus }: PropsMiniGame) {
  const tahan = useRef(false);
  const st = useRef({ speed: 0, progres: 0, panas: 0, jeda: 0, selesai: false });
  const [, render] = useState(0);
  const [pesan, setPesan] = useState('HOLD to push. Keep the needle in the green zone');
  const lulus = useRef(onLulus);
  lulus.current = onLulus;

  useEffect(() => {
    let t0 = performance.now();
    let raf = 0;
    const jalan = (t: number) => {
      const dt = Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      const s = st.current;
      if (!s.selesai) {
        s.jeda = Math.max(0, s.jeda - dt);
        s.speed = Math.max(0, Math.min(1, s.speed + (tahan.current && s.jeda === 0 ? 0.85 : -0.7) * dt));
        const diHijau = s.speed >= HIJAU[0] && s.speed <= HIJAU[1];
        s.progres = Math.min(1, s.progres + dt * (diHijau ? 0.3 : s.speed > 0.15 ? 0.08 : 0));
        if (s.speed > MERAH) {
          s.progres = Math.max(0, s.progres - 0.2);
          s.speed = 0.2;
          s.jeda = 0.6;
          sfx('gagal');
          setPesan('Crumpled! Too fast, slow down');
        }
        s.panas = Math.max(0, Math.min(1, s.panas + (s.progres > 0.02 && s.speed < 0.2 ? 0.45 : -0.5) * dt));
        if (s.panas >= 1) {
          s.progres = Math.max(0, s.progres - 0.25);
          s.panas = 0;
          sfx('gagal');
          setPesan('Burnt! Paper stayed in too long');
        } else if (diHijau && s.jeda === 0) setPesan('Nice, keep it steady!');
        if (s.progres >= 1) {
          s.selesai = true;
          sfx('lulus');
          setPesan('Laminated perfectly!');
          setTimeout(() => lulus.current(), 450);
        }
      }
      render((n) => n + 1);
      raf = requestAnimationFrame(jalan);
    };
    raf = requestAnimationFrame(jalan);
    const turun = (e: KeyboardEvent) => e.code === 'Space' && ((tahan.current = true), e.preventDefault());
    const naik = (e: KeyboardEvent) => e.code === 'Space' && (tahan.current = false);
    addEventListener('keydown', turun);
    addEventListener('keyup', naik);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', turun);
      removeEventListener('keyup', naik);
    };
  }, []);

  const s = st.current;
  const set = (v: boolean) => () => (tahan.current = v);
  return (
    <div className="mg">
      <div className="mg-pesan">{pesan}</div>
      <div className="mg-arena laminating">
        <div className="laminator">
          <div className="celah" style={{ boxShadow: `0 0 ${10 + s.panas * 40}px rgba(244, 106, 76, ${0.25 + s.panas * 0.6})` }} />
          <motion.div className="kertas-lami" style={{ left: `${-62 + s.progres * 100}%` }}>
            {teks}
          </motion.div>
        </div>
        <div className="meter">
          <div className="zona-hijau" style={{ left: `${HIJAU[0] * 100}%`, width: `${(HIJAU[1] - HIJAU[0]) * 100}%` }} />
          <div className="zona-merah" style={{ left: `${MERAH * 100}%` }} />
          <div className="jarum" style={{ left: `${s.speed * 100}%` }} />
        </div>
        <div className="meter-bawah kecil muted">
          <span>slow</span>
          <span>heat {Math.round(s.panas * 100)}%</span>
          <span>too fast</span>
        </div>
        <button
          className="tombol utama besar tombol-tahan"
          onPointerDown={set(true)}
          onPointerUp={set(false)}
          onPointerLeave={set(false)}
          onPointerCancel={set(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          HOLD (or Space)
        </button>
        <div className="bar tebal">
          <div style={{ width: `${s.progres * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
