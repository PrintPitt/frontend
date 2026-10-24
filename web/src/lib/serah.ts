// Serah terima QR (contract v2, Desain Contract bagian 17): pelanggan membuat `rahasia` acak di HP, hanya
// keccak256(rahasia) yang masuk order. Saat ambil, HP pelanggan menampilkan QR; toko memindai lalu memanggil `serahkan`.
import { bytesToHex, isHex, keccak256, type Hex } from 'viem';

const AWALAN = 'pp.rahasia.';
/** Isi QR: `printpitt:<orderId>:<rahasia>`. Order id ikut supaya toko tahu order mana yang diserahkan. */
const POLA_QR = /^printpitt:(\d{1,19}):(0x[0-9a-fA-F]{64})$/;

export function buatRahasia(): { rahasia: Hex; kodeHash: Hex } {
  const rahasia = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  return { rahasia, kodeHash: keccak256(rahasia) };
}

/** Disimpan per kodeHash (diketahui sebelum order punya id), jadi aman disimpan sebelum tx dikirim. */
export function simpanRahasia(kodeHash: Hex, rahasia: Hex) {
  try {
    localStorage.setItem(AWALAN + kodeHash.toLowerCase(), rahasia);
  } catch {
    /* mode privat: rahasia hanya ada di memori halaman ini */
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

/** Cek lokal sebelum `serahkan`, supaya QR salah tidak menghabiskan gas tx yang pasti revert. */
export const cocok = (rahasia: Hex, kodeHash: Hex) => keccak256(rahasia) === kodeHash.toLowerCase();
