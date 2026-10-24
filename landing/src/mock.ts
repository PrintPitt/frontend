// Simulasi ringan untuk bagian Live saat belum tersambung ke kontrak. Selalu berlabel SIMULASI.
import { HARGA, BATAS_KERJA, rpAngka } from './config';

export type Status = 'Open' | 'Claimed' | 'Finished' | 'Expired';
export interface Order {
  id: number; label: string; teks: string; toko: 0 | 1 | null; status: Status;
  dibuat: number; diclaim: number | null; batasKerja: number; langkah: number; langkahSelesai: number;
  kerja: number | null; upah: number | null; refund: number | null;
}
export interface Shop { nama: string; omzet: number; aktif: number | null }
export interface Tx { kind: string; id: number; t: number }

const TEKS = [
  'Analisis Antrean Fotokopi Depan Kampus', 'Print dari WA bisa, mas?', 'Bolak-balik 3 kali ya',
  'Laporan KKN Desa Sumberan', 'Menu Warung Bu Tini', 'CV Fresh Graduate 2026', 'Undangan Nikah Dika & Sari',
  'Bayar QRIS, sinyal ilang', 'Boarding JOG-CGK 05.40', 'Proposal Skripsi Bab 1-3', 'KTP bolak-balik 10 lembar', 'Ijazah laminating',
];
const JENIS = [
  { label: 'Fotokopi KTP', langkah: 1 },
  { label: 'Menu Warung', langkah: 2 },
  { label: 'Laminating Ijazah', langkah: 2 },
];

export class MockSim {
  orders = new Map<number, Order>();
  shops: Shop[] = [{ nama: 'Toko A', omzet: 0, aktif: null }, { nama: 'Toko B', omzet: 0, aktif: null }];
  txs: Tx[] = [];
  total = 417;
  private nextId = 418;
  private timer = 0;
  private listeners = new Set<() => void>();
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach(f => f()); }
  private tx(kind: string, id: number) { this.txs.unshift({ kind, id, t: Date.now() }); if (this.txs.length > 12) this.txs.pop(); }

  start() {
    if (this.timer) return;
    this.tick(); // isi awal
    this.timer = window.setInterval(() => this.tick(), 1000);
  }
  stop() { clearInterval(this.timer); this.timer = 0; }

  private tick() {
    const now = Date.now() / 1000;
    // order baru tiap ±4 dtk kalau antrean < 3
    const open = [...this.orders.values()].filter(o => o.status === 'Open');
    if (open.length < 3 && Math.random() < 0.3) {
      const j = JENIS[Math.floor(Math.random() * JENIS.length)];
      const o: Order = { id: this.nextId++, label: j.label, teks: TEKS[Math.floor(Math.random() * TEKS.length)], toko: null, status: 'Open',
        dibuat: now, diclaim: null, batasKerja: BATAS_KERJA, langkah: j.langkah, langkahSelesai: 0, kerja: null, upah: null, refund: null };
      this.orders.set(o.id, o); this.total++; this.tx('OrderCreated', o.id);
    }
    // toko kosong merebut order terlama
    this.shops.forEach((s, i) => {
      if (s.aktif !== null) return;
      const o = [...this.orders.values()].filter(x => x.status === 'Open').sort((a, b) => a.dibuat - b.dibuat)[0];
      if (o && now - o.dibuat > 1.5 && Math.random() < 0.6) { o.status = 'Claimed'; o.toko = i as 0 | 1; o.diclaim = now; s.aktif = o.id; this.tx('OrderClaimed', o.id); }
    });
    // kemajuan langkah, selesai, atau expire
    for (const o of this.orders.values()) {
      if (o.status === 'Claimed' && o.diclaim !== null) {
        const kerja = now - o.diclaim;
        const target = o.langkah * (6 + (o.id % 5)); // 6–10 dtk per langkah
        o.langkahSelesai = Math.min(o.langkah, Math.floor(kerja / (target / o.langkah)));
        if (o.id % 7 === 0 && kerja > o.batasKerja) { // 1 dari 7 dibiarkan telat → refund penuh
          o.status = 'Expired'; o.refund = HARGA; o.upah = 0; o.kerja = Math.round(kerja);
          if (o.toko !== null) this.shops[o.toko].aktif = null; this.tx('OrderExpired', o.id);
        } else if (o.id % 7 !== 0 && kerja >= target) {
          o.status = 'Finished'; o.kerja = Math.round(kerja);
          o.upah = Math.floor(HARGA * (o.batasKerja - o.kerja) / o.batasKerja); o.refund = HARGA - o.upah;
          if (o.toko !== null) { this.shops[o.toko].omzet += o.upah; this.shops[o.toko].aktif = null; }
          this.tx('OrderFinished', o.id);
        }
      }
      if (o.status === 'Open' && now - o.dibuat > 45) { o.status = 'Expired'; o.refund = HARGA; this.tx('OrderExpired', o.id); }
    }
    // buang yang sudah lama selesai
    for (const [id, o] of this.orders) if ((o.status === 'Finished' || o.status === 'Expired') && now - o.dibuat > 70) this.orders.delete(id);
    this.emit();
  }
}

export function upahSekarang(harga: number, batas: number, kerja: number) {
  return Math.max(0, Math.floor(harga * (batas - kerja) / batas)); // dibulatkan ke bawah seperti _payout di kontrak
}
export function fmtRp(x: number) {
  return 'Rp' + rpAngka(x);
}
