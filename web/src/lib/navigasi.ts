// Navigation without page reload, so an account signed in at the lobby (e.g. passkey) stays in use in the match.
import { useEffect, useState } from 'react';

const ACARA = 'pp:pindah';
const jalurSekarang = () => location.pathname.replace(/\/+$/, '') || '/';

/** Change page; the query string (e.g. ?dev=1) is carried over if `bawaQuery`. `ganti` = replaceState (no new history entry). */
export function pindah(jalur: string, bawaQuery = true, ganti = false) {
  const q = bawaQuery && !jalur.includes('?') ? location.search : '';
  if (ganti) history.replaceState(null, '', jalur + q);
  else history.pushState(null, '', jalur + q);
  dispatchEvent(new Event(ACARA));
}

export function useJalur() {
  const [jalur, setJalur] = useState(jalurSekarang);
  useEffect(() => {
    const ubah = () => setJalur(jalurSekarang());
    addEventListener(ACARA, ubah);
    addEventListener('popstate', ubah);
    return () => {
      removeEventListener(ACARA, ubah);
      removeEventListener('popstate', ubah);
    };
  }, []);
  return jalur;
}
