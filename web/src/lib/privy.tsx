// Privy (login email/Google → embedded wallet) dipadukan dengan Mera (passkey). Aktif hanya bila VITE_PRIVY_APP_ID diisi;
// tanpa itu, komponen ini tidak merender apa-apa dan halaman /masuk hanya menawarkan passkey + tamu.
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createWalletClient, custom, type Hex } from 'viem';
import { pakaiAkun, type Akun } from './akun';
import { chain } from './chain';

export const PRIVY_APP_ID: string | undefined = import.meta.env.VITE_PRIVY_APP_ID || undefined;

export function PenyediaAuth({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        appearance: { theme: 'light', accentColor: '#836ef9', logo: '/favicon.svg' },
        defaultChain: chain,
        supportedChains: [chain],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

/** Tombol Google/email. Setelah login dan wallet siap, `onAkun` dipanggil sekali dengan Akun yang bisa menandatangani lewat Privy. */
export function TombolPrivy({ onAkun, onGalat, sibuk }: { onAkun: (a: Akun) => void; onGalat: (pesan: string) => void; sibuk?: boolean }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletSiap } = useWallets();
  const sudah = useRef(false);

  const bangun = useCallback(async () => {
    const w = wallets.find((x) => x.walletClientType === 'privy') ?? wallets[0];
    if (!w) return;
    try {
      const provider = await w.getEthereumProvider();
      const address = w.address as Hex;
      const klien = createWalletClient({ chain, transport: custom(provider), account: address });
      const label = user?.email?.address ?? user?.google?.email ?? user?.google?.name ?? undefined;
      onAkun(pakaiAkun({ account: { address, type: 'json-rpc' }, jenis: 'privy', address, klien, label, akhiri: () => void logout() }));
    } catch (e) {
      onGalat(e instanceof Error ? e.message : 'Wallet Privy gagal disiapkan');
    }
  }, [wallets, user, onAkun, onGalat, logout]);

  useEffect(() => {
    if (!ready || !authenticated || !walletSiap || wallets.length === 0 || sudah.current) return;
    sudah.current = true;
    void bangun();
  }, [ready, authenticated, walletSiap, wallets.length, bangun]);

  const masuk = (metode: 'google' | 'email') => {
    sudah.current = false;
    try {
      login({ loginMethods: [metode] });
    } catch (e) {
      onGalat(e instanceof Error ? e.message : 'Login Privy gagal');
    }
  };

  return (
    <>
      <button className="tombol-masuk google" disabled={!ready || sibuk} onClick={() => masuk('google')}>
        <span className="ikon-g">G</span> Lanjut dengan Google
      </button>
      <button className="tombol-masuk email" disabled={!ready || sibuk} onClick={() => masuk('email')}>
        ✉ Lanjut dengan email
      </button>
    </>
  );
}
