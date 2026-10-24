// Lencana kecil di pojok: jaringan aktif (testnet tIDRX / mainnet IDRX asli) + tautan ganti jaringan (muat ulang halaman).
import { IS_ANVIL, JARINGAN } from '../lib/chain';

export default function LencanaJaringan() {
  if (IS_ANVIL) return null;
  const lain = JARINGAN === 'mainnet' ? 'testnet' : 'mainnet';
  const ganti = () => {
    const u = new URL(location.href);
    u.searchParams.set('jaringan', lain);
    location.href = u.toString();
  };
  return (
    <button className={`lencana-jaringan ${JARINGAN}`} onClick={ganti} title={`Pindah ke ${lain}`}>
      {JARINGAN === 'mainnet' ? 'MAINNET · IDRX' : 'TESTNET'} <span>ganti ke {lain}</span>
    </button>
  );
}
