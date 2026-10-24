// Send txs to FotokopiKilat with a tight gas limit (Monad charges the gas LIMIT, not gas used; BLZ-08.T4).
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
import { GAS_LIMIT } from '../../../shared/src/index.ts';
import type { Akun } from './akun';
import { dompet, kontrak, pub } from './chain';

export type FnTulis = keyof typeof GAS_LIMIT;

/** Contract error name → user message (Contract Design section 8). */
const PESAN: Record<string, string> = {
  AlreadyClaimed: 'Diambil toko lain',
  ShopBusy: 'Shop is still working on another order',
  NotShop: 'This address is not a registered shop',
  ShopInactive: 'This shop was disabled by the operator',
  ShopExists: 'This address is already a registered shop',
  SessionClosed: 'Session not open yet or already closed',
  BadKind: 'Order type not available',
  BadValue: 'Payment does not match the price',
  BadText: 'Invalid text: 1–40 ASCII characters, no < > & " \' \\',
  QueueTimeout: 'Order is past its queue deadline',
  NotClaimed: 'Order is no longer being worked on',
  NotYourOrder: 'This order is not yours',
  WrongStep: 'Wrong step order',
  Late: 'Past the work deadline',
  NotExpired: 'Deadline has not passed yet',
  NothingToWithdraw: 'No pending funds',
  BadPages: 'Invalid page count (1–500)',
  NotReady: 'Order is not ready to hand over',
  BadCode: 'QR does not match this order',
  NotCustomer: 'Only the customer can file a complaint',
  TooLate: 'Complaint deadline has passed',
  NotDisputed: 'Order is not in dispute',
  ERC20InsufficientBalance: 'Not enough tIDRX',
  ERC20InsufficientAllowance: 'Token allowance (approve) too low',
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
    if (http) return http.status === 429 ? 'Monad network is busy, try again in a moment' : 'Cannot reach the Monad network';
    if (e.walk((x) => x instanceof TimeoutError || x instanceof WebSocketRequestError)) return 'Connection to Monad is slow, try again';
    const teks = `${e.shortMessage} ${e.details ?? ''}`;
    if (/insufficient|reserve|balance/i.test(teks)) return 'Not enough MON';
    return e.shortMessage;
  }
  return e instanceof Error ? e.message.split('\n')[0] : String(e);
}

/** Max cost the balance must cover: value + gas limit × max fee (Monad reserve balance rule). */
export async function biayaMaks(fn: FnTulis, value = 0n): Promise<bigint> {
  const { maxFeePerGas } = await pub.estimateFeesPerGas();
  return value + GAS_LIMIT[fn] * (maxFeePerGas ?? 0n);
}

export type HasilTx = { hash: Hash; receipt: TransactionReceipt; events: { eventName: string; args: Record<string, unknown> }[] };

/**
 * Send a tx, retrying briefly when the RPC rejects it with "insufficient balance" although the balance is there:
 * seen on Monad mainnet right after a faucet top-up (public RPC nodes behind a load balancer can lag a few blocks).
 */
export async function kirimTahanLag<T>(kirimTx: () => Promise<T>, coba = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await kirimTx();
    } catch (e) {
      const teks = e instanceof BaseError ? `${e.shortMessage} ${e.details ?? ''}` : String(e);
      if (i >= coba - 1 || !/insufficient balance/i.test(teks)) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function kirim(akun: Akun, fn: FnTulis, args: readonly unknown[], value?: bigint): Promise<HasilTx> {
  const w = dompet(akun);
  const hash = await kirimTahanLag(() => w.writeContract({ ...kontrak, account: akun.account, chain: w.chain, functionName: fn, args, value, gas: GAS_LIMIT[fn] } as never));
  const receipt = await pub.waitForTransactionReceipt({ hash, pollingInterval: 200 });
  if (receipt.status !== 'success') {
    // No pre-simulation (saves time during the race); look up the error name after a revert.
    let alasan = 'Transaction failed';
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
/** Reverts that can happen because the public RPC lags a few blocks behind a claim / previous step. */
// 'Transaction failed' = a revert whose simulation now passes (RPC state has caught up).
const BISA_ULANG = ['Order is no longer being worked on', 'This order is not yours', 'Wrong step order', 'Transaction failed'];

/**
 * completeStep that tolerates a slow RPC: wait briefly until `getOrder` shows this order Claimed by us
 * (so we don't pay for a tx that will surely revert), then send; reverts from lagging state are retried up to 2x.
 */
export async function kirimLangkah(akun: Akun, id: bigint, kode: number): Promise<HasilTx> {
  for (let i = 0; i < 10; i++) {
    try {
      const o = await pub.readContract({ ...kontrak, functionName: 'getOrder', args: [id] });
      if (o.status === 2 && o.toko.toLowerCase() === akun.address.toLowerCase()) break;
      if (o.status > 2) break; // already past Claimed: let the tx explain why
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

