// Photocopy mini-game (BLZ-11.T1): drag the document onto the scanner glass until it fits, then press COPY.
import { animate, motion, useMotionValue } from 'motion/react';
import { useRef, useState } from 'react';
import { sfx } from './sfx';
import type { PropsMiniGame } from './tipe';

export default function Fotokopi({ teks, onLulus }: PropsMiniGame) {
  const arena = useRef<HTMLDivElement>(null);
  const kaca = useRef<HTMLDivElement>(null);
  const dok = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [pas, setPas] = useState(false);
  const [fase, setFase] = useState<'taruh' | 'scan' | 'selesai'>('taruh');
  const [pesan, setPesan] = useState('Drag the document onto the scanner glass');
  const [goyang, setGoyang] = useState(0);

  function lepas() {
    const k = kaca.current!.getBoundingClientRect();
    const d = dok.current!.getBoundingClientRect();
    const dx = k.left + k.width / 2 - (d.left + d.width / 2);
    const dy = k.top + k.height / 2 - (d.top + d.height / 2);
    if (Math.hypot(dx, dy) < Math.min(k.width, k.height) * 0.2) {
      animate(x, x.get() + dx, { type: 'spring', stiffness: 500, damping: 30 });
      animate(y, y.get() + dy, { type: 'spring', stiffness: 500, damping: 30 });
      setPas(true);
      setPesan('Perfect! Press COPY');
      sfx('klik');
    } else {
      setPas(false);
      setPesan('Not lined up yet, match the dashed line');
    }
  }

  function copy() {
    if (fase !== 'taruh') return;
    if (!pas) {
      sfx('gagal');
      setGoyang((g) => g + 1);
      setPesan('Crooked copy! Straighten the document first');
      return;
    }
    setFase('scan');
    sfx('mesin');
    setTimeout(() => {
      setFase('selesai');
      sfx('lulus');
      setTimeout(onLulus, 450);
    }, 1100);
  }

  return (
    <div className="mg">
      <div className="mg-pesan">{pesan}</div>
      <div className="mg-arena fotokopi" ref={arena}>
        <div className="baki">Tray</div>
        <motion.div className="mesin-scan" animate={{ x: goyang ? [0, -10, 10, -6, 6, 0] : 0 }} key={goyang}>
          <div className="kaca" ref={kaca}>
            <div className="target" />
            {fase === 'scan' && (
              <motion.div className="sinar" initial={{ left: '0%' }} animate={{ left: '100%' }} transition={{ duration: 1, ease: 'linear' }} />
            )}
          </div>
          <div className="panel-mesin">
            <button className="tombol-copy" onClick={copy} disabled={fase !== 'taruh'}>
              COPY
            </button>
          </div>
          {fase === 'selesai' && (
            <motion.div className="hasil-copy" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              {teks}
            </motion.div>
          )}
        </motion.div>
        <motion.div
          ref={dok}
          className={`dokumen ${pas ? 'pas' : ''}`}
          drag={fase === 'taruh'}
          dragMomentum={false}
          dragConstraints={arena}
          style={{ x, y, rotate: pas ? 0 : -6 }}
          onDragStart={() => setPas(false)}
          onDragEnd={lepas}
          whileDrag={{ scale: 1.06, rotate: 0 }}
        >
          <div className="dok-kepala">CARD / DOCUMENT</div>
          <div className="dok-teks">{teks}</div>
        </motion.div>
      </div>
    </div>
  );
}
