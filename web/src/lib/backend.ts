// Klien backend PrintPitt (Railway; lokal :8787 saat anvil): config, top-up Rupiah → tIDRX (simulasi IDRX), relayer pesanan tanpa gas.
// Kontrak API: repo PrintPitt/backend src/server.ts + vault 04-Architecture/Desain Backend.md.
import { decodeEventLog, parseSignature, type Hash, type Hex } from 'viem';
import { domainPesanan, domainTidrx, fotokopiKilatAbi, NOL32, PERMIT_TYPES, PESANAN_TYPES, tidrxAbi } from '../../../shared/src/index.ts';
import type { Akun } from './akun';
import { chain, dompet, IS_ANVIL, kontrak, offsetChain, pub, TIDRX } from './chain';

const env = import.meta.env;
export const BACKEND_URL: string = (env.VITE_BACKEND_URL || (IS_ANVIL ? 'http://127.0.0.1:8787' : 'https://backend-production-2b31.up.railway.app')).replace(/\/$/, '');

const PESAN_BACKEND: Record<string, string> = {
  PENDING_ORDER: 'Pesananmu sebelumnya masih diproses, tunggu sebentar',
  RATE_LIMITED: 'Terlalu banyak permintaan dari jaringan ini, coba lagi sebentar',
  AMOUNT_TOO_LOW: 'Minimal isi saldo Rp20.000',
  AMOUNT_TOO_HIGH: 'Nominal isi saldo terlalu besar',
  ADDRESS_LIMIT: 'Batas isi saldo untuk akun ini sudah tercapai',
  RELAYER_DISABLED: 'Layanan pesan tanpa gas sedang mati',
  MINTER_DISABLED: 'Layanan isi saldo sedang mati',
  EXPIRED: 'Tagihan sudah kedaluwarsa, buat yang baru',
  BadSignature: 'Tanda tangan tidak cocok, coba pesan lagi',
  SignatureExpired: 'Tanda tangan kedaluwarsa, coba pesan lagi',
  FeeTooHigh: 'Biaya layanan berubah, coba pesan lagi',
  SessionClosed: 'Sesi belum dibuka. Tunggu aba-aba MC',
  BadKind: 'Jenis pesanan tidak tersedia',
  BadText: 'Teks tidak valid',
  BadPages: 'Jumlah halaman tidak valid',
  ERC20InsufficientBalance: 'Saldo tIDRX kurang. Isi saldo dulu',
  ERC20InsufficientAllowance: 'Izin pembayaran kurang, coba pesan lagi',
  RPC_ERROR: 'Jaringan Monad sedang sibuk, coba lagi',
  SEND_FAILED: 'Relayer gagal mengirim, coba lagi',
};

export class GalatBackend extends Error {
  constructor(public kode: string) {
    super(PESAN_BACKEND[kode] ?? `Layanan menjawab ${kode}`);
  }
}

async function api<T>(jalur: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(BACKEND_URL + jalur, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Server PrintPitt tidak bisa dihubungi');
  }
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new GalatBackend(j.error ?? `HTTP_${r.status}`);
  return j;
}

export type Config = { chainId: number; contract: Hex; token: Hex; relayer: Hex | null; feeRelay: string; topupMode: string; platformFeeBps?: number; treasury?: Hex; hargaPro?: string };
export const ambilConfig = () => api<Config>('/config');

export type TopUp = {
  id: string;
  reference: string;
  paymentMethod: 'va' | 'qris';
  channelId: 'MANDIRI' | 'BRI' | 'QRIS';
  baseAmount: number;
  amount: number;
  fees: { name: string; amount: number }[];
  virtualAccountNo?: string;
  virtualAccountName?: string;
  qrString?: string;
  paymentUrl: string;
  expiredDate: string;
  paymentStatus: 'WAITING_FOR_PAYMENT' | 'PAID' | 'EXPIRED';
  userMintStatus: 'NOT_MINTED' | 'PROCESSING' | 'MINTED' | 'FAILED';
};
export const buatTopup = (alamat: Hex, rp: number, metode: 'qris' | 'va', channel?: 'BRI' | 'MANDIRI') =>
  api<TopUp>('/topup', { toBeMinted: String(rp), destinationWalletAddress: alamat, paymentMethod: metode, channelId: channel });
export const ambilTopup = (id: string) => api<TopUp>(`/topup/${id}`);
/** Simulasi "uang masuk" (hanya di mode simulasi): backend mencetak tIDRX ke alamat tujuan. */
export const bayarTopup = (id: string) => api<TopUp>(`/topup/${id}/bayar`, {});

export const saldoTidrx = (alamat: Hex) => pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'balanceOf', args: [alamat] });

/**
 * Pesan tanpa gas: tanda tangani `Pesanan` (EIP-712) + `permit` tIDRX untuk harga + fee, kirim ke relayer,
 * tunggu receipt, kembalikan id order. Mode demo: 1 halaman, tanpa dokumen, tanpa kode serah terima.
 */
export async function pesanTanpaGas(akun: Akun, p: { jenis: number; teks: string; harga: bigint; fee: bigint }): Promise<{ id: bigint; hash: Hash }> {
  const pelanggan = akun.address;
  const [nonce, nonceToken, izinAda, offset] = await Promise.all([
    pub.readContract({ ...kontrak, functionName: 'nonces', args: [pelanggan] }),
    pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'nonces', args: [pelanggan] }),
    pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'allowance', args: [pelanggan, kontrak.address] }),
    offsetChain(),
  ]);
  const deadline = BigInt(Math.floor(Date.now() / 1000 + offset) + 600);
  const pesanan = { pelanggan, jenis: p.jenis, teks: p.teks, halaman: 1, dokumen: NOL32, kodeHash: NOL32, deadline, maxFee: p.fee } as const;
  const w = dompet(akun);
  const sig = await w.signTypedData({
    account: akun.account,
    domain: domainPesanan(chain.id, kontrak.address),
    types: PESANAN_TYPES,
    primaryType: 'Pesanan',
    message: { ...pesanan, nonce },
  });
  const nilai = p.harga + p.fee;
  let izin: Record<string, string | number> | null = null;
  if (izinAda < nilai) {
    const sigIzin = await w.signTypedData({
      account: akun.account,
      domain: domainTidrx(chain.id, TIDRX),
      types: PERMIT_TYPES,
      primaryType: 'Permit',
      message: { owner: pelanggan, spender: kontrak.address, value: nilai, nonce: nonceToken, deadline },
    });
    const { r, s, v, yParity } = parseSignature(sigIzin);
    izin = { value: String(nilai), deadline: String(deadline), v: Number(v ?? BigInt(27 + (yParity ?? 0))), r, s };
  }
  const { hash } = await api<{ hash: Hash }>('/relay/order', {
    pesanan: { ...pesanan, deadline: String(deadline), maxFee: String(p.fee) },
    sig,
    izin,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== 'success') throw new Error('Pesanan gagal di chain (revert). Saldo tidak terpotong');
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== kontrak.address.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: fotokopiKilatAbi, data: log.data, topics: log.topics });
      if (ev.eventName === 'OrderCreated') return { id: ev.args.id, hash };
    } catch {
      /* event lain */
    }
  }
  throw new Error('Pesanan terkirim, tapi nomor order tidak terbaca');
}
