// Navigasi tanpa muat ulang halaman, supaya akun (mis. passkey) yang sudah masuk di lobi tetap terpakai di match.
import { useEffect, useState } from 'react';

const ACARA = 'pp:pindah';
const jalurSekarang = () => location.pathname.replace(/\/+$/, '') || '/';

/** Pindah halaman; query string (mis. ?dev=1) ikut dibawa kalau `bawaQuery`. `ganti` = replaceState (tanpa entri riwayat baru). */
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
