// Account layer (BLZ-08): Mera passkey first, burner wallet as automatic fallback.
// A Mera account is a plain EOA, so the faucet just sends plain MON (SPK-06).
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  deriveEvmPrivateKey,
  getPasskeyPrfOutput,
  type MeraErrorCode,
} from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { nonceManager, type Account, type Hex, type WalletClient } from 'viem';
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { IS_ANVIL } from './chain';
import { NAMA } from './merek';

export type JenisAkun = 'mera' | 'burner' | 'dev' | 'privy';
export type Akun = {
  /** Local account (Mera/burner/dev) or JSON-RPC account (Privy: signs via the provider in `klien`). */
  account: Account;
  /** Custom wallet client (Privy embedded wallet); if empty, built from the local `account`. */
  klien?: WalletClient;
  /** User label (email/Google name) for Privy accounts. */
  label?: string;
  jenis: JenisAkun;
  address: Hex;
  /** Why we fell back to burner (Mera error code), if any. */
  alasanFallback?: string;
  akhiri: () => void;
};

const KUNCI = { cred: 'fk.mera.credentialId', burner: 'fk.burner.pk' };
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk'; // public, anvil only

const simpan = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {}
  },
};

/** Passkeys only work on HTTPS / localhost in browsers with WebAuthn. */
export function passkeyMungkin(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'PublicKeyCredential' in window;
}

export const punyaPasskey = () => !!simpan.get(KUNCI.cred);
export const lupakanPasskey = () => simpan.set(KUNCI.cred, null);

function dariPrf(prfOutput: Uint8Array): Akun {
  const privateKey = deriveEvmPrivateKey({ prfOutput, accountIndex: 0 });
  const session = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0); // the session keeps its own copy
  const account = toViemAccount(session, { nonceManager });
  // Mera sessions have no built-in expiry: end it when the tab closes.
  const akhiri = () => session.end();
  addEventListener('pagehide', akhiri, { once: true });
  return { account, jenis: 'mera', address: account.address, akhiri };
}

async function masukMera(): Promise<Akun> {
  const rpId = location.hostname;
  const cred = simpan.get(KUNCI.cred);
  if (cred) {
    const r = await getPasskeyPrfOutput({ rpId, credential: { credentialId: cred } });
    return dariPrf(r.prfOutput);
  }
  const r = await createPasskeyWithPrfOutput({
    rp: { id: rpId, name: NAMA },
    user: { name: `pelanggan-${Date.now().toString(36)}`, displayName: `${NAMA} customer` },
  });
  simpan.set(KUNCI.cred, r.credentialId);
  return dariPrf(r.prfOutput);
}

/** Burner: random private key in localStorage (lost if storage is cleared; fine for a demo). */
export function akunBurner(alasanFallback?: string): Akun {
  let pk = simpan.get(KUNCI.burner) as Hex | null;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    simpan.set(KUNCI.burner, pk);
  }
  const account = privateKeyToAccount(pk, { nonceManager });
  return { account, jenis: 'burner', address: account.address, alasanFallback, akhiri: () => {} };
}

/** Anvil only: account i from the public anvil mnemonic (1 = Shop A, 2 = Shop B). */
export function akunDev(i: number): Akun {
  const account = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i, nonceManager });
  return { account, jenis: 'dev', address: account.address, akhiri: () => {} };
}

/**
 * Sign in: `?dev=<i>` (anvil), `?burner=1`, or Mera. If Mera fails because of the device (PRF_UNAVAILABLE, no WebAuthn)
 * → automatic burner. PASSKEY_CANCELLED is rethrown so the user can retry or pick burner.
 */
/** Account signed in during this page session (carried from lobby to match without asking for the passkey again). */
let akunSesi: Akun | null = null;
export const akunAktif = () => akunSesi;
export const pakaiAkun = (a: Akun) => (akunSesi = a);

export async function masuk(opsi: { paksaBurner?: boolean } = {}): Promise<Akun> {
  return pakaiAkun(await masukLangsung(opsi));
}

async function masukLangsung(opsi: { paksaBurner?: boolean }): Promise<Akun> {
  const q = new URLSearchParams(location.search);
  if (IS_ANVIL && q.has('dev')) return akunDev(Number(q.get('dev')) || 1);
  if (opsi.paksaBurner || q.get('burner') === '1') return akunBurner();
  if (!passkeyMungkin()) return akunBurner('NO_WEBAUTHN');
  try {
    return await masukMera();
  } catch (e) {
    const code = (e as { code?: MeraErrorCode }).code;
    if (code === 'PASSKEY_CANCELLED') throw e;
    return akunBurner(code ?? 'MERA_FAILED');
  }
}
