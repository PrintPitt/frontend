// Hand-over QR scanner for shops: back camera → BarcodeDetector (built into Chrome/Android) or jsQR (iOS Safari).
// There is also a manual field (paste the QR content) if the camera can't open.
import { useEffect, useRef, useState } from 'react';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

export default function PindaiQr({ onHasil, onTutup }: { onHasil: (teks: string) => void; onTutup: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [galat, setGalat] = useState('');
  const [manual, setManual] = useState('');
  const kirimRef = useRef(onHasil);
  kirimRef.current = onHasil;

  useEffect(() => {
    let berhenti = false;
    let stream: MediaStream | undefined;
    let t: ReturnType<typeof setTimeout>;
    const kanvas = document.createElement('canvas');
    const ctx = kanvas.getContext('2d', { willReadFrequently: true });
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    const detektor = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
    // jsQR (±130 kB) is only downloaded in browsers without BarcodeDetector
    let jsQR: typeof import('jsqr').default | null = null;
    if (!detektor) import('jsqr').then((m) => (jsQR = m.default)).catch(() => setGalat("Scanner failed to load. Paste the QR content below."));

    // ~6 times per second is enough for a QR on a phone screen, and saves battery/CPU.
    const putar = async () => {
      if (berhenti) return;
      const v = video.current;
      if (v && v.readyState >= 2 && ctx) {
        const skala = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
        kanvas.width = Math.round(v.videoWidth * skala);
        kanvas.height = Math.round(v.videoHeight * skala);
        ctx.drawImage(v, 0, 0, kanvas.width, kanvas.height);
        let teks: string | undefined;
        try {
          if (detektor) teks = (await detektor.detect(kanvas))[0]?.rawValue;
          else if (jsQR) teks = jsQR(ctx.getImageData(0, 0, kanvas.width, kanvas.height).data, kanvas.width, kanvas.height)?.data;
        } catch {
          /* bad frame: try the next one */
        }
        if (teks && !berhenti) return kirimRef.current(teks);
      }
      t = setTimeout(putar, 160);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        if (berhenti) return s.getTracks().forEach((x) => x.stop());
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        putar();
      })
      .catch(() => setGalat("Can't open the camera. Paste the QR content below."));
    if (!navigator.mediaDevices) setGalat('Camera needs HTTPS. Paste the QR content below.');

    return () => {
      berhenti = true;
      clearTimeout(t);
      stream?.getTracks().forEach((x) => x.stop());
    };
  }, []);

  return (
    <div className="kartu pindai-qr">
      <div className="isi-saldo-kepala">
        <b>Scan customer QR</b>
        <button className="tautan inline" onClick={onTutup}>
          close
        </button>
      </div>
      <video ref={video} playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000' }} />
      {galat && <p className="muted kecil">{galat}</p>}
      <div className="baris-manual">
        <input value={manual} placeholder="printpitt:<order>:<kode>" onChange={(e) => setManual(e.target.value)} autoComplete="off" />
        <button className="tombol" disabled={!manual} onClick={() => onHasil(manual)}>
          Use
        </button>
      </div>
    </div>
  );
}
