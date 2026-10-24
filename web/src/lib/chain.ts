// Chain config, viem clients, and the contract for all pages.
import { createPublicClient, createWalletClient, http, webSocket, type Account, type Chain, type Hex, type Transport, type WalletClient } from 'viem';
import { anvil, monad, monadTestnet } from 'viem/chains';
import { deploymentUntuk, fotokopiKilatAbi } from '../../../shared/src/index.ts';

const env = import.meta.env;
const CHAIN_BAWAAN = Number(env.VITE_CHAIN_ID || 31337);

/**
 * One build serves testnet and mainnet: `?jaringan=mainnet` / `?jaringan=testnet` picks the network and is remembered on
 * this device (localStorage); otherwise VITE_CHAIN_ID is used. Switching network = reload the page.
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
    /* no storage: use the default */
  }
  return pilih === 'mainnet' ? monad.id : pilih === 'testnet' ? monadTestnet.id : CHAIN_BAWAAN;
}
const CHAIN_ID = pilihChainId();
/** Per-chain env (address, RPC, WS) only applies to the build's default network; a chosen network uses shared + defaults. */
const PAKAI_ENV = CHAIN_ID === CHAIN_BAWAAN;
// 143 = Monad mainnet (real IDRX), 10143 = testnet (tIDRX), anything else = local anvil
const dasar = CHAIN_ID === monad.id ? monad : CHAIN_ID === monadTestnet.id ? monadTestnet : anvil;

export const RPC_URL: string =
  (dasar.id === monad.id ? env.VITE_RPC_URL_MAINNET : undefined) || (PAKAI_ENV && env.VITE_RPC_URL) || dasar.rpcUrls.default.http[0];
export const WS_URL: string | undefined =
  (PAKAI_ENV && env.VITE_WS_URL) || (dasar.id === anvil.id ? 'ws://127.0.0.1:8545' : undefined);
export const IS_ANVIL = dasar.id === anvil.id;
export const IS_MAINNET = dasar.id === monad.id;
export const JARINGAN: Jaringan = IS_MAINNET ? 'mainnet' : 'testnet';
/** Real IDRX (mainnet) has no EIP-2612 `permit`: gasless orders need a one-time `approve` from the user's wallet. */
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
if (!alamat) throw new Error(`No contract address for chain ${chain.id}. Set VITE_CONTRACT_ADDRESS or export the deployment.`);

export const kontrak = { address: alamat, abi: fotokopiKilatAbi } as const;
/** Rupiah token for escrow: tIDRX on testnet, real IDRX on mainnet (old variable name kept). */
export const TIDRX = ((PAKAI_ENV && env.VITE_TIDRX_ADDRESS) || dep?.tidrx) as Hex;
export const DEPLOY_BLOCK = BigInt(dep?.deployBlock ?? 0);
/** Seconds after Siap before an order can be closed without hand-over (immutable in contract v2). */
export const BATAS_JEMPUT = dep?.batasJemput ?? 600;
/** v2.2: a dispute the operator does not decide within this time (after the pickup deadline) is split 50/50 by the keeper (`tutupSengketa`). */
export const BATAS_SENGKETA = dep?.batasSengketa ?? 86_400;

/**
 * Monad's public RPC limits 15 calls/s per IP (error -32011, also per call inside a batch) and viem does not retry.
 * Retry with growing backoff so the initial page load (catalog + shops, ~15 reads) does not fail outright.
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

/** HTTP with JSON-RPC batching: many reads merged into one request (saves rate limit). */
export const pub = createPublicClient({ chain, transport: ulangSaatDibatasi(http(RPC_URL, { batch: { wait: 16 } })), pollingInterval: 300 });

/** One WebSocket connection for live events (/layar, /toko). Without WS_URL it falls back to HTTP polling. */
export const pubLive = WS_URL
  ? createPublicClient({ chain, transport: webSocket(WS_URL, { reconnect: true }), pollingInterval: 300 })
  : pub;
export const PAKAI_WS = !!WS_URL;

export function dompet(akun: { account: Account; klien?: WalletClient }): WalletClient {
  return akun.klien ?? createWalletClient({ chain, account: akun.account, transport: http(RPC_URL), pollingInterval: 300 });
}

/** Difference in seconds between the chain clock (block.timestamp) and the local clock. */
export async function offsetChain(): Promise<number> {
  const b = await pub.getBlock();
  return Number(b.timestamp) - Date.now() / 1000;
}
