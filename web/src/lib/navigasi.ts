// Navigasi tanpa muat ulang halaman, supaya akun (mis. passkey) yang sudah masuk di lobi tetap terpakai di match.
import { useEffect, useState } from 'react';

const ACARA = 'pp:pindah';
const jalurSekarang = () => location.pathname.replace(/\/+$/, '') || '/';

/** Pindah halaman; query string (mis. ?dev=1) ikut dibawa kalau `bawaQuery`. */
export function pindah(jalur: string, bawaQuery = true) {
  const q = bawaQuery && !jalur.includes('?') ? location.search : '';
  history.pushState(null, '', jalur + q);
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
