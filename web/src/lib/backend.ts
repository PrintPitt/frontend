// Klien backend PrintPitt (Railway; lokal :8787 saat anvil): config, top-up Rupiah → tIDRX (simulasi IDRX), relayer pesanan tanpa gas.
// Kontrak API: repo PrintPitt/backend src/server.ts + vault 04-Architecture/Desain Backend.md.
import { decodeEventLog, parseSignature, type Hash, type Hex } from 'viem';
import {
  bulatkanKoordinat,
  domainPesanan,
  domainTidrx,
  fotokopiKilatAbi,
  NOL32,
  PERMIT_TYPES,
  PESANAN_TYPES,
  pesanLokasiOrder,
  pesanLokasiToko,
  pesanUnduh,
  tidrxAbi,
} from '../../../shared/src/index.ts';
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
  BAD_HALAMAN: 'Jumlah halaman tidak valid (1–500)',
  EMPTY_FILE: 'File kosong',
  FILE_TOO_LARGE: 'File terlalu besar',
  UNSUPPORTED_FILE: 'Format file belum didukung (PDF, PNG, atau JPEG)',
  SIGNATURE_EXPIRED: 'Tanda tangan kedaluwarsa, cek jam HP lalu coba lagi',
  BAD_SIG: 'Tanda tangan tidak cocok',
  BAD_COORDINATE: 'Koordinat lokasi tidak valid',
  NOT_SHOP: 'Alamat ini belum terdaftar sebagai toko',
  NOT_OPEN: 'Order sudah diambil toko, lokasi tidak perlu lagi',
  SHOP_LOCATION_UNKNOWN: 'Lokasi toko belum diatur',
  NOT_THIS_ORDER: 'Dokumen bukan milik order ini',
  FORBIDDEN: 'Tidak berhak untuk order ini',
  ALREADY_FUNDED: 'Alamat ini sudah pernah dapat MON',
  FAUCET_EMPTY: 'Faucet MON sedang kosong',
  FAUCET_DISABLED: 'Faucet MON sedang mati',
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

async function ambil(jalur: string, init?: RequestInit): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(BACKEND_URL + jalur, init);
  } catch {
    throw new Error('Server PrintPitt tidak bisa dihubungi');
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new GalatBackend(j.error ?? `HTTP_${r.status}`);
  }
  return r;
}

async function api<T>(jalur: string, body?: unknown): Promise<T> {
  const r = await ambil(jalur, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({}))) as T;
}

export type Config = {
  chainId: number;
  contract: Hex;
  token: Hex;
  relayer: Hex | null;
  feeRelay: string;
  platformFeeBps?: number;
  treasury?: Hex;
  hargaPro?: string;
  topupMode: string;
  radiusKm?: number;
  radiusProKm?: number;
};
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

/** Saldo awal MON (untuk tx yang dibayar sendiri, mis. `komplain`). Backend menolak alamat yang sudah pernah didanai. */
export const mintaMon = (alamat: Hex) => api<{ hash: Hash; amount: string }>('/faucet', { address: alamat });

/**
 * Pesan tanpa gas: tanda tangani `Pesanan` (EIP-712) + `permit` tIDRX untuk harga + fee, kirim ke relayer,
 * tunggu receipt, kembalikan id order. Mode demo: 1 halaman, tanpa dokumen, tanpa kode serah terima (`kodeHash` 0).
 * Order dokumen nyata: `halaman`, `dokumen` (hash dari POST /dokumen), `kodeHash` = keccak256(rahasia QR).
 */
export async function pesanTanpaGas(
  akun: Akun,
  p: { jenis: number; teks: string; harga: bigint; fee: bigint; halaman?: number; dokumen?: Hex; kodeHash?: Hex },
): Promise<{ id: bigint; hash: Hash }> {
  const pelanggan = akun.address;
  const [nonce, nonceToken, izinAda, offset] = await Promise.all([
    pub.readContract({ ...kontrak, functionName: 'nonces', args: [pelanggan] }),
    pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'nonces', args: [pelanggan] }),
    pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'allowance', args: [pelanggan, kontrak.address] }),
    offsetChain(),
  ]);
  const deadline = BigInt(Math.floor(Date.now() / 1000 + offset) + 600);
  const pesanan = {
    pelanggan,
    jenis: p.jenis,
    teks: p.teks,
    halaman: p.halaman ?? 1,
    dokumen: p.dokumen ?? NOL32,
    kodeHash: p.kodeHash ?? NOL32,
    deadline,
    maxFee: p.fee,
  } as const;
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

// ---------------------------------------------------------------- dokumen + lokasi (backend v2, Desain Backend bagian 14)

export type InfoDokumen = { dokumen: Hex; halaman: number; ukuran: number; mime: string; kedaluwarsa?: string };

/** Unggah file mentah (terenkripsi di server). `dokumen` dipakai di Pesanan; `halaman` hanya perkiraan (PDF). */
export async function unggahDokumen(file: File): Promise<InfoDokumen> {
  const r = await ambil('/dokumen', {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-nama-file': encodeURIComponent(file.name) },
    body: file,
  });
  return (await r.json()) as InfoDokumen;
}

export const infoDokumen = (hash: Hex) => api<InfoDokumen & { orderId?: string }>(`/dokumen/${hash}`);

/** Unduh dokumen order (pelanggan, atau toko pemenang selama Claimed/Siap/Sengketa) lalu simpan lewat browser. */
export async function unduhDokumen(akun: Akun, hash: Hex, orderId: bigint) {
  const waktu = Date.now();
  const sig = await dompet(akun).signMessage({ account: akun.account, message: pesanUnduh(hash, orderId, waktu) });
  const r = await ambil(`/dokumen/${hash}/unduh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId: String(orderId), alamat: akun.address, waktu, sig }),
  });
  const nama = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? `order-${orderId}`;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nama });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type Titik = { lat: number; lng: number };

/** Lokasi perangkat, dibulatkan ±110 m (aturan backend: pesan ditandatangani dengan koordinat yang sudah dibulatkan). */
export function lokasiPerangkat(): Promise<Titik> {
  return new Promise((ok, gagal) => {
    if (!('geolocation' in navigator)) return gagal(new Error('Perangkat ini tidak punya GPS / izin lokasi'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: bulatkanKoordinat(p.coords.latitude), lng: bulatkanKoordinat(p.coords.longitude) }),
      () => gagal(new Error('Izin lokasi ditolak')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export async function kirimLokasiToko(akun: Akun, t: Titik) {
  const lat = bulatkanKoordinat(t.lat);
  const lng = bulatkanKoordinat(t.lng);
  const waktu = Date.now();
  const sig = await dompet(akun).signMessage({ account: akun.account, message: pesanLokasiToko(akun.address, lat, lng, waktu) });
  return api<{ toko: Hex; lat: number; lng: number; radiusKm: number }>('/toko/lokasi', { toko: akun.address, lat, lng, waktu, sig });
}

export async function kirimLokasiOrder(akun: Akun, id: bigint, t: Titik) {
  const lat = bulatkanKoordinat(t.lat);
  const lng = bulatkanKoordinat(t.lng);
  const waktu = Date.now();
  const sig = await dompet(akun).signMessage({ account: akun.account, message: pesanLokasiOrder(id, lat, lng, waktu) });
  return api<{ orderId: string; lat: number; lng: number }>(`/order/${id}/lokasi`, { lat, lng, waktu, sig });
}

export type ItemFeed = {
  id: string;
  jenis: number;
  halaman: number;
  harga: string;
  batasKerja: number;
  teks: string;
  adaDokumen: boolean;
  pakaiKode: boolean;
  dibuatPada: number;
  sisaAntre: number;
  jarakKm: number | null;
};
export type Feed = { toko: (Titik & { diperbarui: number }) | null; radiusKm: number; pro: boolean; order: ItemFeed[] };

/** Order Open dalam radius toko (1,5 km; Toko Pro 3 km). `semua` ikut order tanpa lokasi (mini-game / demo). */
export const ambilFeed = (toko: Hex, semua = true) => api<Feed>(`/toko/${toko}/feed${semua ? '?semua=1' : ''}`);
