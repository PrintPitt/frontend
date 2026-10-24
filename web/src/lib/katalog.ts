// Read ringan yang dipakai semua halaman (katalog, toko, order).
import type { Hex } from 'viem';
import { STATUS } from '../../../shared/src/index.ts';
import { kontrak, pub } from './chain';
import { bukaResep } from './format';

export type Katalog = { jenis: number; harga: bigint; batasKerja: number; langkah: number[]; label: string };
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
};

export async function bacaKatalog(maks = 8): Promise<Katalog[]> {
  const ids = Array.from({ length: maks }, (_, i) => i + 1);
  const rows = await Promise.all(ids.map((j) => pub.readContract({ ...kontrak, functionName: 'katalog', args: [j] })));
  return rows.flatMap(([harga, batasKerja, langkah, jumlahLangkah, aktif, label], i) =>
    aktif ? [{ jenis: ids[i], harga, batasKerja: Number(batasKerja), langkah: bukaResep(langkah, jumlahLangkah), label }] : [],
  );
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
  };
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
