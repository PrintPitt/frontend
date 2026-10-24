// Toko Pro (v2.1, BLZ-27): langganan on-chain Rp50.000 / 30 hari dari saldo tIDRX toko ke treasury. Manfaat di backend
// (radius feed 3 km, badge, statistik); rebutan claim tetap setara. Butuh approve tIDRX ke contract sekali.
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

/** Approve tIDRX bila perlu, lalu `langgananPro(periode)`. Toko membayar gas sendiri (punya MON). */
export async function langgananPro(akun: Akun, periode = 1, hargaPro: bigint) {
  const bayar = hargaPro * BigInt(periode);
  const izin = await pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'allowance', args: [akun.address, kontrak.address] });
  if (izin < bayar) {
    const hash = await dompet(akun.account).writeContract({ address: TIDRX, abi: tidrxAbi, functionName: 'approve', args: [kontrak.address, bayar], gas: GAS_LIMIT.approve });
    const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
    if (r.status !== 'success') throw new Error('Approve tIDRX gagal');
  }
  return kirim(akun, 'langgananPro', [periode]);
}

export const tanggalPro = (detik: number) => new Date(detik * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
