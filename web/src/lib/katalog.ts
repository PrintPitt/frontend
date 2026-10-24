// Read ringan yang dipakai semua halaman (katalog, toko, order).
import type { Hex } from 'viem';
import { hitungHarga, STATUS } from '../../../shared/src/index.ts';
import { kontrak, pub } from './chain';
import { bukaResep } from './format';

/** v2: harga & batas kerja = dasar + per halaman × halaman. `harga`/`batasKerja` = nilai untuk 1 halaman (mode demo). */
export type Katalog = {
  jenis: number;
  harga: bigint;
  batasKerja: number;
  hargaDasar: bigint;
  hargaPerHalaman: bigint;
  batasDasar: number;
  batasPerHalaman: number;
  langkah: number[];
  label: string;
};
export type StatusOrder = (typeof STATUS)[number];
export type Order = {
  id: bigint;
  pelanggan: Hex;
  harga: bigint;
  toko: Hex;
  jenis: number;
  langkah: number[];
  langkahSelesai: number;
  status: StatusOrder;
  dibuatPada: number;
  diclaimPada: number;
  batasKerja: number;
  sesi: number;
  kerja: number;
  teks: string;
  halaman: number;
  siapPada: number;
  dokumen: Hex;
  kodeHash: Hex;
};

export async function bacaKatalog(maks = 8): Promise<Katalog[]> {
  const ids = Array.from({ length: maks }, (_, i) => i + 1);
  const rows = await Promise.all(ids.map((j) => pub.readContract({ ...kontrak, functionName: 'katalog', args: [j] })));
  return rows.flatMap(([hargaDasar, hargaPerHalaman, batasDasar, batasPerHalaman, langkah, jumlahLangkah, aktif, label], i) => {
    if (!aktif) return [];
    const k = { hargaDasar, hargaPerHalaman, batasDasar: Number(batasDasar), batasPerHalaman: Number(batasPerHalaman) };
    const satu = hitungHarga(k, 1);
    return [{ jenis: ids[i], ...k, harga: satu.harga, batasKerja: satu.batasKerja, langkah: bukaResep(langkah, jumlahLangkah), label }];
  });
}

export async function bacaOrder(id: bigint): Promise<Order> {
  const o = await pub.readContract({ ...kontrak, functionName: 'getOrder', args: [id] });
  return {
    id,
    pelanggan: o.pelanggan,
    harga: o.harga,
    toko: o.toko,
    jenis: o.jenis,
    langkah: bukaResep(o.langkah, o.jumlahLangkah),
    langkahSelesai: o.langkahSelesai,
    status: STATUS[o.status],
    dibuatPada: Number(o.dibuatPada),
    diclaimPada: Number(o.diclaimPada),
    batasKerja: Number(o.batasKerja),
    sesi: Number(o.sesi),
    kerja: Number(o.kerja),
    teks: o.teks,
    halaman: Number(o.halaman),
    siapPada: Number(o.siapPada),
    dokumen: o.dokumen,
    kodeHash: o.kodeHash,
  };
}

/** Harga dan batas kerja dari contract (`hargaUntuk`), sumber kebenaran untuk order per halaman. */
export async function bacaHarga(jenis: number, halaman: number): Promise<{ harga: bigint; batasKerja: number }> {
  const [harga, batasKerja] = await pub.readContract({ ...kontrak, functionName: 'hargaUntuk', args: [jenis, halaman] });
  return { harga, batasKerja: Number(batasKerja) };
}

/** v2.1: potongan platform (basis poin) dari payout toko. Event OrderFinished/omzet sudah bersih; hitungPayout masih kotor. */
export const bacaFeePlatform = () => pub.readContract({ ...kontrak, functionName: 'platformFeeBps' });
export const payoutBersih = (kotor: bigint, feeBps: number) => kotor - (kotor * BigInt(feeBps)) / 10_000n;

/** Toko Pro (v2.1): aktif sampai `proSampai` (detik chain). */
export async function bacaPro(toko: Hex): Promise<{ pro: boolean; sampai: number; harga: bigint }> {
  const [pro, sampai, harga] = await Promise.all([
    pub.readContract({ ...kontrak, functionName: 'isPro', args: [toko] }),
    pub.readContract({ ...kontrak, functionName: 'proSampai', args: [toko] }),
    pub.readContract({ ...kontrak, functionName: 'hargaPro' }),
  ]);
  return { pro, sampai: Number(sampai), harga };
}

export type TokoInfo = { alamat: Hex; nama: string; orderAktif: bigint };

export async function bacaToko(): Promise<TokoInfo[]> {
  const n = await pub.readContract({ ...kontrak, functionName: 'jumlahToko' });
  const alamat = await Promise.all(
    Array.from({ length: Number(n) }, (_, i) => pub.readContract({ ...kontrak, functionName: 'daftarToko', args: [BigInt(i)] })),
  );
  const info = await Promise.all(alamat.map((a) => pub.readContract({ ...kontrak, functionName: 'toko', args: [a] })));
  return alamat.map((a, i) => ({ alamat: a, nama: info[i][2], orderAktif: info[i][1] }));
}

/** NFT hasil cetakan: decode tokenURI (JSON base64) jadi nama + gambar SVG (data URI). */
export async function bacaNft(id: bigint): Promise<{ name: string; image: string }> {
  const uri = await pub.readContract({ ...kontrak, functionName: 'tokenURI', args: [id] });
  const json = JSON.parse(atob(uri.split(',')[1]));
  return { name: json.name, image: json.image };
}
