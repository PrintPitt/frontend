// Shop Pro (v2.1, BLZ-27): on-chain subscription, Rp50.000 / 30 days from the shop's tIDRX balance to the treasury. Perks live in the backend
// (3 km feed radius, badge, stats); claim races stay fair. Needs a one-time tIDRX approve to the contract.
import type { Hex } from 'viem';
import { GAS_LIMIT, tidrxAbi } from '../../../shared/src/index.ts';
import type { Akun } from './akun';
import { dompet, kontrak, pub, TIDRX } from './chain';
import { kirim } from './tx';

export type InfoPro = { hargaPro: bigint; proSampai: number; saldo: bigint; feeBps: number };

export async function bacaPro(alamat: Hex): Promise<InfoPro> {
  const [hargaPro, proSampai, saldo, feeBps] = await Promise.all([
    pub.readContract({ ...kontrak, functionName: 'hargaPro' }),
    pub.readContract({ ...kontrak, functionName: 'proSampai', args: [alamat] }),
    pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'balanceOf', args: [alamat] }),
    pub.readContract({ ...kontrak, functionName: 'platformFeeBps' }),
  ]);
  return { hargaPro, proSampai: Number(proSampai), saldo, feeBps };
}

/** Approve tIDRX if needed, then `langgananPro(periode)`. The shop pays its own gas (has MON). */
export async function langgananPro(akun: Akun, periode = 1, hargaPro: bigint) {
  const bayar = hargaPro * BigInt(periode);
  const izin = await pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'allowance', args: [akun.address, kontrak.address] });
  if (izin < bayar) {
    const w = dompet(akun);
    const hash = await w.writeContract({ address: TIDRX, abi: tidrxAbi, account: akun.account, chain: w.chain, functionName: 'approve', args: [kontrak.address, bayar], gas: GAS_LIMIT.approve });
    const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
    if (r.status !== 'success') throw new Error('tIDRX approve failed');
  }
  return kirim(akun, 'langgananPro', [periode]);
}

export const tanggalPro = (detik: number) => new Date(detik * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
