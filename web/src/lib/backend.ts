// PrintPitt backend client (Railway; local :8787 on anvil): config, Rupiah top-up → tIDRX (simulated IDRX), gasless order relayer.
// API contract: repo PrintPitt/backend src/server.ts + vault 04-Architecture/Desain Backend.md.
import { decodeEventLog, maxUint256, parseSignature, type Hash, type Hex } from 'viem';
import {
  bulatkanKoordinat,
  domainPesanan,
  domainTidrx,
  fotokopiKilatAbi,
  GAS_LIMIT,
  NOL32,
  PERMIT_TYPES,
  PESANAN_TYPES,
  pesanLokasiOrder,
  pesanLokasiToko,
  pesanUnduh,
  tidrxAbi,
} from '../../../shared/src/index.ts';
import type { Akun } from './akun';
import { chain, dompet, IS_ANVIL, IS_MAINNET, kontrak, offsetChain, pub, TIDRX } from './chain';

const env = import.meta.env;
// Backend per network: mainnet → VITE_BACKEND_URL_MAINNET (default: Railway mainnet); testnet/anvil → VITE_BACKEND_URL
// (default: local anvil, Railway testnet).
export const BACKEND_URL: string = (
  IS_MAINNET
    ? env.VITE_BACKEND_URL_MAINNET || 'https://backend-mainnet-production-7835.up.railway.app'
    : env.VITE_BACKEND_URL || (IS_ANVIL ? 'http://127.0.0.1:8787' : 'https://backend-production-2b31.up.railway.app')
).replace(/\/$/, '');

const PESAN_BACKEND: Record<string, string> = {
  PENDING_ORDER: 'Your previous order is still processing, please wait a moment',
  RATE_LIMITED: 'Too many requests from this network, try again in a moment',
  AMOUNT_TOO_LOW: 'Minimum top-up is Rp20.000',
  AMOUNT_TOO_HIGH: 'Top-up amount is too large',
  ADDRESS_LIMIT: 'Top-up limit for this account has been reached',
  RELAYER_DISABLED: 'Gasless ordering is currently off',
  MINTER_DISABLED: 'Top-up service is currently off',
  EXPIRED: 'Invoice expired, create a new one',
  BadSignature: 'Signature does not match, try ordering again',
  SignatureExpired: 'Signature expired, try ordering again',
  FeeTooHigh: 'Service fee changed, try ordering again',
  SessionClosed: 'Session not open yet. Wait for the MC',
  BadKind: 'Order type not available',
  BadText: 'Invalid text',
  BadPages: 'Invalid page count',
  BAD_HALAMAN: 'Invalid page count (1–500)',
  EMPTY_FILE: 'File is empty',
  FILE_TOO_LARGE: 'File is too large',
  UNSUPPORTED_FILE: 'File format not supported (PDF, PNG, or JPEG)',
  SIGNATURE_EXPIRED: 'Signature expired, check your phone clock and try again',
  BAD_SIG: 'Signature does not match',
  BAD_COORDINATE: 'Invalid location coordinates',
  NOT_SHOP: 'This address is not a registered shop',
  NOT_OPEN: 'A shop already claimed the order, location no longer needed',
  SHOP_LOCATION_UNKNOWN: 'Shop location not set yet',
  NOT_THIS_ORDER: 'Document does not belong to this order',
  FORBIDDEN: 'Not allowed for this order',
  ALREADY_FUNDED: 'This address already received MON',
  FAUCET_EMPTY: 'MON faucet is empty',
  FAUCET_DISABLED: 'MON faucet is currently off',
  BAD_CODE: 'Wrong judge code',
  ALREADY_CLAIMED: 'Judge code already used for this account',
  VOUCHER_HABIS: 'Organizer voucher balance is empty. It is being refilled, try again shortly',
  FAUCET_LIMIT: 'Organizer MON allowance is used up, contact the organizers',
  KAS_DISABLED: 'Voucher service is currently off',
  ERC20InsufficientBalance: 'Not enough tIDRX. Top up first',
  ERC20InsufficientAllowance: 'Payment allowance too low, try ordering again',
  RPC_ERROR: 'Monad network is busy, try again',
  SEND_FAILED: 'Relayer could not send, try again',
};

export class GalatBackend extends Error {
  constructor(public kode: string) {
    super(PESAN_BACKEND[kode] ?? `Service replied ${kode}`);
  }
}

async function ambil(jalur: string, init?: RequestInit): Promise<Response> {
  let r: Response;
  try {
    if (!BACKEND_URL) throw new Error('Backend URL not set for this network (VITE_BACKEND_URL_MAINNET)');
    r = await fetch(BACKEND_URL + jalur, init);
  } catch {
    throw new Error('Cannot reach the PrintPitt server');
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
  /** simulasi (testnet), live, or voucher (mainnet: judge code, no checkout) */
  topupMode: 'simulasi' | 'live' | 'voucher' | string;
  radiusKm?: number;
  radiusProKm?: number;
};
export const ambilConfig = () => api<Config>('/config');

export type TopUp = {
  id: string;
  reference: string;
  paymentMethod: 'va' | 'qris' | 'voucher';
  channelId: 'MANDIRI' | 'BRI' | 'QRIS' | 'VOUCHER';
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
/** Simulated "payment received" (simulation mode only): the backend mints tIDRX to the destination address. */
export const bayarTopup = (id: string) => api<TopUp>(`/topup/${id}/bayar`, {});

export const saldoTidrx = (alamat: Hex) => pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'balanceOf', args: [alamat] });

/** Starter MON (for self-paid tx, e.g. `komplain`). The backend rejects addresses that were already funded. */
export const mintaMon = (alamat: Hex, kode = bacaKode()) => api<{ hash: Hash; amount: string }>('/faucet', { address: alamat, kode: kode || undefined });

// ---------------------------------------------------------------- judge code (mainnet: faucet + voucher via access code)

const KUNCI_KODE = 'pp.kode.juri';
export const bacaKode = () => {
  try {
    return localStorage.getItem(KUNCI_KODE) ?? '';
  } catch {
    return '';
  }
};
export const simpanKode = (kode: string) => {
  try {
    if (kode) localStorage.setItem(KUNCI_KODE, kode);
    else localStorage.removeItem(KUNCI_KODE);
  } catch {}
};

/** Voucher mode (`/config.topupMode === 'voucher'`): free balance for judges, amount set by the backend, PAID right away. */
export const buatVoucher = (alamat: Hex, kode: string) => api<TopUp>('/topup', { destinationWalletAddress: alamat, kode });

/**
 * Make sure the account has MON for self-paid tx (IDRX approve, complaint, shop sign-up). If short, ask the faucet
 * (with the judge code if any) and wait for the receipt. The faucet only serves new addresses (balance 0 and nonce 0).
 */
export async function pastikanMon(akun: Akun, perlu: bigint) {
  if ((await pub.getBalance({ address: akun.address })) >= perlu) return;
  try {
    const { hash } = await mintaMon(akun.address);
    await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  } catch (e) {
    if (e instanceof GalatBackend && e.kode === 'ALREADY_FUNDED') throw new Error('Not enough MON for gas, and this account already got MON from the faucet');
    throw e;
  }
}

/** One "judge code" step: MON from the faucet + IDRX from the voucher, then wait for the balance to arrive. */
export async function klaimKodeJuri(akun: Akun, kode: string): Promise<TopUp> {
  try {
    const { hash } = await mintaMon(akun.address, kode);
    simpanKode(kode); // faucet accepted the code → save it for later faucet calls (complaint, shop sign-up)
    void pub.waitForTransactionReceipt({ hash, timeout: 60_000 }).catch(() => {});
  } catch (e) {
    // existing accounts (already have MON/nonce) may still claim the voucher; wrong code / used-up allowance is reported.
    // ALREADY_FUNDED is only checked after the code, so the code is correct.
    if (!(e instanceof GalatBackend) || !['ALREADY_FUNDED', 'FAUCET_DISABLED'].includes(e.kode)) throw e;
    if (e.kode === 'ALREADY_FUNDED') simpanKode(kode);
  }
  let t = await buatVoucher(akun.address, kode);
  simpanKode(kode);
  for (let i = 0; i < 60 && t.userMintStatus !== 'MINTED' && t.userMintStatus !== 'FAILED'; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    t = await ambilTopup(t.id);
  }
  if (t.userMintStatus === 'FAILED') throw new Error('Voucher could not be sent. Contact the organizers');
  return t;
}

/**
 * Gasless order: sign `Pesanan` (EIP-712) + tIDRX `permit` for price + fee, send to the relayer,
 * wait for the receipt, return the order id. Demo mode: 1 page, no document, no hand-over code (`kodeHash` 0).
 * Real document order: `halaman`, `dokumen` (hash from POST /dokumen), `kodeHash` = keccak256(QR secret).
 */
export async function pesanTanpaGas(
  akun: Akun,
  p: { jenis: number; teks: string; harga: bigint; fee: bigint; halaman?: number; dokumen?: Hex; kodeHash?: Hex },
): Promise<{ id: bigint; hash: Hash }> {
  const pelanggan = akun.address;
  const nilai = p.harga + p.fee;
  // Permit support is detected per token, not per chain: tIDRX (testnet and mainnet) has EIP-2612 `nonces()`/`permit`.
  // A token without it (e.g. real IDRX, nonces() reverts) gets a one-time approve(max) from the user's wallet, then relay without permit.
  const nonceToken = await pub
    .readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'nonces', args: [pelanggan] })
    .catch(() => null);
  if (nonceToken === null) await izinkanSekali(akun, nilai);
  const [nonce, izinAda, offset] = await Promise.all([
    pub.readContract({ ...kontrak, functionName: 'nonces', args: [pelanggan] }),
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
  let izin: Record<string, string | number> | null = null;
  if (izinAda < nilai && nonceToken !== null) {
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
  if (receipt.status !== 'success') throw new Error('Order failed on-chain (revert). Your balance was not charged');
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== kontrak.address.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: fotokopiKilatAbi, data: log.data, topics: log.topics });
      if (ev.eventName === 'OrderCreated') return { id: ev.args.id, hash };
    } catch {
      /* other event */
    }
  }
  throw new Error('Order sent, but the order number could not be read');
}

/** `approve(contract, max)` if allowance < `perlu` (token without permit). MON gas from the faucet if short. */
async function izinkanSekali(akun: Akun, perlu: bigint) {
  const ada = await pub.readContract({ address: TIDRX, abi: tidrxAbi, functionName: 'allowance', args: [akun.address, kontrak.address] });
  if (ada >= perlu) return;
  const { maxFeePerGas } = await pub.estimateFeesPerGas();
  await pastikanMon(akun, GAS_LIMIT.approve * (maxFeePerGas ?? 0n));
  const w = dompet(akun);
  const hash = await w.writeContract({
    address: TIDRX,
    abi: tidrxAbi,
    account: akun.account,
    chain: w.chain,
    functionName: 'approve',
    args: [kontrak.address, maxUint256],
    gas: GAS_LIMIT.approve,
  });
  const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
  if (r.status !== 'success') throw new Error('IDRX payment approval failed');
}

// ---------------------------------------------------------------- documents + location (backend v2, Desain Backend section 14)

export type InfoDokumen = { dokumen: Hex; halaman: number; ukuran: number; mime: string; kedaluwarsa?: string };

/** Upload the raw file (encrypted on the server). `dokumen` is used in Pesanan; `halaman` is only an estimate (PDF). */
export async function unggahDokumen(file: File): Promise<InfoDokumen> {
  const r = await ambil('/dokumen', {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-nama-file': encodeURIComponent(file.name) },
    body: file,
  });
  return (await r.json()) as InfoDokumen;
}

export const infoDokumen = (hash: Hex) => api<InfoDokumen & { orderId?: string }>(`/dokumen/${hash}`);

/** Download the order document (customer, or the winning shop during Claimed/Siap/Sengketa) and save it via the browser. */
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

/** Device location, rounded to ±110 m (backend rule: the message is signed with the already-rounded coordinates). */
export function lokasiPerangkat(): Promise<Titik> {
  return new Promise((ok, gagal) => {
    if (!('geolocation' in navigator)) return gagal(new Error('This device has no GPS / location permission'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: bulatkanKoordinat(p.coords.latitude), lng: bulatkanKoordinat(p.coords.longitude) }),
      () => gagal(new Error('Location permission denied')),
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

/** Open orders within the shop radius (1.5 km; Pro shop 3 km). `semua` includes orders without location (mini-game / demo). */
export const ambilFeed = (toko: Hex, semua = true) => api<Feed>(`/toko/${toko}/feed${semua ? '?semua=1' : ''}`);
