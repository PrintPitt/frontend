// Aturan game toko (tanpa React): isi meja, status mesin, file jebakan printer.
import { wujudAwal, type Item, type Wujud } from './Item3D';

export type KodeMesin = 1 | 2 | 3;
/** kosong → (pilih file, khusus printer) → jalan/tahan → selesai. Salah pilih file = macet sebentar. */
export type StatusMesin = 'kosong' | 'pilih' | 'jalan' | 'tahan' | 'macet' | 'selesai';
export type Mesin = { item: Item | null; progres: number; status: StatusMesin; macetSampai: number; file: string[] };
export type Dunia = {
  pegang: Item | null;
  meja: (Item | null)[];
  mesin: Record<KodeMesin, Mesin>;
  /** Barang yang sedang diserahkan di loket (menunggu tx terakhir). */
  diSerah: Item | null;
  merebut: bigint | null;
};

/** Detik kerja tiap mesin. Fotokopi & printer jalan sendiri; laminator hanya maju selama E ditahan. */
export const DURASI: Record<KodeMesin, number> = { 1: 3, 2: 2.6, 3: 2.2 };
export const MACET_MS = 2200;

export const mesinKosong = (): Mesin => ({ item: null, progres: 0, status: 'kosong', macetSampai: 0, file: [] });
export const duniaBaru = (): Dunia => ({
  pegang: null,
  meja: [null, null],
  mesin: { 1: mesinKosong(), 2: mesinKosong(), 3: mesinKosong() },
  diSerah: null,
  merebut: null,
});

export function wujudSetelah(langkah: number[], tahap: number): Wujud {
  if (tahap === 0) return wujudAwal(langkah);
  return langkah[tahap - 1] === 3 ? 'laminasi' : 'kertas';
}

export const namaFile = (teks: string) =>
  (teks.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'dokumen') + '.pdf';

const JEBAKAN = ['pulsa_gratis.bat', 'FOTO_KTP_ASLI.scr', 'Ultraman_crack.exe', 'skripsi_revisi_final.exe', 'undangan_nikah.apk'];

/** Isi flashdisk pelanggan: satu file asli + dua virus yang mirip. */
export function acakFile(teks: string): string[] {
  const benar = namaFile(teks);
  const semua = [benar, benar.replace(/\.pdf$/, '.pdf.exe'), JEBAKAN[Math.floor(Math.random() * JEBAKAN.length)]];
  for (let i = semua.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [semua[i], semua[j]] = [semua[j], semua[i]];
  }
  return semua;
}

export function semuaItem(d: Dunia): Item[] {
  return [d.pegang, d.diSerah, ...d.meja, d.mesin[1].item, d.mesin[2].item, d.mesin[3].item].filter((x): x is Item => !!x);
}

export function buangItem(d: Dunia, id: bigint) {
  const lain = (x: Item | null) => (x && x.id === id ? null : x);
  d.pegang = lain(d.pegang);
  d.diSerah = lain(d.diSerah);
  d.meja = d.meja.map(lain);
  for (const k of [1, 2, 3] as KodeMesin[]) if (d.mesin[k].item?.id === id) d.mesin[k] = mesinKosong();
}
