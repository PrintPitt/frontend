// v2.3: toko mendaftar sendiri (`daftarkanToko`) dan bisa ganti nama (`ubahNamaToko`). Toko membayar gas sendiri (MON);
// kalau saldo MON nol, minta faucet backend dulu. GAS_LIMIT shared belum memuat dua fungsi ini, jadi pakai estimasi + 25%.
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
  throw new Error('Saldo MON untuk gas belum masuk. Coba lagi sebentar');
}

async function tulisToko(akun: Akun, functionName: 'daftarkanToko' | 'ubahNamaToko', nama: string) {
  if (!teksValid(nama)) throw new Error('Nama toko 1–40 huruf biasa (tanpa emoji dan tanpa < > & " \' \\)');
  await pastikanMon(akun);
  const args = [nama] as const;
  const perkiraan = await pub.estimateContractGas({ ...kontrak, functionName, args, account: akun.account });
  const w = dompet(akun);
  const hash = await w.writeContract({ ...kontrak, functionName, args, account: akun.account, chain: w.chain, gas: (perkiraan * 125n) / 100n });
  const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
  if (r.status !== 'success') throw new Error('Transaksi gagal di chain');
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
