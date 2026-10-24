import { useEffect, useState } from 'react';

/** Scale so a (w × h) px stage fits on screen with room left for the HUD. */
export function useSkala(w: number, h: number, sisaX = 40, sisaY = 200) {
  const hitung = () => Math.max(0.4, Math.min((innerWidth - sisaX) / w, (innerHeight - sisaY) / h));
  const [s, setS] = useState(hitung);
  useEffect(() => {
    const f = () => setS(hitung());
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  });
  return s;
}
