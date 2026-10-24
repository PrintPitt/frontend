import { formatEther } from 'viem';

export const NAMA_LANGKAH: Record<number, string> = { 1: 'Fotokopi', 2: 'Print', 3: 'Laminating' };

/** Resep `bytes4` (satu byte per langkah, dari kiri) jadi daftar kode langkah. */
export function bukaResep(langkah: string, jumlah: number): number[] {
  const v = BigInt(langkah);
  return Array.from({ length: jumlah }, (_, i) => Number((v >> BigInt(8 * (3 - i))) & 0xffn));
}

/** Format MON gaya Indonesia: 0,0137 */
export function mon(wei: bigint, digit = 4): string {
  return Number(formatEther(wei)).toLocaleString('id-ID', { maximumFractionDigits: digit });
}

export const pendek = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const ZERO = '0x0000000000000000000000000000000000000000';
