// Shop game rules (no React): table contents, machine status, printer trap files.
import { wujudAwal, type Item, type Wujud } from './Item3D';
import { ID_MESIN, type IdMesin, type KodeMesin } from './peta';

export type { IdMesin, KodeMesin };
/** empty → (pick file, printer only) → running/holding → done. Wrong file = brief jam. */
export type StatusMesin = 'kosong' | 'pilih' | 'jalan' | 'tahan' | 'macet' | 'selesai';
export type Mesin = { item: Item | null; progres: number; status: StatusMesin; macetSampai: number; file: string[] };
export type Dunia = {
  pegang: Item | null;
  meja: (Item | null)[];
  mesin: Record<IdMesin, Mesin>;
  /** Item being handed over at the counter (waiting for the last tx). */
  diSerah: Item | null;
  merebut: bigint | null;
};

/** Work seconds per machine. Copier & printer run on their own; laminator only advances while E is held. */
export const DURASI: Record<KodeMesin, number> = { 1: 3, 2: 2.6, 3: 2.2 };
export const MACET_MS = 2200;

export const mesinKosong = (): Mesin => ({ item: null, progres: 0, status: 'kosong', macetSampai: 0, file: [] });
export const duniaBaru = (): Dunia => ({
  pegang: null,
  meja: [null, null, null, null],
  mesin: Object.fromEntries(ID_MESIN.map((id) => [id, mesinKosong()])) as Record<IdMesin, Mesin>,
  diSerah: null,
  merebut: null,
});

export function wujudSetelah(langkah: number[], tahap: number): Wujud {
  if (tahap === 0) return wujudAwal(langkah);
  return langkah[tahap - 1] === 3 ? 'laminasi' : 'kertas';
}

export const namaFile = (teks: string) =>
  (teks.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'document') + '.pdf';

const JEBAKAN = ['free_phone_credit.bat', 'REAL_ID_CARD.scr', 'Ultraman_crack.exe', 'thesis_revision_final.exe', 'wedding_invite.apk'];

/** Customer's flash drive: one real file + two look-alike viruses. */
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
  return [d.pegang, d.diSerah, ...d.meja, ...ID_MESIN.map((id) => d.mesin[id].item)].filter((x): x is Item => !!x);
}

export function buangItem(d: Dunia, id: bigint) {
  const lain = (x: Item | null) => (x && x.id === id ? null : x);
  d.pegang = lain(d.pegang);
  d.diSerah = lain(d.diSerah);
  d.meja = d.meja.map(lain);
  for (const m of ID_MESIN) if (d.mesin[m].item?.id === id) d.mesin[m] = mesinKosong();
}
