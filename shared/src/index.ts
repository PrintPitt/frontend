// Konstanta dan helper bersama untuk frontend dan script ops.
// Aturan di sini meniru contract FotokopiKilat; contract tetap sumber kebenaran.
import { deployments, fotokopiKilatAbi } from './fotokopiKilat.generated.ts';

export { deployments, fotokopiKilatAbi };

/** Kode langkah mini-game, sama dengan contract (1..3). */
export const LANGKAH = { FOTOKOPI: 1, PRINT: 2, LAMINATING: 3 } as const;
export type KodeLangkah = (typeof LANGKAH)[keyof typeof LANGKAH];

/** Status order, urutan sama dengan enum `Status` di contract. */
export const STATUS = ['None', 'Open', 'Claimed', 'Finished', 'Expired'] as const;

export const MAX_TEXT = 40;

/**
 * Gas limit per fungsi. Monad menagih gas LIMIT, bukan gas terpakai, jadi jangan pakai estimasi + buffer besar.
 * Angka = maks. terukur di EVM lokal (forge --gas-report) + ~30%. WAJIB diukur ulang di testnet (BLZ-07.T4).
 */
export const GAS_LIMIT = {
  createOrder: 250_000n,
  claim: 60_000n,
  completeStep: 180_000n,
  expire: 70_000n,
  withdraw: 60_000n,
} as const;

/** Validasi teks persis seperti `_teksValid` di contract: 1..40 byte ASCII cetak, tanpa < > & " ' \ */
export function teksValid(s: string): boolean {
  if (s.length === 0 || s.length > MAX_TEXT) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
    if ('<>&"\'\\'.includes(s[i])) return false;
  }
  return true;
}

/** Payout bila selesai setelah `kerja` detik; sama dengan `_payout` (pembulatan ke bawah). */
export function hitungPayout(harga: bigint, batasKerja: number, kerja: number): bigint {
  if (kerja >= batasKerja) return 0n;
  return (harga * BigInt(batasKerja - kerja)) / BigInt(batasKerja);
}

/** Ambil deployment untuk chain tertentu, atau lempar error yang jelas. */
export function deploymentUntuk(chainId: number | string) {
  const d = (deployments as Record<string, (typeof deployments)[keyof typeof deployments]>)[String(chainId)];
  if (!d) throw new Error(`Belum ada deployment untuk chain ${chainId}. Jalankan deploy lalu node script/export.mjs`);
  return d;
}
