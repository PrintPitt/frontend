export const NAMA_LANGKAH: Record<number, string> = { 1: 'Photocopy', 2: 'Print', 3: 'Laminate' };

/** Recipe `bytes4` (one byte per step, from the left) -> list of step codes. */
export function bukaResep(langkah: string, jumlah: number): number[] {
  const v = BigInt(langkah);
  return Array.from({ length: jumlah }, (_, i) => Number((v >> BigInt(8 * (3 - i))) & 0xffn));
}

/** Indonesian-style number format. */
/** tIDRX amount (2 decimals) → "Rp5.000", rounded to whole Rupiah. Old name `mon` kept so callers don't change. */
export function mon(v: bigint, _digit?: number): string {
  void _digit;
  return 'Rp' + Math.round(Number(v) / 100).toLocaleString('id-ID');
}

export const pendek = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const ZERO = '0x0000000000000000000000000000000000000000';
