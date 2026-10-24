// Konfigurasi chain, client viem, dan contract untuk semua halaman.
import { createPublicClient, createWalletClient, http, webSocket, type Account, type Chain, type Hex } from 'viem';
import { anvil, monadTestnet } from 'viem/chains';
import { deploymentUntuk, fotokopiKilatAbi } from '../../../shared/src/index.ts';

const env = import.meta.env;
const CHAIN_ID = Number(env.VITE_CHAIN_ID || 31337);
const dasar = CHAIN_ID === monadTestnet.id ? monadTestnet : anvil;

export const RPC_URL: string = env.VITE_RPC_URL || dasar.rpcUrls.default.http[0];
export const WS_URL: string | undefined =
  env.VITE_WS_URL || (dasar.id === anvil.id ? 'ws://127.0.0.1:8545' : undefined);
export const IS_ANVIL = dasar.id === anvil.id;

export const chain: Chain = {
  ...dasar,
  rpcUrls: { default: { http: [RPC_URL], ...(WS_URL ? { webSocket: [WS_URL] } : {}) } },
};

type Deployment = { address: string; batasAntre: number; deployBlock?: number };
function cariDeployment(): Deployment | undefined {
  try {
    return deploymentUntuk(chain.id) as Deployment;
  } catch {
    return undefined;
  }
}
const dep = cariDeployment();
const alamat = (env.VITE_CONTRACT_ADDRESS || dep?.address) as Hex | undefined;
if (!alamat) throw new Error(`Belum ada alamat contract untuk chain ${chain.id}. Isi VITE_CONTRACT_ADDRESS atau ekspor deployment.`);

export const kontrak = { address: alamat, abi: fotokopiKilatAbi } as const;
export const DEPLOY_BLOCK = BigInt(dep?.deployBlock ?? 0);

/** HTTP dengan JSON-RPC batch: banyak read digabung jadi satu request (hemat rate limit). */
export const pub = createPublicClient({ chain, transport: http(RPC_URL, { batch: { wait: 16 } }), pollingInterval: 300 });

/** Satu koneksi WebSocket untuk event live (/layar, /toko). Tanpa WS_URL jatuh ke polling HTTP. */
export const pubLive = WS_URL
  ? createPublicClient({ chain, transport: webSocket(WS_URL, { reconnect: true }), pollingInterval: 300 })
  : pub;
export const PAKAI_WS = !!WS_URL;

export function dompet(account: Account) {
  return createWalletClient({ chain, account, transport: http(RPC_URL), pollingInterval: 300 });
}

/** Selisih detik antara jam chain (block.timestamp) dan jam lokal. */
export async function offsetChain(): Promise<number> {
  const b = await pub.getBlock();
  return Number(b.timestamp) - Date.now() / 1000;
}
