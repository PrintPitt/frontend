// Lapisan akun (BLZ-08): Mera passkey sebagai utama, burner wallet sebagai fallback otomatis.
// Akun Mera = EOA biasa, jadi faucet cukup transfer MON biasa (SPK-06).
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  deriveEvmPrivateKey,
  getPasskeyPrfOutput,
  type MeraErrorCode,
} from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { nonceManager, type Hex, type LocalAccount } from 'viem';
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { IS_ANVIL } from './chain';
import { NAMA } from './merek';

export type JenisAkun = 'mera' | 'burner' | 'dev';
export type Akun = {
  account: LocalAccount;
  jenis: JenisAkun;
  address: Hex;
  /** Alasan jatuh ke burner (kode error Mera), bila ada. */
  alasanFallback?: string;
  akhiri: () => void;
};

const KUNCI = { cred: 'fk.mera.credentialId', burner: 'fk.burner.pk' };
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk'; // publik, hanya untuk anvil

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

/** Passkey hanya jalan di HTTPS / localhost dan browser yang punya WebAuthn. */
export function passkeyMungkin(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'PublicKeyCredential' in window;
}

export const punyaPasskey = () => !!simpan.get(KUNCI.cred);
export const lupakanPasskey = () => simpan.set(KUNCI.cred, null);

function dariPrf(prfOutput: Uint8Array): Akun {
  const privateKey = deriveEvmPrivateKey({ prfOutput, accountIndex: 0 });
  const session = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0); // session memegang salinannya sendiri
  const account = toViemAccount(session, { nonceManager });
  // Sesi Mera tidak punya expiry bawaan: akhiri saat tab ditutup.
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
    user: { name: `pelanggan-${Date.now().toString(36)}`, displayName: `Pelanggan ${NAMA}` },
  });
  simpan.set(KUNCI.cred, r.credentialId);
  return dariPrf(r.prfOutput);
}

/** Burner: private key acak di localStorage (hilang kalau storage dihapus; cukup untuk demo). */
export function akunBurner(alasanFallback?: string): Akun {
  let pk = simpan.get(KUNCI.burner) as Hex | null;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    simpan.set(KUNCI.burner, pk);
  }
  const account = privateKeyToAccount(pk, { nonceManager });
  return { account, jenis: 'burner', address: account.address, alasanFallback, akhiri: () => {} };
}

/** Khusus anvil: akun ke-i dari mnemonic publik anvil (1 = Toko A, 2 = Toko B). */
export function akunDev(i: number): Akun {
  const account = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i, nonceManager });
  return { account, jenis: 'dev', address: account.address, akhiri: () => {} };
}

/**
 * Masuk: `?dev=<i>` (anvil), `?burner=1`, atau Mera. Mera gagal karena perangkat (PRF_UNAVAILABLE, WebAuthn tidak ada)
 * → burner otomatis. PASSKEY_CANCELLED dilempar supaya pengguna bisa coba lagi atau memilih burner.
 */
/** Akun yang sudah masuk di sesi halaman ini (dibawa dari lobi ke match tanpa minta passkey lagi). */
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
  if (!passkeyMungkin()) return akunBurner('WEBAUTHN_TIDAK_ADA');
  try {
    return await masukMera();
  } catch (e) {
    const code = (e as { code?: MeraErrorCode }).code;
    if (code === 'PASSKEY_CANCELLED') throw e;
    return akunBurner(code ?? 'MERA_GAGAL');
  }
}
