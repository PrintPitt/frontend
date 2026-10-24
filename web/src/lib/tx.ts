// Kirim tx ke FotokopiKilat dengan gas limit ketat (Monad menagih gas LIMIT, bukan gas terpakai; BLZ-08.T4).
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeEventLog,
  HttpRequestError,
  TimeoutError,
  WebSocketRequestError,
  type Hash,
  type TransactionReceipt,
} from 'viem';
import { GAS_LIMIT, tidrxAbi } from '../../../shared/src/index.ts';
import type { Akun } from './akun';
import { dompet, kontrak, pub, TIDRX } from './chain';

export type FnTulis = keyof typeof GAS_LIMIT;

/** Nama error contract → pesan untuk pengguna (Desain Contract bagian 8). */
const PESAN: Record<string, string> = {
  AlreadyClaimed: 'Diambil toko lain',
  ShopBusy: 'Toko masih mengerjakan order lain',
  NotShop: 'Alamat ini bukan toko terdaftar',
  SessionClosed: 'Sesi belum dibuka atau sudah ditutup',
  BadKind: 'Jenis order tidak tersedia',
  BadValue: 'Nominal bayar tidak sesuai harga',
  BadText: 'Teks tidak valid: 1–40 huruf ASCII, tanpa < > & " \' \\',
  QueueTimeout: 'Order sudah lewat batas antre',
  NotClaimed: 'Order sudah tidak dikerjakan',
  NotYourOrder: 'Ini bukan order tokomu',
  WrongStep: 'Urutan langkah salah',
  Late: 'Lewat batas waktu kerja',
  NotExpired: 'Belum lewat batas waktu',
  NothingToWithdraw: 'Tidak ada dana tertunda',
  BadPages: 'Jumlah halaman tidak valid (1–500)',
  NotReady: 'Order belum siap diserahkan',
  BadCode: 'QR tidak cocok dengan order ini',
  NotCustomer: 'Hanya pemesan yang bisa komplain',
  TooLate: 'Batas waktu komplain sudah lewat',
  NotDisputed: 'Order tidak sedang disengketakan',
  ERC20InsufficientBalance: 'Saldo tIDRX tidak cukup',
  ERC20InsufficientAllowance: 'Izin token (approve) kurang',
};

export class GagalTx extends Error {
  constructor(
    message: string,
    public hash?: Hash,
  ) {
    super(message);
  }
}

export function pesanError(e: unknown): string {
  if (e instanceof GagalTx) return e.message;
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const nama = revert?.data?.errorName;
    if (nama) return PESAN[nama] ?? nama;
    const http = e.walk((x) => x instanceof HttpRequestError) as HttpRequestError | null;
    if (http) return http.status === 429 ? 'Jaringan Monad sedang padat, coba lagi sebentar' : 'Tidak bisa terhubung ke jaringan Monad';
    if (e.walk((x) => x instanceof TimeoutError || x instanceof WebSocketRequestError)) return 'Koneksi ke Monad lambat, coba lagi';
    const teks = `${e.shortMessage} ${e.details ?? ''}`;
    if (/insufficient|reserve|balance/i.test(teks)) return 'Saldo MON tidak cukup';
    return e.shortMessage;
  }
  return e instanceof Error ? e.message.split('\n')[0] : String(e);
}

/** Biaya maksimum yang harus tertutup saldo: value + gas limit × max fee (aturan reserve balance Monad). */
export async function biayaMaks(fn: FnTulis, value = 0n): Promise<bigint> {
  const { maxFeePerGas } = await pub.estimateFeesPerGas();
  return value + GAS_LIMIT[fn] * (maxFeePerGas ?? 0n);
}

export type HasilTx = { hash: Hash; receipt: TransactionReceipt; events: { eventName: string; args: Record<string, unknown> }[] };

export async function kirim(akun: Akun, fn: FnTulis, args: readonly unknown[], value?: bigint): Promise<HasilTx> {
  const w = dompet(akun);
  const hash = await w.writeContract({ ...kontrak, account: akun.account, chain: w.chain, functionName: fn, args, value, gas: GAS_LIMIT[fn] } as never);
  const receipt = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
  if (receipt.status !== 'success') {
    // Gas limit tidak disimulasikan dulu (hemat waktu saat rebutan); cari nama error setelah revert.
    let alasan = 'Transaksi gagal';
    try {
      await pub.simulateContract({ ...kontrak, functionName: fn, args, value, account: akun.account } as never);
    } catch (e) {
      alasan = pesanError(e);
    }
    throw new GagalTx(alasan, hash);
  }
  const events = receipt.logs.flatMap((l) => {
    if (l.address.toLowerCase() !== kontrak.address.toLowerCase()) return [];
    try {
      const d = decodeEventLog({ abi: kontrak.abi, data: l.data, topics: l.topics });
      return [{ eventName: d.eventName as string, args: (d.args ?? {}) as Record<string, unknown> }];
    } catch {
      return [];
    }
  });
  return { hash, receipt, events };
}

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Revert yang bisa terjadi karena RPC publik tertinggal beberapa blok setelah claim / langkah sebelumnya. */
// 'Transaksi gagal' = revert yang simulasinya sekarang lolos (state RPC sudah menyusul).
const BISA_ULANG = ['Order sudah tidak dikerjakan', 'Ini bukan order tokomu', 'Urutan langkah salah', 'Transaksi gagal'];

/**
 * completeStep yang tahan RPC lambat: tunggu sebentar sampai `getOrder` memperlihatkan order ini Claimed oleh kita
 * (supaya tidak membayar tx yang pasti revert), lalu kirim; revert karena state tertinggal diulang maks. 2x.
 */
export async function kirimLangkah(akun: Akun, id: bigint, kode: number): Promise<HasilTx> {
  for (let i = 0; i < 10; i++) {
    try {
      const o = await pub.readContract({ ...kontrak, functionName: 'getOrder', args: [id] });
      if (o.status === 2 && o.toko.toLowerCase() === akun.address.toLowerCase()) break;
      if (o.status > 2) break; // sudah lewat Claimed: biarkan tx menjelaskan alasannya
    } catch {
      break;
    }
    await tidur(400);
  }
  for (let coba = 0; ; coba++) {
    try {
      return await kirim(akun, 'completeStep', [id, kode]);
    } catch (e) {
      if (coba >= 2 || !(e instanceof GagalTx) || !BISA_ULANG.includes(e.message)) throw e;
      await tidur(1000);
    }
  }
}

/** Approve tIDRX ke contract (untuk langgananPro). Lewati bila allowance sudah cukup. */
export async function izinkanToken(akun: Akun, nilai: bigint) {
  const ada = await pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'allowance', args: [akun.address, kontrak.address] });
  if (ada >= nilai) return;
  const w = dompet(akun);
  const hash = await w.writeContract({ address: TIDRX, abi: tidrxAbi, account: akun.account, chain: w.chain, functionName: 'approve', args: [kontrak.address, nilai], gas: GAS_LIMIT.approve });
  const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
  if (r.status !== 'success') throw new GagalTx('Approve tIDRX gagal', hash);
}
