// v2.3: shops register themselves (`daftarkanToko`) and can rename (`ubahNamaToko`). Shops pay their own gas (MON);
// if the MON balance is zero, ask the backend faucet first. Shared GAS_LIMIT doesn't cover these two functions yet, so use estimate + 25%.
import { teksValid } from '../../../shared/src/index.ts';
import type { Akun } from './akun';
import { bacaKode, mintaMon } from './backend';
import { dompet, kontrak, pub } from './chain';
import { pesanError } from './tx';

async function pastikanMon(akun: Akun) {
  const saldo = await pub.getBalance({ address: akun.address });
  if (saldo > 0n) return;
  await mintaMon(akun.address, bacaKode()); // mainnet: faucet wajib kode juri (diisi pengguna, disimpan setelah diterima)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if ((await pub.getBalance({ address: akun.address })) > 0n) return;
  }
  throw new Error('MON for gas has not arrived yet. Try again in a moment');
}

async function tulisToko(akun: Akun, functionName: 'daftarkanToko' | 'ubahNamaToko', nama: string) {
  if (!teksValid(nama)) throw new Error('Shop name: 1–40 plain characters (no emoji, no < > & " \' \\)');
  await pastikanMon(akun);
  const args = [nama] as const;
  const perkiraan = await pub.estimateContractGas({ ...kontrak, functionName, args, account: akun.account });
  const w = dompet(akun);
  const hash = await w.writeContract({ ...kontrak, functionName, args, account: akun.account, chain: w.chain, gas: (perkiraan * 125n) / 100n });
  const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
  if (r.status !== 'success') throw new Error('Transaction failed on chain');
  return hash;
}

export async function daftarkanToko(akun: Akun, nama: string) {
  try {
    return await tulisToko(akun, 'daftarkanToko', nama);
  } catch (e) {
    throw new Error(pesanError(e));
  }
}

export async function ubahNamaToko(akun: Akun, nama: string) {
  try {
    return await tulisToko(akun, 'ubahNamaToko', nama);
  } catch (e) {
    throw new Error(pesanError(e));
  }
}
