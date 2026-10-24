// Gerbang login untuk semua halaman internal app. SATU titik integrasi auth: `useAuth()` + `RequireAuth`.
// Halaman /masuk (Privy Google/email, Mera passkey, tamu) sudah ada; yang belum: aturan "harus login" itu sendiri.
import { useEffect, type ReactNode } from 'react';
import { akunAktif, type Akun } from './akun';
import { pindah } from './navigasi';

/** Halaman yang boleh dibuka tanpa login. */
export const RUTE_PUBLIK = new Set(['/masuk']);

// TODO(Dave): set false (atau hapus) begitu useAuth() memakai status login sebenarnya.
const STUB_SELALU_MASUK = true;

export type StatusAuth = {
  /** false selama status login masih dicek (mis. Privy belum `ready`): gerbang menahan render. */
  siap: boolean;
  /** true = boleh masuk halaman internal. */
  masuk: boolean;
  /** Akun yang sedang dipakai (Privy/Mera/tamu/dev), bila sudah ada di sesi halaman ini. */
  akun: Akun | null;
};

export function useAuth(): StatusAuth {
  const akun = akunAktif();
  // TODO(Dave): ganti stub ini dengan status login sebenarnya, mis. Privy `usePrivy()` (ready/authenticated)
  // dan/atau akun Mera/tamu yang tersimpan. Sementara SEMUA pengunjung dianggap sudah login supaya demo tetap jalan;
  // akun dompet yang sudah ada (`akunAktif()`) juga dihitung login.
  return { siap: true, masuk: STUB_SELALU_MASUK || akun !== null, akun };
}

/** Bungkus halaman internal. Belum login → /masuk?ke=<halaman ini>; setelah masuk, /masuk mengembalikan ke sini. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { siap, masuk } = useAuth();
  const ke = location.pathname + location.search;
  useEffect(() => {
    if (siap && !masuk) pindah(`/masuk?ke=${encodeURIComponent(ke)}`, false);
  }, [siap, masuk, ke]);
  if (!siap) return <p className="muted" style={{ padding: 24 }}>Memuat…</p>;
  return masuk ? <>{children}</> : null;
}
