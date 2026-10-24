// State live untuk /layar dan /toko (BLZ-12.T1): snapshot awal + event lewat satu koneksi WebSocket.
// Transisi status hanya maju, jadi event yang datang tidak berurutan (snapshot vs langganan) tetap aman.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Hex } from 'viem';
import { hitungPayout } from '../../../shared/src/index.ts';
import { kontrak, offsetChain, PAKAI_WS, pub, pubLive } from './chain';
import { bukaResep } from './format';
import { bacaKatalog, bacaOrder, bacaToko, type Katalog, type Order, type StatusOrder } from './katalog';

export type TokoLive = { alamat: Hex; nama: string; orderAktif: bigint; omzet: bigint };
export type Kejadian = {
  kunci: string;
  jenis: 'baru' | 'claim' | 'selesai' | 'expire';
  id: bigint;
  toko?: Hex;
  payout?: bigint;
  refund?: bigint;
  kerja?: number;
  waktu: number; // ms lokal
};
export type LiveState = {
  siap: boolean;
  galat?: string;
  sesiId: number;
  sesiAktif: boolean;
  batasAntre: number;
  katalog: Record<number, Katalog>;
  toko: TokoLive[];
  order: Record<string, Order>;
  offset: number;
  kejadian: Kejadian[];
};

const URUTAN: Record<StatusOrder, number> = { None: 0, Open: 1, Claimed: 2, Finished: 3, Expired: 3 };

let state: LiveState = {
  siap: false,
  sesiId: 0,
  sesiAktif: false,
  batasAntre: 45,
  katalog: {},
  toko: [],
  order: {},
  offset: 0,
  kejadian: [],
};
const pendengar = new Set<() => void>();
const ubah = (f: (s: LiveState) => LiveState) => {
  state = f(state);
  pendengar.forEach((l) => l());
};
const sudah = new Set<string>();

function pasangOrder(s: LiveState, o: Order): LiveState {
  const lama = s.order[String(o.id)];
  if (lama && URUTAN[lama.status] > URUTAN[o.status]) return s;
  return { ...s, order: { ...s.order, [String(o.id)]: lama ? { ...lama, ...o, langkahSelesai: Math.max(lama.langkahSelesai, o.langkahSelesai) } : o } };
}

function catat(s: LiveState, k: Kejadian): LiveState {
  return { ...s, kejadian: [k, ...s.kejadian].slice(0, 40) };
}

async function segarkanOrder(id: bigint) {
  try {
    const o = await bacaOrder(id);
    ubah((s) => pasangOrder(s, o));
  } catch {}
}

async function segarkanToko() {
  const daftar = await bacaToko();
  const omzet = await Promise.all(
    daftar.map((t) => pub.readContract({ ...kontrak, functionName: 'omzet', args: [state.sesiId, t.alamat] })),
  );
  ubah((s) => ({ ...s, toko: daftar.map((t, i) => ({ ...t, omzet: omzet[i] })) }));
}

type LogAny = { eventName?: string; args?: any; transactionHash: string | null; logIndex: number | null };

function terapkan(logs: LogAny[]) {
  for (const log of logs) {
    const kunci = `${log.transactionHash}:${log.logIndex}`;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    const a = log.args ?? {};
    const waktu = Date.now();
    switch (log.eventName) {
      case 'OrderCreated': {
        const id = a.id as bigint;
        const k = state.katalog[a.jenis];
        if (!state.order[String(id)])
          ubah((s) =>
            catat(
              pasangOrder(s, {
                id,
                pelanggan: a.pelanggan,
                harga: a.harga,
                toko: '0x0000000000000000000000000000000000000000',
                jenis: a.jenis,
                langkah: k?.langkah ?? [],
                langkahSelesai: 0,
                status: 'Open',
                dibuatPada: Number(a.dibuatPada),
                diclaimPada: 0,
                batasKerja: k?.batasKerja ?? 0,
                sesi: s.sesiId,
                kerja: 0,
                teks: a.teks,
              }),
              { kunci, jenis: 'baru', id, waktu },
            ),
          );
        segarkanOrder(id); // salinan resep yang pasti dari storage
        break;
      }
      case 'OrderClaimed': {
        const id = a.id as bigint;
        const o = state.order[String(id)];
        if (!o) segarkanOrder(id);
        else ubah((s) => catat(pasangOrder(s, { ...o, status: 'Claimed', toko: a.toko, diclaimPada: Number(a.diclaimPada) }), { kunci, jenis: 'claim', id, toko: a.toko, waktu }));
        ubah((s) => ({ ...s, toko: s.toko.map((t) => (t.alamat.toLowerCase() === String(a.toko).toLowerCase() ? { ...t, orderAktif: id } : t)) }));
        break;
      }
      case 'StepCompleted': {
        const o = state.order[String(a.id)];
        if (!o) segarkanOrder(a.id);
        else ubah((s) => pasangOrder(s, { ...o, langkahSelesai: Math.max(o.langkahSelesai, Number(a.urutan) + 1) }));
        break;
      }
      case 'OrderFinished': {
        const id = a.id as bigint;
        const o = state.order[String(id)];
        const sudahSelesai = o?.status === 'Finished';
        ubah((s) => {
          let n = o ? pasangOrder(s, { ...o, status: 'Finished', kerja: Number(a.kerja), langkahSelesai: o.langkah.length }) : s;
          if (!sudahSelesai) {
            n = {
              ...n,
              toko: n.toko.map((t) =>
                t.alamat.toLowerCase() === String(a.toko).toLowerCase() ? { ...t, omzet: t.omzet + (a.payout as bigint), orderAktif: 0n } : t,
              ),
            };
            n = catat(n, { kunci, jenis: 'selesai', id, toko: a.toko, payout: a.payout, refund: a.refund, kerja: Number(a.kerja), waktu });
          }
          return n;
        });
        if (!o) segarkanOrder(id);
        break;
      }
      case 'OrderExpired': {
        const id = a.id as bigint;
        const o = state.order[String(id)];
        if (o && o.status !== 'Expired') {
          ubah((s) => {
            let n = pasangOrder(s, { ...o, status: 'Expired' });
            n = { ...n, toko: n.toko.map((t) => (t.orderAktif === id ? { ...t, orderAktif: 0n } : t)) };
            return catat(n, { kunci, jenis: 'expire', id, toko: o.toko, refund: a.refund, waktu });
          });
        } else if (!o) segarkanOrder(id);
        break;
      }
      case 'SessionStarted':
        ubah((s) => ({ ...s, sesiId: Number(a.sesiId), sesiAktif: true, toko: s.toko.map((t) => ({ ...t, omzet: 0n })) }));
        break;
      case 'SessionEnded':
        ubah((s) => ({ ...s, sesiAktif: false }));
        break;
      case 'ShopRegistered':
        segarkanToko();
        break;
      case 'KatalogSet':
        ubah((s) => ({
          ...s,
          katalog: {
            ...s.katalog,
            [a.jenis]: { jenis: a.jenis, harga: a.harga, batasKerja: Number(a.batasKerja), langkah: bukaResep(a.langkah, a.jumlahLangkah), label: a.label },
          },
        }));
        break;
    }
  }
}

async function snapshot(): Promise<bigint> {
  const blok = await pub.getBlock();
  const [sesiId, sesiAktif, batasAntre, nextId, katalog, offset] = await Promise.all([
    pub.readContract({ ...kontrak, functionName: 'sesiId' }),
    pub.readContract({ ...kontrak, functionName: 'sesiAktif' }),
    pub.readContract({ ...kontrak, functionName: 'batasAntre' }),
    pub.readContract({ ...kontrak, functionName: 'nextId' }),
    bacaKatalog(),
    offsetChain(),
  ]);
  const ids: bigint[] = [];
  for (let id = nextId - 1n; id >= 1n && ids.length < 80; id--) ids.push(id);
  const orders = await Promise.all(ids.map(bacaOrder));
  // Riwayat sesi ini dari storage, supaya reload layar tidak mengosongkan riwayat (waktu 0 = bukan kejadian live).
  const lampau: Kejadian[] = orders
    .filter((o) => o.sesi === sesiId && (o.status === 'Finished' || o.status === 'Expired'))
    .map((o) => {
      if (o.status === 'Expired') return { kunci: `snap:${o.id}`, jenis: 'expire', id: o.id, toko: o.toko, refund: o.harga, waktu: 0 };
      const payout = hitungPayout(o.harga, o.batasKerja, o.kerja);
      return { kunci: `snap:${o.id}`, jenis: 'selesai', id: o.id, toko: o.toko, payout, refund: o.harga - payout, kerja: o.kerja, waktu: 0 };
    });
  ubah((s) => ({
    ...s,
    sesiId,
    sesiAktif,
    batasAntre,
    offset,
    katalog: Object.fromEntries(katalog.map((k) => [k.jenis, k])),
    order: Object.fromEntries(orders.map((o) => [String(o.id), o])),
    kejadian: [...s.kejadian.filter((k) => k.waktu > 0), ...lampau].slice(0, 40),
  }));
  await segarkanToko();
  ubah((s) => ({ ...s, siap: true, galat: undefined }));
  return blok.number;
}

let mulai = false;
async function jalankan() {
  try {
    const dariBlok = await snapshot();
    pubLive.watchContractEvent({
      ...kontrak,
      onLogs: (logs) => terapkan(logs as unknown as LogAny[]),
      onError: (e) => ubah((s) => ({ ...s, galat: e.message.split('\n')[0] })),
      ...(PAKAI_WS ? {} : { poll: true, pollingInterval: 700 }),
    });
    // Tutup celah antara snapshot dan langganan (dedupe lewat txHash:logIndex).
    try {
      const ketinggalan = await pub.getContractEvents({ ...kontrak, fromBlock: dariBlok + 1n, toBlock: 'latest' });
      terapkan(ketinggalan as unknown as LogAny[]);
    } catch {}
    setInterval(async () => {
      try {
        const offset = await offsetChain();
        ubah((s) => ({ ...s, offset }));
      } catch {}
    }, 20_000);
  } catch (e) {
    ubah((s) => ({ ...s, galat: (e as Error).message.split('\n')[0] }));
    setTimeout(jalankan, 3000);
  }
}

/** State terkini di luar render (mis. di dalam handler async). */
export const bacaLive = () => state;
if (import.meta.env.DEV) (window as unknown as { __live: () => LiveState }).__live = bacaLive;

export function useLive(): LiveState {
  useEffect(() => {
    if (!mulai) {
      mulai = true;
      jalankan();
    }
  }, []);
  return useSyncExternalStore(
    (l) => {
      pendengar.add(l);
      return () => pendengar.delete(l);
    },
    () => state,
  );
}

/** Jam chain (detik, pecahan) yang berdetak tiap `ms`; pakai `offset` dari useLive atau offsetChain(). */
export function useJamChain(offset: number, ms = 250): number {
  const [t, setT] = useState(() => Date.now() / 1000 + offset);
  useEffect(() => {
    const i = setInterval(() => setT(Date.now() / 1000 + offset), ms);
    return () => clearInterval(i);
  }, [offset, ms]);
  return t;
}
