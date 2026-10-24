// Faucet backend (BLZ-08.T3): kirim saldo awal MON sekali per alamat baru.
// Dipakai Vercel function (api/faucet.ts) dan middleware `vite dev` (vite.config.ts).
// "Sekali per alamat" dicek on-chain (nonce 0 dan saldo kosong), jadi tidak butuh database.
import { createPublicClient, createWalletClient, formatEther, http, isAddress, nonceManager, parseEther, type Hex } from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

type Env = Record<string, string | undefined>;
export type HasilFaucet = { status: number; body: Record<string, unknown> };

const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk'; // publik, hanya anvil

async function buat(env: Env) {
  const rpc = env.FAUCET_RPC_URL || env.VITE_RPC_URL;
  if (!rpc) throw new Error('FAUCET_RPC_URL belum di-set');
  const key = env.FAUCET_PRIVATE_KEY as Hex | undefined;
  const account = key
    ? privateKeyToAccount(key, { nonceManager })
    : env.FAUCET_DEV_ANVIL === '1'
      ? mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 5, nonceManager })
      : undefined;
  if (!account) throw new Error('FAUCET_PRIVATE_KEY belum di-set');
  const transport = http(rpc);
  const pub = createPublicClient({ transport, pollingInterval: 250 });
  const id = await pub.getChainId();
  const chain = { id, name: `chain-${id}`, nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } };
  const wallet = createWalletClient({ account, chain, transport, pollingInterval: 250 });
  return { account, pub, wallet, chainId: id, jumlah: parseEther(env.FAUCET_AMOUNT_MON || '0.1') };
}

let faucet: ReturnType<typeof buat> | undefined;
const sedangDiproses = new Set<string>();

export async function kirimSaldoAwal(alamat: unknown, env: Env): Promise<HasilFaucet> {
  if (typeof alamat !== 'string' || !isAddress(alamat)) return { status: 400, body: { error: 'Alamat tidak valid' } };
  const kunci = alamat.toLowerCase();
  if (sedangDiproses.has(kunci)) return { status: 409, body: { error: 'Permintaan sedang diproses' } };
  sedangDiproses.add(kunci);
  try {
    const f = await (faucet ??= buat(env));
    const [saldo, nonce, saldoFaucet, gasPrice] = await Promise.all([
      f.pub.getBalance({ address: alamat }),
      f.pub.getTransactionCount({ address: alamat }),
      f.pub.getBalance({ address: f.account.address }),
      f.pub.getGasPrice(),
    ]);
    if (nonce > 0 || saldo >= f.jumlah / 2n)
      return { status: 409, body: { error: 'Alamat ini sudah pernah didanai', saldo: formatEther(saldo) } };
    if (saldoFaucet < f.jumlah + 21_000n * gasPrice * 2n)
      return { status: 503, body: { error: 'Saldo faucet habis, hubungi panitia tim' } };

    const kirim = () => f.wallet.sendTransaction({ to: alamat, value: f.jumlah, gas: 21_000n });
    let hash: Hex;
    try {
      hash = await kirim();
    } catch (e) {
      // Nonce bentrok (instance lain / tx sebelumnya gagal): reset lalu coba sekali lagi.
      if (!/nonce/i.test(String(e))) throw e;
      nonceManager.reset({ address: f.account.address, chainId: f.chainId });
      hash = await kirim();
    }
    const r = await f.pub.waitForTransactionReceipt({ hash, timeout: 20_000 });
    return { status: r.status === 'success' ? 200 : 500, body: { hash, jumlah: formatEther(f.jumlah) } };
  } catch (e) {
    return { status: 500, body: { error: (e as Error).message.split('\n')[0] } };
  } finally {
    sedangDiproses.delete(kunci);
  }
}
