// Small corner badge: active network (testnet / mainnet, both tIDRX) + link to switch network (reloads the page).
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
    <button className={`lencana-jaringan ${JARINGAN}`} onClick={ganti} title={`Switch to ${lain}`}>
      {JARINGAN === 'mainnet' ? 'MAINNET' : 'TESTNET'} <span>switch to {lain}</span>
    </button>
  );
}
