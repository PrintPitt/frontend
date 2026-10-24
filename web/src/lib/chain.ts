// Konfigurasi chain, client viem, dan contract untuk semua halaman.
import { createPublicClient, createWalletClient, http, webSocket, type Account, type Chain, type Hex, type Transport, type WalletClient } from 'viem';
import { anvil, monad, monadTestnet } from 'viem/chains';
import { deploymentUntuk, fotokopiKilatAbi } from '../../../shared/src/index.ts';

const env = import.meta.env;
const CHAIN_BAWAAN = Number(env.VITE_CHAIN_ID || 31337);

/**
 * Satu build melayani testnet dan mainnet: `?jaringan=mainnet` / `?jaringan=testnet` memilih jaringan dan diingat di
 * perangkat ini (localStorage); tanpa itu dipakai VITE_CHAIN_ID. Ganti jaringan = muat ulang halaman.
 */
export type Jaringan = 'mainnet' | 'testnet';
const KUNCI_JARINGAN = 'pp.jaringan';
function pilihChainId(): number {
  let pilih: string | null = null;
  try {
    const q = new URLSearchParams(location.search).get('jaringan');
    if (q === 'mainnet' || q === 'testnet') localStorage.setItem(KUNCI_JARINGAN, q);
    pilih = q ?? localStorage.getItem(KUNCI_JARINGAN);
  } catch {
    /* tanpa storage: pakai bawaan */
  }
  return pilih === 'mainnet' ? monad.id : pilih === 'testnet' ? monadTestnet.id : CHAIN_BAWAAN;
}
const CHAIN_ID = pilihChainId();
/** Env per-chain (alamat, RPC, WS) hanya berlaku untuk jaringan bawaan build; jaringan pilihan memakai shared + default. */
const PAKAI_ENV = CHAIN_ID === CHAIN_BAWAAN;
// 143 = Monad mainnet (IDRX asli), 10143 = testnet (tIDRX), lainnya = anvil lokal
const dasar = CHAIN_ID === monad.id ? monad : CHAIN_ID === monadTestnet.id ? monadTestnet : anvil;

export const RPC_URL: string =
  (dasar.id === monad.id ? env.VITE_RPC_URL_MAINNET : undefined) || (PAKAI_ENV && env.VITE_RPC_URL) || dasar.rpcUrls.default.http[0];
export const WS_URL: string | undefined =
  (PAKAI_ENV && env.VITE_WS_URL) || (dasar.id === anvil.id ? 'ws://127.0.0.1:8545' : undefined);
export const IS_ANVIL = dasar.id === anvil.id;
export const IS_MAINNET = dasar.id === monad.id;
export const JARINGAN: Jaringan = IS_MAINNET ? 'mainnet' : 'testnet';
/** IDRX asli (mainnet) tidak punya EIP-2612 `permit`: pesan tanpa gas butuh `approve` sekali dari wallet pengguna. */
export const TOKEN_PUNYA_PERMIT = !IS_MAINNET;

export const chain: Chain = {
  ...dasar,
  rpcUrls: { default: { http: [RPC_URL], ...(WS_URL ? { webSocket: [WS_URL] } : {}) } },
};

type Deployment = { address: string; tidrx?: string; batasAntre: number; batasJemput?: number; batasSengketa?: number; deployBlock?: number };
function cariDeployment(): Deployment | undefined {
  try {
    return deploymentUntuk(chain.id) as Deployment;
  } catch {
    return undefined;
  }
}
const dep = cariDeployment();
const alamat = ((PAKAI_ENV && env.VITE_CONTRACT_ADDRESS) || dep?.address) as Hex | undefined;
if (!alamat) throw new Error(`Belum ada alamat contract untuk chain ${chain.id}. Isi VITE_CONTRACT_ADDRESS atau ekspor deployment.`);

export const kontrak = { address: alamat, abi: fotokopiKilatAbi } as const;
/** Token Rupiah untuk escrow: tIDRX di testnet, IDRX asli di mainnet (nama variabel lama dipertahankan). */
export const TIDRX = ((PAKAI_ENV && env.VITE_TIDRX_ADDRESS) || dep?.tidrx) as Hex;
export const DEPLOY_BLOCK = BigInt(dep?.deployBlock ?? 0);
/** Detik setelah Siap sebelum order bisa ditutup tanpa serah terima (immutable di contract v2). */
export const BATAS_JEMPUT = dep?.batasJemput ?? 600;
/** v2.2: sengketa yang tidak diputuskan operator dalam waktu ini (setelah batas jemput) dibagi 50/50 oleh keeper (`tutupSengketa`). */
export const BATAS_SENGKETA = dep?.batasSengketa ?? 86_400;

/**
 * RPC publik Monad membatasi 15 call/dtk per IP (error -32011, juga per call di dalam batch) dan viem tidak mengulangnya.
 * Ulangi dengan jeda bertambah supaya muat awal halaman (katalog + toko ±15 read) tidak gagal total.
 */
function ulangSaatDibatasi(dasar: Transport): Transport {
  return (opts) => {
    const t = dasar(opts);
    const request: typeof t.request = async (args, o) => {
      for (let i = 0; ; i++) {
        try {
          return await t.request(args, o);
        } catch (e) {
          const dibatasi = (e as { code?: number }).code === -32011 || /requests limited/i.test(String((e as Error)?.message));
          if (!dibatasi || i >= 4) throw e;
          await new Promise((r) => setTimeout(r, 400 * 2 ** i + Math.random() * 300));
        }
      }
    };
    return { ...t, request };
  };
}

/** HTTP dengan JSON-RPC batch: banyak read digabung jadi satu request (hemat rate limit). */
export const pub = createPublicClient({ chain, transport: ulangSaatDibatasi(http(RPC_URL, { batch: { wait: 16 } })), pollingInterval: 300 });

/** Satu koneksi WebSocket untuk event live (/layar, /toko). Tanpa WS_URL jatuh ke polling HTTP. */
export const pubLive = WS_URL
  ? createPublicClient({ chain, transport: webSocket(WS_URL, { reconnect: true }), pollingInterval: 300 })
  : pub;
export const PAKAI_WS = !!WS_URL;

export function dompet(akun: { account: Account; klien?: WalletClient }): WalletClient {
  return akun.klien ?? createWalletClient({ chain, account: akun.account, transport: http(RPC_URL), pollingInterval: 300 });
}

/** Selisih detik antara jam chain (block.timestamp) dan jam lokal. */
export async function offsetChain(): Promise<number> {
  const b = await pub.getBlock();
  return Number(b.timestamp) - Date.now() / 1000;
}
