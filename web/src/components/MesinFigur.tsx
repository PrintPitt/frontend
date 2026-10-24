// Figur mesin isometrik (BLZ-16.T3) dari figures/ (Colorfigures, MIT). Halaman figur dimuat di iframe same-origin,
// bingkai halamannya disembunyikan, lalu mesinnya digerakkan lewat fungsi milik figur itu sendiri.
import { useEffect, useRef } from 'react';

const SUMBER: Record<number, string> = {
  1: '/figures/fotokopi/fotokopi.html',
  2: '/figures/printer/printer.html',
  3: '/figures/laminator/laminator.html',
};

const CSS = `header,.actions,.stats,.controls,.idea,.made-with,#readout,.toast{display:none!important}
html,body{background:transparent!important;margin:0!important;padding:0!important;height:100%;overflow:hidden}
body{display:block!important}.stage{max-width:none!important;width:100%!important;height:100%!important;margin:0!important}
svg#fig{width:100%!important;height:100%!important;display:block}`;

/** Satu "tick" demo per mesin; dipanggil berkala selama toko mengerjakan langkah itu. */
// Menangani kejadian bawaan figur juga: kertas macet (fotokopi tiap lembar ke-4), tinta/kertas habis (printer).
const TICK: Record<number, string> = {
  1: `{ const s = ui.st;
        if (s.jam) { if (s.door < .9) frontDoor(s); else pullJam(s); }
        else if (s.door > .05) frontDoor(s);
        else if (!s.paper) refillPaper(s);
        else { if (s.stack > 5) take(s); if (!s.doc) placeDoc(s); else copy(s); } }`,
  2: `{ const s = ui.st;
        if (!s.on) power(s);
        else if (s.swap > 0) {}
        else if (s.ink < 8) { if (s.cover < .9) cover(s); else swapInk(s); }
        else if (s.cover > .1) cover(s);
        else if (s.usb < .95) plug(s);
        else { if (!s.paper) refill(s);
          if (s.file < 0 || FILES[s.file].kind === 'virus') pick(s, FILES.findIndex(f => f.kind !== 'virus'));
          if (s.stack > 3) take(s); print(s); } }`,
  3: `{ const s = ui.st; if (s.pphase === 'ready' && s.setMic < 125) setMic(s, 125); else if (s.pphase === 'out') take(s); else feed(s); }`,
};

type JendelaFigur = Window & { eval: (kode: string) => unknown };

export default function MesinFigur({
  kode,
  jalan = true,
  yaw,
  pitch,
  kelas = 'mesin-figur',
  gaya,
}: {
  kode: number;
  jalan?: boolean;
  /** Sudut kamera figur (Colorfigures ?yaw=&pitch=); arena memakai yaw 0, pitch 55. */
  yaw?: number;
  pitch?: number;
  kelas?: string;
  gaya?: React.CSSProperties;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const siap = useRef(false);

  useEffect(() => {
    if (!jalan) return;
    const i = setInterval(() => {
      const w = ref.current?.contentWindow as JendelaFigur | null;
      if (!siap.current || !w) return;
      try {
        w.eval(TICK[kode]);
      } catch {}
    }, 1500);
    return () => clearInterval(i);
  }, [kode, jalan]);

  if (!SUMBER[kode]) return null;
  const q = yaw !== undefined || pitch !== undefined ? `?yaw=${yaw ?? 45}&pitch=${pitch ?? 35}` : '';
  return (
    <div className={kelas} style={gaya}>
      <iframe
        ref={ref}
        src={SUMBER[kode] + q}
        title="Mesin"
        tabIndex={-1}
        onLoad={() => {
          const d = ref.current?.contentDocument;
          if (!d) return;
          const s = d.createElement('style');
          s.textContent = CSS;
          d.head.appendChild(s);
          siap.current = true;
        }}
      />
    </div>
  );
}
