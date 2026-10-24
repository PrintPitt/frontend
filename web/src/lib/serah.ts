// QR handover (contract v2, Contract Design section 17): the customer makes a random `rahasia` (secret) on the phone; only
// keccak256(rahasia) goes into the order. At pickup the customer's phone shows a QR; the shop scans it and calls `serahkan`.
import { bytesToHex, isHex, keccak256, type Hex } from 'viem';

const AWALAN = 'pp.rahasia.';
/** QR content: `printpitt:<orderId>:<rahasia>`. The order id is included so the shop knows which order is handed over. */
const POLA_QR = /^printpitt:(\d{1,19}):(0x[0-9a-fA-F]{64})$/;

export function buatRahasia(): { rahasia: Hex; kodeHash: Hex } {
  const rahasia = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  return { rahasia, kodeHash: keccak256(rahasia) };
}

/** Stored per kodeHash (known before the order has an id), so it is safe to store before the tx is sent. */
export function simpanRahasia(kodeHash: Hex, rahasia: Hex) {
  try {
    localStorage.setItem(AWALAN + kodeHash.toLowerCase(), rahasia);
  } catch {
    /* private mode: the secret only lives in this page's memory */
  }
}

export function bacaRahasia(kodeHash: Hex): Hex | null {
  try {
    const v = localStorage.getItem(AWALAN + kodeHash.toLowerCase());
    return v && isHex(v) && keccak256(v as Hex) === kodeHash.toLowerCase() ? (v as Hex) : null;
  } catch {
    return null;
  }
}

export const hapusRahasia = (kodeHash: Hex) => {
  try {
    localStorage.removeItem(AWALAN + kodeHash.toLowerCase());
  } catch {}
};

export const isiQr = (orderId: bigint, rahasia: Hex) => `printpitt:${orderId}:${rahasia}`;

export function bacaQr(teks: string): { orderId: bigint; rahasia: Hex } | null {
  const m = POLA_QR.exec(teks.trim());
  return m ? { orderId: BigInt(m[1]), rahasia: m[2].toLowerCase() as Hex } : null;
}

/** Local check before `serahkan`, so a wrong QR doesn't waste gas on a tx that will surely revert. */
export const cocok = (rahasia: Hex, kodeHash: Hex) => keccak256(rahasia) === kodeHash.toLowerCase();
