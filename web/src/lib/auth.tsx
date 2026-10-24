// Sign-in gate for all internal app pages. ONE auth integration point: `useAuth()` + `RequireAuth`.
// The /masuk page (Privy Google/email, Mera passkey, guest) exists; what's missing is the "must sign in" rule itself.
import { useEffect, type ReactNode } from 'react';
import { akunAktif, type Akun } from './akun';
import { pindah } from './navigasi';

/** Pages that can be opened without signing in. */
export const RUTE_PUBLIK = new Set(['/', '/masuk']);

// TODO(Dave): set to false (or remove) once useAuth() uses the real sign-in status.
const STUB_SELALU_MASUK = true;

export type StatusAuth = {
  /** false while sign-in status is still being checked (e.g. Privy not `ready` yet): the gate holds rendering. */
  siap: boolean;
  /** true = may enter internal pages. */
  masuk: boolean;
  /** The account in use (Privy/Mera/guest/dev), if one exists in this page session. */
  akun: Akun | null;
};

export function useAuth(): StatusAuth {
  const akun = akunAktif();
  // TODO(Dave): replace this stub with the real sign-in status, e.g. Privy `usePrivy()` (ready/authenticated)
  // and/or a stored Mera/guest account. For now ALL visitors count as signed in so the demo keeps working;
  // an existing wallet account (`akunAktif()`) also counts as signed in.
  return { siap: true, masuk: STUB_SELALU_MASUK || akun !== null, akun };
}

/** Wraps internal pages. Not signed in → /masuk?ke=<this page>; after sign-in, /masuk returns here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { siap, masuk } = useAuth();
  const ke = location.pathname + location.search;
  useEffect(() => {
    if (!siap || masuk) return;
    // deferred one tick: child effects run before the Router effect, so on first load the useJalur listener isn't attached yet.
    // replaceState so the Back button doesn't bounce to the rejected page.
    const t = setTimeout(() => pindah(`/masuk?ke=${encodeURIComponent(ke)}`, false, true), 0);
    return () => clearTimeout(t);
  }, [siap, masuk, ke]);
  if (!siap) return <p className="muted" style={{ padding: 24 }}>Loading…</p>;
  return masuk ? <>{children}</> : null;
}
