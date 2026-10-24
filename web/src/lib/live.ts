// Live state for /layar and /toko (BLZ-12.T1): initial snapshot + events over one WebSocket connection.
// Status only moves forward, so out-of-order events (snapshot vs subscription) are still safe.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Hex } from 'viem';
import { hitungPayout, NOL32 } from '../../../shared/src/index.ts';
import { kontrak, offsetChain, PAKAI_WS, pub, pubLive } from './chain';
import { bukaResep } from './format';
import { bacaFeePlatform, bacaKatalog, bacaOrder, bacaToko, payoutBersih, type Katalog, type Order, type StatusOrder } from './katalog';

export type TokoLive = { alamat: Hex; nama: string; orderAktif: bigint; omzet: bigint; aktif: boolean };
export type Kejadian = {
  kunci: string;
  jenis: 'baru' | 'claim' | 'selesai' | 'expire';
  id: bigint;
  toko?: Hex;
  payout?: bigint;
  refund?: bigint;
  kerja?: number;
  waktu: number; // local ms
};
export type LiveState = {
  siap: boolean;
  galat?: string;
  sesiId: number;
  sesiAktif: boolean;
  batasAntre: number;
  /** v2.1: platform fee (bps) taken from shop payout; events/revenue are net, hitungPayout is still gross. */
  feeBps: number;
  katalog: Record<number, Katalog>;
  toko: TokoLive[];
  order: Record<string, Order>;
  offset: number;
  kejadian: Kejadian[];
};

const URUTAN: Record<StatusOrder, number> = { None: 0, Open: 1, Claimed: 2, Siap: 3, Sengketa: 4, Finished: 5, Expired: 5, Diputuskan: 5 };

let state: LiveState = {
  siap: false,
  sesiId: 0,
  sesiAktif: false,
  batasAntre: 45,
  feeBps: 0,
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
                halaman: 1,
                siapPada: 0,
                dokumen: NOL32,
                kodeHash: NOL32,
              }),
              { kunci, jenis: 'baru', id, waktu },
            ),
          );
        segarkanOrder(id); // exact recipe copy from storage
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
      case 'OrderDetail': {
        const o = state.order[String(a.id)];
        if (o) ubah((s) => pasangOrder(s, { ...o, halaman: Number(a.halaman), batasKerja: Number(a.batasKerja), dokumen: a.dokumen, kodeHash: a.kodeHash }));
        break;
      }
      case 'OrderReady': {
        const o = state.order[String(a.id)];
        if (!o) segarkanOrder(a.id);
        else ubah((s) => pasangOrder(s, { ...o, status: 'Siap', kerja: Number(a.kerja), siapPada: Number(a.siapPada), langkahSelesai: o.langkah.length }));
        // payout is locked at Siap (Ready); the shop can take another order right away
        ubah((s) => ({ ...s, toko: s.toko.map((t) => (t.alamat.toLowerCase() === String(a.toko).toLowerCase() ? { ...t, orderAktif: 0n } : t)) }));
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
      case 'OrderDisputed': {
        const o = state.order[String(a.id)];
        if (!o) segarkanOrder(a.id);
        else ubah((s) => pasangOrder(s, { ...o, status: 'Sengketa' }));
        break;
      }
      case 'DisputeResolved': {
        const id = a.id as bigint;
        const o = state.order[String(id)];
        if (o && o.status !== 'Diputuskan') {
          ubah((s) => {
            let n = pasangOrder(s, { ...o, status: 'Diputuskan' });
            n = { ...n, toko: n.toko.map((t) => (t.alamat.toLowerCase() === String(a.toko).toLowerCase() ? { ...t, omzet: t.omzet + (a.payout as bigint) } : t)) };
            return catat(n, { kunci, jenis: 'selesai', id, toko: a.toko, payout: a.payout, refund: a.refund, kerja: o.kerja, waktu });
          });
        } else if (!o) segarkanOrder(id);
        break;
      }
      case 'PlatformSet':
        ubah((s) => ({ ...s, feeBps: Number(a.feeBps) }));
        break;
      case 'SessionStarted':
        ubah((s) => ({ ...s, sesiId: Number(a.sesiId), sesiAktif: true, toko: s.toko.map((t) => ({ ...t, omzet: 0n })) }));
        break;
      case 'SessionEnded':
        ubah((s) => ({ ...s, sesiAktif: false }));
        break;
      case 'ShopRegistered':
      case 'ShopRenamed':
      case 'ShopStatusSet':
        segarkanToko();
        break;
      case 'KatalogSet':
        ubah((s) => ({
          ...s,
          katalog: {
            ...s.katalog,
            [a.jenis]: {
              jenis: a.jenis,
              hargaDasar: a.hargaDasar,
              hargaPerHalaman: a.hargaPerHalaman,
              batasDasar: Number(a.batasDasar),
              batasPerHalaman: Number(a.batasPerHalaman),
              harga: a.hargaDasar + a.hargaPerHalaman,
              batasKerja: Number(a.batasDasar) + Number(a.batasPerHalaman),
              langkah: bukaResep(a.langkah, a.jumlahLangkah),
              label: a.label,
            },
          },
        }));
        break;
    }
  }
}

async function snapshot(): Promise<bigint> {
  const blok = await pub.getBlock();
  const [sesiId, sesiAktif, batasAntre, nextId, katalog, offset, feeBps] = await Promise.all([
    pub.readContract({ ...kontrak, functionName: 'sesiId' }),
    pub.readContract({ ...kontrak, functionName: 'sesiAktif' }),
    pub.readContract({ ...kontrak, functionName: 'batasAntre' }),
    pub.readContract({ ...kontrak, functionName: 'nextId' }),
    bacaKatalog(),
    offsetChain(),
    bacaFeePlatform(),
  ]);
  const ids: bigint[] = [];
  for (let id = nextId - 1n; id >= 1n && ids.length < 80; id--) ids.push(id);
  const orders = await Promise.all(ids.map(bacaOrder));
  // This session's history from storage, so reloading the screen keeps the history (waktu 0 = not a live event).
  const lampau: Kejadian[] = orders
    .filter((o) => o.sesi === sesiId && (o.status === 'Finished' || o.status === 'Expired'))
    .map((o) => {
      if (o.status === 'Expired') return { kunci: `snap:${o.id}`, jenis: 'expire', id: o.id, toko: o.toko, refund: o.harga, waktu: 0 };
      const kotor = hitungPayout(o.harga, o.batasKerja, o.kerja);
      return { kunci: `snap:${o.id}`, jenis: 'selesai', id: o.id, toko: o.toko, payout: payoutBersih(kotor, feeBps), refund: o.harga - kotor, kerja: o.kerja, waktu: 0 };
    });
  ubah((s) => ({
    ...s,
    sesiId,
    sesiAktif,
    batasAntre,
    offset,
    feeBps,
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
    // Close the gap between snapshot and subscription (dedupe by txHash:logIndex).
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

/** Current state outside render (e.g. inside an async handler). */
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

/** Chain clock (seconds, fractional) that ticks every `ms`; use `offset` from useLive or offsetChain(). */
export function useJamChain(offset: number, ms = 250): number {
  const [t, setT] = useState(() => Date.now() / 1000 + offset);
  useEffect(() => {
    const i = setInterval(() => setT(Date.now() / 1000 + offset), ms);
    return () => clearInterval(i);
  }, [offset, ms]);
  return t;
}
