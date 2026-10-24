// Floating account button (bottom right) that opens /akun. Hidden on the projector board, the game and the sign-in page.
import { akunAktif } from '../lib/akun';
import { pindah } from '../lib/navigasi';

const SEMBUNYI = new Set(['/akun', '/masuk', '/layar', '/main', '/cari']);

export default function TombolAkun({ jalur }: { jalur: string }) {
  if (SEMBUNYI.has(jalur)) return null;
  const masuk = !!akunAktif();
  return (
    <button className={`tombol-akun-apung ${masuk ? 'masuk' : ''}`} onClick={() => pindah('/akun', false)} aria-label="Account">
      <span aria-hidden="true">👤</span> Account
    </button>
  );
}
