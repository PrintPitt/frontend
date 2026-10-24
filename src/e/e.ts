// PrintPitt · Bagian E "Blitz+" — penjelasan setelah tur D (Arena Toko).
// Rupa & gerak meniru mockup E2 pilihan Dex, ditulis ulang sebagai modul:
//   1 judul pembuka  ·  2 rumus upah interaktif  ·  3 kenapa Monad  ·  4 dua sisi + model bisnis
//   5 live (simulasi / papan app)  ·  6 bukti onchain  ·  7 CTA + QR + footer
// Semua teks tampil lewat kamus (e.i18n.ts, kunci 'e.*'); bawaan English, angka EN pakai titik, ID pakai koma.
// Satu loop requestAnimationFrame milik bagian ini; berhenti saat bagian E jauh dari layar.
import { E_DICT } from './e.i18n'; // harus pertama: mendaftarkan kunci 'e.*' sebelum t() dipakai
import './e.css';
import QRCode from 'qrcode';
import type { Bagian, Ctx, FigApi, FigName } from '../ctx';
import { t, lang } from '../i18n';
import { MockSim, fmtMon, upahSekarang, type Order } from '../mock';

type K = 'front' | 'mid' | 'back';
interface Slot {
  k: K; fig: FigName; ph: number; title: string;
  el: HTMLElement; box: HTMLElement; trail: HTMLElement; hint: HTMLElement | null;
  S: number; y0: number; spd: number; depth: number; xa: number; sh: number; yh: number; xh: number;
  phX: number; prevSy: number | null; press: boolean; gom: number; t0: number;
  api: FigApi | null; mounting: boolean; last: number;
}
interface Line { el: HTMLElement; x: number; y: number; w: number; h: number; sp: number; y2: boolean }
interface Part { el: HTMLElement; on: boolean; x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; vr: number }
interface Slide { el: HTMLElement; top: number; h: number; sp: number; dir: number; parts: { el: HTMLElement; m: number; skew: boolean }[] }

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=DM+Mono:wght@400;500&display=swap';
const RUNS: (number | null)[] = [16.8, 31.2, null, 9.6]; // putaran otomatis meteran: selesai di t dtk, null = telat
const EX = 16.8; // contoh order di teks
const DASH = '<span class="e-dash">—</span>';

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const mod = (a: number, n: number) => ((a % n) + n) % n;
const sstep = (a: number, b: number, x: number) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** angka sesuai bahasa: EN 0.0133 · ID 0,0133 */
const num = (x: number, d = 4) => { const s = x.toFixed(d); return lang === 'id' ? s.replace('.', ',') : s; };
const mon = (x: number) => (lang === 'id' ? fmtMon(x) : `${x.toFixed(4)} MON`);
const LOC = lang === 'id' ? 'id-ID' : 'en-US';
/** teks kamus dengan placeholder {nama} */
const tf = (key: string, v: Record<string, string | number>) => t(key).replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k] ?? ''));
/** terjemahkan isi simulasi mock.ts (teks Indonesia → kunci 'e.mock.*'); tidak dikenal → apa adanya */
const MOCK = new Map<string, string>(Object.entries(E_DICT).filter(([k]) => k.startsWith('e.mock.')).map(([k, v]) => [v.id, k]));
const tm = (s: string) => { const k = MOCK.get(s); return k ? t(k) : s; };
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => String(s).replace(/[&<>"']/g, ch => ESC[ch]);
const strip = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const absUrl = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
const link = (href: string, text: string) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;

const BOLT_H = (cls: string) => `<svg class="e-bolt ${cls}" viewBox="0 0 1000 46" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 24 L180 24 L212 6 L236 38 L262 16 L520 16 L548 40 L570 10 L596 28 L1000 28"/></svg>`;
const BOLT_S = '<svg class="e-bolt" viewBox="0 0 96 34" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 17 L30 17 L40 4 L50 30 L60 12 L96 12"/></svg>';
const ARR = (cls: string) => `<svg class="${cls}" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 20 H34 M22 8 L34 20 L22 32"/></svg>`;

let secs: HTMLElement[] = [];

/* ================= isi HTML ================= */
function template(c: Ctx): string {
  const H = c.HARGA_MON, B = c.BATAS_KERJA;
  const H2 = num(H, 2);
  const exU = upahSekarang(H, B, EX);
  const fee = String(c.BISNIS.feeRuangan || '—'); // apa adanya dari config ([ISI] sampai trio sepakat)
  const isi = /\[ISI\]/.test(fee);
  const live = c.MODE === 'LIVE' && !!c.URL_APP;
  const pesan = absUrl(c.URL_PESAN);
  const NM = t('e.name'), SA = t('e.shop.a'), SB = t('e.shop.b'), U = t('e.unit.s');
  // petunjuk seret hanya di mesin depan (satu kali di layar)
  const fw = (k: K) => `<div class="e-fw" data-k="${k}"><div class="e-trail" aria-hidden="true"><i></i><i></i><i></i></div><div class="e-fbox"></div>${k === 'front' ? '<span class="e-fhint" aria-hidden="true"></span>' : ''}</div>`;

  const BK = c.BUKTI;
  const repo = BK.repo
    ? link(BK.repo, strip(BK.repo))
    : c.ORG_GITHUB ? `${link(c.ORG_GITHUB, strip(c.ORG_GITHUB))} <span class="e-soon">${t('e.p.soon')}</span>` : DASH;
  const kontrak = (addr: string, base: string, ok: boolean) => addr
    ? `${link(`${base}/address/${addr}`, short(addr))}${ok ? `<span class="e-ver">${t('e.p.verified')}</span>` : ''}<small>${esc(addr)}</small>`
    : DASH;
  const urlLive = BK.urlLive ? link(BK.urlLive, strip(BK.urlLive)) : link(location.origin, location.host);
  const deploy = BK.deployment ? esc(BK.deployment) : DASH;
  const brow = (dt: string, dd: string) => `<div class="e-brow"><dt class="e-bdt">${dt}</dt><dd class="e-bdd">${dd}</dd></div>`;

  const board = live
    ? `<iframe class="e-board-frame" src="${esc(c.URL_LAYAR + '?sisip=1')}" title="${esc(tf('e.l.frameTitle', { name: c.NAMA }))}" loading="lazy"></iframe>`
    : `<div class="e-col"><h3 class="e-col-h">${t('e.l.queue')}</h3><div class="e-cards" data-col="q"></div></div>
       <div class="e-col"><h3 class="e-col-h"><span>${SA}</span><small data-omzet="0">${mon(0)}</small></h3><div class="e-cards" data-col="0"></div></div>
       <div class="e-col"><h3 class="e-col-h"><span>${SB}</span><small data-omzet="1">${mon(0)}</small></h3><div class="e-cards" data-col="1"></div></div>`;

  return `
<div class="e-lw e-lw-back"><div class="e-layer">${fw('back')}${fw('mid')}</div></div>
<div class="e-lw e-lw-streak" aria-hidden="true"><div class="e-layer"></div></div>
<div class="e-lw e-lw-front"><div class="e-layer">${fw('front')}</div></div>
<div class="e-main">

<section class="e-sec e-k" id="E-kilat" aria-labelledby="E-kilat-h">
  <div class="e-hlines" aria-hidden="true"></div>
  <div class="e-boltrow"><span class="e-bolt-l"><i></i><span>${t('e.k.block')}</span></span>${BOLT_H('e-bolt-h')}</div>
  <div class="e-kcopy"><h2 class="e-tag" id="E-kilat-h">${t('e.k.title')}</h2></div>
</section>

<section class="e-sec e-meter" id="E-rumus" aria-labelledby="E-rumus-h">
  <div class="e-head"><h2 class="e-lbl" id="E-rumus-h">${t('e.r.lbl')}</h2><span class="e-ord">${tf('e.r.order', { kind: t('e.order.kind'), title: t('e.order.title'), name: NM, h: H2 })}</span></div>
  <div class="e-num" aria-hidden="true" title="${esc(t('e.r.numTitle'))}"><span class="e-upah">${num(H)}</span><span class="e-unit">MON</span></div>
  <div class="e-mbar" aria-hidden="true"><i></i><b></b></div>
  <div class="e-sides">
    <div class="e-side">${t('e.r.toShop')}<b>${SA}</b><span class="e-upahS">${mon(H)}</span></div>
    <div class="e-mt">${tf('e.r.t', { t: num(0, 1), max: B })}</div>
    <div class="e-side e-r">${t('e.r.toCust')}<b>${NM}</b><span class="e-refund">${mon(0)}</span></div>
  </div>
  <div class="e-time">
    <div class="e-time-top"><span>${t('e.r.hint')}</span><span class="e-time-45">${tf('e.r.sec', { n: B })}</span></div>
    <div class="e-track"><i class="e-track-bg"></i><i class="e-track-late"></i><i class="e-track-mark"></i><input class="e-range" type="range" min="0" max="${B + 5}" step="0.1" value="0" aria-label="${esc(tf('e.r.rangeAria', { max: B }))}"></div>
    <div class="e-time-bot"><span>${tf('e.r.sec', { n: 0 })}</span><span>${t('e.r.late')}</span></div>
  </div>
  <p class="e-status">${tf('e.r.claim', { shop: SA })}</p>
  <p class="e-rumus">${tf('e.r.formula', { h: H2, max: B })}</p>
  <div class="e-acts" role="group" aria-label="${esc(t('e.r.actsAria'))}">
    <button type="button" data-act="Angkat tutup" disabled>${t('e.btn.lid')}</button>
    <button type="button" data-act="Taruh dokumen" disabled>${t('e.btn.doc')}</button>
    <button type="button" data-act="Copy!" disabled>${t('e.btn.copy')}</button>
    <button type="button" data-act="Ambil hasil" disabled>${t('e.btn.take')}</button>
  </div>
  <div class="e-parts" aria-hidden="true"></div>
</section>

<section class="e-flow" id="E-monad" aria-labelledby="E-monad-h">
  <div class="e-flow-bg" aria-hidden="true">${t('e.m.bg')}</div>
  <div class="e-head e-flow-head"><h2 class="e-lbl" id="E-monad-h">${t('e.m.lbl')}</h2><span class="e-ord">${t('e.m.sub')}</span></div>
  <article class="e-row" data-sp=".30" data-step="blok">
    <span class="e-rn" aria-hidden="true">01</span>
    <h3 class="e-rt"><span>${t('e.m.1.a')}</span><span>${t('e.m.1.b')}</span>${BOLT_H('e-bolt-row')}</h3>
    <div class="e-rd"><p>${t('e.m.1.p')}</p>
      <div class="e-race"><b>${SA}</b>${BOLT_S}<b>${SB}</b><small>${tf('e.m.1.s', { blok: `<span class="e-blok">${tf('e.m.blok', { n: (12345).toLocaleString(LOC) })}</span>` })}</small></div></div>
  </article>
  <article class="e-row e-alt" data-sp=".46" data-step="refund">
    <span class="e-rn" aria-hidden="true">02</span>
    <h3 class="e-rt"><span>${t('e.m.2.a')}</span><span>${t('e.m.2.b')}</span></h3>
    <div class="e-rd"><p>${tf('e.m.2.p', { max: B })}</p>
      <div class="e-split"><span>${tf('e.m.2.s', { max: B })}</span><div class="e-bars e-full"><i></i><b></b></div><div class="e-lab"><span>${tf('e.m.2.shop', { v: num(0) })}</span><span>${NM} ${num(H)}</span></div></div></div>
  </article>
  <article class="e-row" data-sp=".26" data-step="admin">
    <span class="e-rn" aria-hidden="true">03</span>
    <h3 class="e-rt"><span>${t('e.m.3.a')}</span></h3>
    <div class="e-rd"><p>${t('e.m.3.p')}</p>
      <div class="e-tix"><b>${t('e.m.3.log')}</b><span>OrderClaimed #0418 · ${SA}</span><span>OrderFinished #0418 · ${num(EX, 1)} ${U}</span><span>${tf('e.m.3.l3', { u: num(exU), r: num(H - exU), name: NM })}</span></div></div>
  </article>
</section>

<section class="e-sec e-two" id="E-sisi" aria-labelledby="E-sisi-h">
  <div class="e-head"><h2 class="e-lbl" id="E-sisi-h">${t('e.s.lbl')}</h2><span class="e-ord">${t('e.s.sub')}</span></div>
  <article class="e-pair" data-sp=".22" data-dir="1" data-step="sisi">
    <p class="e-pair-k">${t('e.s.1.k')}</p>
    <h3 class="e-pair-word">${t('e.s.1.w')}</h3>
    <div class="e-pair-body">
      <ul class="e-claims"><li>${t('e.s.1.c1')}</li><li>${t('e.s.1.c2')}</li><li>${t('e.s.1.c3')}</li></ul>
      <div class="e-sheets" role="img" aria-label="${esc(tf('e.s.nftAria', { name: NM }))}"><div class="e-sheet e-back"></div><div class="e-sheet e-front"><h4>${t('e.order.title')}</h4><span class="e-bl"></span><span class="e-bl"></span><span class="e-bl"></span><span class="e-bl"></span><span class="e-bl"></span><div class="e-who"><span>${t('e.s.for')}<br><b>${NM}</b></span><span class="e-stamp">NFT</span></div></div></div>
    </div>
  </article>
  <article class="e-pair e-alt" data-sp=".3" data-dir="-1">
    <p class="e-pair-k">${t('e.s.2.k')}</p>
    <h3 class="e-pair-word">${t('e.s.2.w')}</h3>
    <div class="e-pair-body">
      <ul class="e-claims"><li>${t('e.s.2.c1')}</li><li>${t('e.s.2.c2')}<small>${t('e.s.2.c2s')}</small></li></ul>
      <div class="e-race"><b>${SA}</b>${BOLT_S}<b>${SB}</b><small>${tf('e.s.2.race', { h: num(H), z: num(0), max: B })}</small></div>
    </div>
  </article>
  <div class="e-biz">
    <div class="e-head"><h3 class="e-lbl">${t('e.b.lbl')}</h3><span class="e-ord">${t('e.b.sub')}</span></div>
    <div class="e-steps">
      <div class="e-step" data-sp=".2" data-dir="1"><span class="e-step-n">01</span><span>${t('e.b.1')}</span>${ARR('')}</div>
      <div class="e-step e-i1" data-sp=".32" data-dir="-1"><span class="e-step-n">02</span><span>${t('e.b.2')}</span>${ARR('')}</div>
      <div class="e-step e-i2" data-sp=".16" data-dir="1"><span class="e-step-n">03</span><span>${t('e.b.3')}</span></div>
    </div>
    <div class="e-fee">
      <p>${t('e.b.p')}</p>
      <div class="e-tix"><span>${t('e.b.fee')}</span><b class="e-fee-v${isi ? ' e-isi' : ''}">${esc(fee)}</b></div>
    </div>
  </div>
</section>

<section class="e-sec e-live" id="E-live" aria-labelledby="E-live-h">
  <div class="e-head"><h2 class="e-lbl" id="E-live-h">${t('e.l.lbl')}</h2><a class="e-link" href="${esc(c.URL_LAYAR)}" target="_blank" rel="noopener">${t('e.l.link')}</a></div>
  <div class="e-live-top"><p class="e-live-t">${t('e.l.title')}</p><span class="e-simu${live ? ' e-is-live' : ''}">${live ? t('e.l.live') : t('e.l.sim')}</span></div>
  <p class="e-live-note">${live ? t('e.l.noteLive') : tf('e.l.noteSim', { n: '<b class="e-total">417</b>' })}</p>
  <div class="e-board">${board}</div>
  ${live ? '' : `<ul class="e-tick" aria-label="${esc(t('e.l.tickAria'))}"></ul>`}
</section>

<section class="e-sec e-bukti" id="E-bukti" aria-labelledby="E-bukti-h">
  <div class="e-head"><h2 class="e-lbl" id="E-bukti-h">${t('e.p.lbl')}</h2><span class="e-ord">${t('e.p.sub')}</span></div>
  <p class="e-bukti-h">${t('e.p.title')}</p>
  <dl class="e-dl">
    ${brow(t('e.p.repo'), repo)}
    ${brow(t('e.p.test'), kontrak(BK.kontrakTestnet, c.EXPLORER.testnet, BK.verifiedTestnet))}
    ${brow(t('e.p.main'), kontrak(BK.kontrakMainnet, c.EXPLORER.mainnet, BK.verifiedMainnet))}
    ${brow(t('e.p.url'), urlLive)}
    ${brow(t('e.p.deploy'), deploy)}
  </dl>
</section>

<section class="e-sec e-cta" id="E-pesan" aria-label="${esc(t('e.cta.btn'))}">
  <a class="e-cta-btn" href="${esc(c.URL_PESAN)}" target="_blank" rel="noopener"><span class="e-zip" aria-hidden="true"><i></i><i></i><i></i></span><span class="e-cta-lbl">${t('e.cta.btn')}</span>${ARR('e-arr')}</a>
  <div class="e-cta-low">
    <div class="e-qr"><canvas width="640" height="640" role="img" aria-label="${esc(tf('e.cta.qrAria', { url: strip(pesan) }))}"></canvas></div>
    <div class="e-qr-cap"><h3>${t('e.cta.scan')}</h3><p>${esc(strip(pesan))}</p></div>
  </div>
  <footer class="e-foot"><p>${tf('e.foot', { name: esc(c.NAMA) })}</p></footer>
</section>

</div>`;
}

/* ================= pasang ================= */
function mount(root: HTMLElement, c: Ctx): void {
  if (root.dataset.eMounted) return;
  root.dataset.eMounted = '1';
  const RM = c.reduced;
  const HARGA = c.HARGA_MON, BATAS = c.BATAS_KERJA, TMAX = BATAS + 5;
  const wage = (x: number) => (x > BATAS ? 0 : upahSekarang(HARGA, BATAS, x));
  const HINT = t('e.fig.hint'), NM = t('e.name'), SA = t('e.shop.a'), SB = t('e.shop.b');

  root.classList.add('E');
  root.innerHTML = template(c);
  const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => r.querySelector(s) as T;
  const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => Array.from(r.querySelectorAll(s)) as T[];
  secs = $$('.e-main > section');

  /* huruf tambahan mockup (Archivo + DM Mono), dimuat setelah halaman tenang */
  const addFonts = () => {
    if (document.getElementById('E-fonts')) return;
    const l = document.createElement('link'); l.id = 'E-fonts'; l.rel = 'stylesheet'; l.href = FONT_URL;
    document.head.appendChild(l);
  };
  if (document.readyState === 'complete') setTimeout(addFonts, 200);
  else addEventListener('load', () => setTimeout(addFonts, 200), { once: true });

  function makeLines(box: HTMLElement, n: number, cls: string, kinds: Record<number, string> = {}): Line[] {
    const out: Line[] = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = cls + (kinds[i] ? ' ' + kinds[i] : '');
      box.appendChild(el); out.push({ el, x: 0, y: 0, w: 0, h: 0, sp: 0, y2: kinds[i] === 'e-y' });
    }
    return out;
  }
  const sec1 = secs[0], hlines = $('.e-hlines');
  const heroLines = RM ? [] : makeLines(hlines, 18, 'e-ln', { 3: 'e-a', 11: 'e-a', 7: 'e-y' }); // garis kecepatan di belakang judul pembuka E
  const streakLayer = $('.e-lw-streak .e-layer');
  const streaks = RM ? [] : makeLines(streakLayer, 14, 'e-ln', { 2: 'e-a', 9: 'e-a', 5: 'e-y' });

  /* ---------- ukuran ---------- */
  const frontLayer = $('.e-lw-front .e-layer'), backWrap = $('.e-lw-back');
  const wraps = $$('.e-lw');
  let W = innerWidth, H = innerHeight, mobile = c.isMobile(), useMid = !mobile;
  let eTop = 0, k1H = 0, flowTop = 0, secTop: number[] = [], secH: number[] = [], lastWH = '', backOp = 1;
  const st = { sy: scrollY, ly: scrollY, v: 0, last: performance.now(), streakO: 0 };

  function seedLines() {
    const hh = sec1.offsetHeight;
    heroLines.forEach(l => {
      l.w = l.y2 ? rnd(24, 60) : rnd(40, W * 0.36); l.y = rnd(hh * 0.04, hh * 0.97); l.x = rnd(-l.w, W);
      l.sp = rnd(70, 420) * (l.y2 ? 2.4 : 1);
      l.el.style.width = l.w.toFixed(0) + 'px'; l.el.style.top = l.y.toFixed(0) + 'px';
      l.el.style.transform = `translate3d(${l.x.toFixed(1)}px,0,0)`;
    });
    streaks.forEach(l => {
      l.w = rnd(60, W * 0.42); l.y = rnd(H * 0.03, H * 0.97); l.x = rnd(-l.w, W); l.sp = rnd(0.6, 1.4);
      l.el.style.width = l.w.toFixed(0) + 'px'; l.el.style.top = l.y.toFixed(0) + 'px';
    });
  }

  /* ---------- figur (3 kedalaman; HP: 2) ---------- */
  const FIGS: Record<K, [FigName, number, string]> = {
    front: ['mesin-fotokopi', 0, t('e.fig.fk')], mid: ['laminator-a4', 2.1, t('e.fig.lm')], back: ['printer-inkjet', 4.0, t('e.fig.pr')],
  };
  const KS: K[] = ['front', 'mid', 'back'];
  const slots = {} as Record<K, Slot>;
  KS.forEach(k => {
    const el = $(`.e-fw[data-k="${k}"]`);
    slots[k] = { k, fig: FIGS[k][0], ph: FIGS[k][1], title: FIGS[k][2], el, box: $('.e-fbox', el), trail: $('.e-trail', el), hint: el.querySelector<HTMLElement>('.e-fhint'),
      S: 0, y0: 0, spd: 0, depth: 1, xa: 0, sh: 1, yh: 0, xh: 0, phX: 0, prevSy: null, press: false, gom: 1, t0: -1e9, api: null, mounting: false, last: 0 };
  });
  const figPal = () => (document.documentElement.dataset.pal === 'aspal' ? 'mustard' : 'monad');

  function figLayout(resetPhase: boolean) {
    const f = slots.front, m = slots.mid, b = slots.back;
    if (mobile) {
      f.S = W * 0.8; f.y0 = H - f.S * 0.84; f.spd = 1.1; f.depth = 1; f.sh = 1; f.yh = f.y0; f.xh = W - f.S * 0.98;
      m.S = 0;
      b.S = W * 0.42; b.y0 = H * 0.05; b.spd = 0.3; b.xa = W * 0.5; b.depth = 0.3;
    } else {
      f.S = clamp(Math.min(W * 0.4, H * 0.74), 260, 780); f.y0 = H - f.S * 0.84; f.spd = 1.15; f.depth = 1;
      f.sh = 1; f.yh = f.y0; f.xh = W * 0.55;
      m.S = Math.min(W * 0.25, H * 0.44); m.y0 = H * 0.36; m.spd = 0.62; m.xa = W * 0.34; m.depth = 0.6;
      b.S = Math.min(W * 0.15, H * 0.27); b.y0 = H * 0.07; b.spd = 0.3; b.xa = W * 0.3; b.depth = 0.3;
    }
    m.el.style.display = useMid ? '' : 'none';
    const ls = (RM ? eTop : scrollY) - eTop;
    KS.forEach(k => {
      const s = slots[k]; if (!s.S) return;
      s.el.style.width = s.el.style.height = s.S.toFixed(0) + 'px';
      // fase lintasan diakumulasi dari selisih scroll (bukan scrollY langsung) supaya bisa dijeda saat figur ditekan
      if (resetPhase) { s.phX = ls * s.spd + (k === 'front' ? s.xh : s.xa) + s.S; s.prevSy = null; }
    });
  }

  function act(k: K, label: string, force = false) {
    const s = slots[k], a = s.api; if (!a) return;
    const now = performance.now();
    if (!force && now - s.last < 2200) return;
    s.last = now;
    try { a.act(label); } catch { /* figur belum siap */ }
  }
  const actsBtns = $$<HTMLButtonElement>('.e-acts button');
  actsBtns.forEach(bt => bt.addEventListener('click', () => act('front', bt.dataset.act || 'Copy!', true)));

  /* menekan figur = jeda lintasannya; dilepas = lanjut dengan easeOutBack ringan */
  function wirePress(s: Slot, api: FigApi) {
    const down = () => { s.press = true; s.gom = 0; if (s.hint) s.hint.textContent = t('e.fig.held'); };
    const up = () => { if (!s.press) return; s.press = false; s.t0 = performance.now(); if (s.hint) s.hint.textContent = HINT; };
    const ts: EventTarget[] = [api.frame];
    try { if (api.doc) ts.push(api.doc); } catch { /* lintas asal: cukup bingkai */ }
    ts.forEach(t => { t.addEventListener('pointerdown', down, true); t.addEventListener('pointerup', up, true); t.addEventListener('pointercancel', up, true); });
    addEventListener('pointerup', up);
  }

  function mountSlot(s: Slot) {
    if (s.api || s.mounting || !s.S) return;
    s.mounting = true;
    c.mountFig(s.box, s.fig, { interactive: true, palette: figPal(), title: s.title }).then(api => {
      s.api = api; api.palette(figPal()); wirePress(s, api);
      if (s.hint) { s.hint.textContent = HINT; s.hint.classList.add('e-on'); } // petunjuk hanya di mesin depan
      if (s.k === 'front') { actsBtns.forEach(b => (b.disabled = false)); if (!RM) setTimeout(() => act('front', 'Copy!'), 900); }
      if (s.k === 'back') { act('back', 'Nyalakan', true); if (!RM) setTimeout(() => act('back', 'Print!', true), 1600); }
      if (s.k === 'mid') act('mid', 'Nyalakan', true);
    }).catch(() => { s.mounting = false; });
  }
  let near = false;
  function ensureFigs() {
    if (!near) return;
    const order: K[] = useMid ? ['front', 'back', 'mid'] : ['front', 'back']; // HP: maks 2 figur
    order.forEach((k, i) => setTimeout(() => mountSlot(slots[k]), i * 350));
  }
  new MutationObserver(() => KS.forEach(k => { try { slots[k].api?.palette(figPal()); } catch { /* abaikan */ } }))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-pal'] });

  /* ---------- baris yang meluncur (kenapa Monad, dua sisi, model bisnis) ---------- */
  const slides: Slide[] = [];
  $$('.e-row').forEach((r, i) => slides.push({ el: r, top: 0, h: 0, sp: parseFloat(r.dataset.sp || '.3'), dir: i % 2 ? -1 : 1,
    parts: [{ el: $('.e-rt', r), m: 1, skew: true }, { el: $('.e-rn', r), m: 1.7, skew: false }, { el: $('.e-rd', r), m: 0.55, skew: false }] }));
  $$('.e-pair').forEach(r => slides.push({ el: r, top: 0, h: 0, sp: parseFloat(r.dataset.sp || '.25'), dir: parseFloat(r.dataset.dir || '1'),
    parts: [{ el: $('.e-pair-word', r), m: 1, skew: true }, { el: $('.e-pair-k', r), m: 1.5, skew: false }, { el: $('.e-pair-body', r), m: 0.45, skew: false }] }));
  $$('.e-step').forEach(r => slides.push({ el: r, top: 0, h: 0, sp: parseFloat(r.dataset.sp || '.2'), dir: parseFloat(r.dataset.dir || '1'),
    parts: [{ el: r, m: 1, skew: true }] }));
  const flowBg = $('.e-flow-bg');
  const blokEl = $('.e-blok');
  let blokN = 12345, blokAcc = 0;

  /* ---------- meteran upah + partikel ---------- */
  const meter = secs[1];
  const upahEl = $('.e-upah'), upahS = $('.e-upahS'), refundEl = $('.e-refund'), mtEl = $('.e-mt'), statusEl = $('.e-status');
  const barL = $('.e-mbar i'), barR = $('.e-mbar b'), numEl = $('.e-num'), timeBox = $('.e-time');
  const range = $<HTMLInputElement>('.e-range');
  const partsBox = $('.e-parts');
  const pool: Part[] = [];
  if (!RM) for (let i = 0; i < 56; i++) {
    const el = document.createElement('span'); el.className = 'e-p'; partsBox.appendChild(el);
    pool.push({ el, on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, r: 0, vr: 0 });
  }
  let meterVis = false, liveVis = false;
  function spawn(text: string, x: number, y: number, vx: number, vy: number, cls: string, life: number) {
    if (RM || !meterVis) return;
    const p = pool.find(q => !q.on); if (!p) return;
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.age = 0; p.life = life; p.r = rnd(-20, 20); p.vr = rnd(-120, 120);
    p.el.className = 'e-p ' + cls; p.el.textContent = text;
  }
  let oc: { l: number; t: number; w: number; h: number } | null = null; // posisi angka di dalam bagian rumus (dihitung saat tata letak)
  function origin() {
    if (!oc) { const mr = meter.getBoundingClientRect(), nr = upahEl.getBoundingClientRect(); oc = { l: nr.left - mr.left, t: nr.top - mr.top, w: nr.width, h: nr.height }; }
    return oc;
  }
  const DELTA = HARGA * 0.25 / BATAS;
  function spawnTick(u: number) { // detik berjalan: sepotong upah lepas ke pelanggan, satu digit rontok ke toko
    const o = origin();
    spawn('+' + num(DELTA), o.l + o.w * rnd(0.7, 0.95), o.t + o.h * rnd(0.3, 0.6), rnd(240, 420), rnd(-180, -40), 'e-pr', rnd(1.1, 1.6));
    const s = num(u).replace(/[.,]/, '');
    spawn(s.charAt((Math.random() * s.length) | 0), o.l + o.w * rnd(0.05, 0.5), o.t + o.h * rnd(0.2, 0.8), rnd(-420, -200), rnd(-160, -20), 'e-pl', rnd(0.9, 1.4));
  }
  function spawnBack(u: number) { // waktu digeser mundur: potongan kembali ke toko
    const o = origin();
    spawn('+' + num(DELTA * 2), o.l + o.w * rnd(0.3, 0.7), o.t + o.h * rnd(0.3, 0.6), rnd(-460, -260), rnd(-180, -40), 'e-pl', rnd(1.1, 1.6));
    const s = num(HARGA - u).replace(/[.,]/, '');
    spawn(s.charAt((Math.random() * s.length) | 0), o.l + o.w * rnd(0.6, 0.95), o.t + o.h * rnd(0.2, 0.8), rnd(200, 380), rnd(-160, -20), 'e-pr', rnd(0.9, 1.4));
  }
  let lastBurst = 0;
  function burst(u: number, r: number) { // angka pecah: upah ke kiri (toko), refund ke kanan (pelanggan)
    const now = performance.now(); if (now - lastBurst < 500) return; lastBurst = now;
    const o = origin();
    for (let i = 0; i < 12; i++) spawn(i % 3 ? num(u).charAt(2 + (i % 4)) : num(u), o.l + o.w * rnd(0, 0.5), o.t + o.h * rnd(0.1, 0.9), rnd(-640, -220), rnd(-260, 60), i % 3 ? 'e-pl' : 'e-pl e-big', rnd(1.2, 1.9));
    for (let i = 0; i < 12; i++) spawn(i % 3 ? num(r).charAt(2 + (i % 4)) : num(r), o.l + o.w * rnd(0.5, 1), o.t + o.h * rnd(0.1, 0.9), rnd(220, 640), rnd(-260, 60), i % 3 ? 'e-pr' : 'e-pr e-big', rnd(1.2, 1.9));
  }
  function updateParts(dt: number) {
    const s = dt / 1000;
    for (const p of pool) {
      if (!p.on) continue;
      p.age += s;
      if (p.age >= p.life) { p.on = false; p.el.style.opacity = '0'; continue; }
      p.vy += 210 * s; p.vx *= 1 - 0.55 * s;
      p.x += p.vx * s; p.y += p.vy * s; p.r += p.vr * s;
      const k = p.age / p.life;
      p.el.style.opacity = (1 - k * k).toFixed(3);
      p.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) rotate(${p.r.toFixed(1)}deg)`;
    }
  }

  const M = { t: RM ? EX : 0, run: 0, phase: 'run' as 'run' | 'done' | 'late', hold: 0, acc: 0,
    mode: (RM ? 'manual' : 'auto') as 'auto' | 'manual', drag: false, lastInput: -1e9, u: HARGA, tU: HARGA, accT: 0, shown: '' };
  const shopOf = (run: number) => (run % 2 ? SB : SA);
  const lateText = () => tf('e.r.lateMsg', { max: BATAS, h: num(HARGA), name: NM });
  function writeWage(u: number) {
    const s = num(u); if (s === M.shown) return; M.shown = s;
    upahEl.textContent = s; upahS.textContent = mon(u); refundEl.textContent = mon(HARGA - u);
  }
  function renderMeter() {
    const late = M.t > BATAS, u = wage(M.t);
    M.tU = u;
    mtEl.textContent = late ? tf('e.r.tLate', { max: BATAS }) : tf('e.r.t', { t: num(M.t, 1), max: BATAS });
    barL.style.transform = `scaleX(${(u / HARGA).toFixed(4)})`;
    barR.style.transform = `scaleX(${(1 - u / HARGA).toFixed(4)})`;
    if (document.activeElement !== range || M.mode === 'auto') range.value = String(M.t);
    range.setAttribute('aria-valuetext', late
      ? tf('e.r.valLate', { max: BATAS, h: num(HARGA) })
      : tf('e.r.val', { t: num(M.t, 1), u: num(u), r: num(HARGA - u) }));
    timeBox.classList.toggle('e-late', late);
    if (RM) writeWage(u);
  }
  function statusManual() {
    const u = wage(M.t);
    statusEl.textContent = M.t > BATAS ? lateText()
      : tf('e.r.if', { t: num(M.t, 1), shop: SA, u: num(u), r: num(HARGA - u), name: NM });
  }
  function autoTick() {
    if (M.phase === 'run') {
      M.t = Math.round((M.t + 0.25) * 100) / 100;
      const fin = RUNS[M.run], shop = shopOf(M.run);
      if (fin !== null && M.t >= fin) {
        M.t = fin; M.phase = 'done'; M.hold = 0; renderMeter();
        const u = wage(fin);
        statusEl.textContent = tf('e.r.done', { t: num(fin, 1), shop, u: num(u), r: num(HARGA - u), name: NM });
        burst(u, HARGA - u);
        act('front', 'Ambil hasil', true);
      } else if (M.t > BATAS) {
        M.phase = 'late'; M.hold = 0; renderMeter();
        statusEl.textContent = lateText();
        burst(0, HARGA);
      } else {
        renderMeter(); spawnTick(wage(M.t));
        if (M.t === 0.25) statusEl.textContent = tf('e.r.claim', { shop });
      }
    } else {
      if (M.phase === 'late' && M.t < BATAS + 2.5) { M.t = Math.round((M.t + 0.25) * 100) / 100; renderMeter(); }
      M.hold += 0.25;
      if (M.hold >= 3) restartAuto(true);
    }
  }
  function restartAuto(next: boolean) {
    M.mode = 'auto'; M.phase = 'run'; M.t = 0; M.hold = 0; M.acc = 0; M.accT = 0;
    if (next) M.run = (M.run + 1) % RUNS.length;
    renderMeter(); statusEl.textContent = tf('e.r.claim', { shop: shopOf(M.run) });
    act('front', 'Copy!', true);
  }
  function setManual(tt: number) {
    const prev = M.t;
    M.mode = 'manual'; M.lastInput = performance.now();
    M.t = clamp(Math.round(tt * 10) / 10, 0, TMAX);
    renderMeter(); statusManual();
    M.accT = clamp(M.accT + (M.t - prev), -3, 3);
    while (Math.abs(M.accT) >= 0.5) {
      const d = Math.sign(M.accT); M.accT -= d * 0.5;
      if (M.t <= BATAS || d < 0) (d > 0 ? spawnTick : spawnBack)(wage(M.t));
    }
  }
  range.addEventListener('input', () => setManual(parseFloat(range.value)));
  range.addEventListener('change', () => burst(wage(M.t), HARGA - wage(M.t)));
  let dragX = 0, dragT = 0, numW = 300, moved = false;
  numEl.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    M.drag = true; moved = false; dragX = e.clientX; dragT = M.t; numW = Math.max(200, numEl.getBoundingClientRect().width);
    try { numEl.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
    numEl.classList.add('e-grab');
  });
  numEl.addEventListener('pointermove', e => {
    if (!M.drag) return;
    const dx = e.clientX - dragX; if (!moved && Math.abs(dx) < 4) return;
    moved = true; setManual(dragT + dx / numW * BATAS);
  });
  const endDrag = () => { if (!M.drag) return; M.drag = false; numEl.classList.remove('e-grab'); burst(wage(M.t), HARGA - wage(M.t)); };
  numEl.addEventListener('pointerup', endDrag);
  numEl.addEventListener('pointercancel', () => { M.drag = false; numEl.classList.remove('e-grab'); });
  function meterFrame(now: number, dt: number) {
    if (!meterVis) return;
    if (M.mode === 'manual' && !M.drag && now - M.lastInput > 7000) restartAuto(true);
    if (M.mode === 'auto') { M.acc += dt; let n = 0; while (M.acc >= 250 && n++ < 4) { M.acc -= 250; autoTick(); } if (M.acc > 250) M.acc = 0; }
    // angka upah ditween per frame ke target
    const k = 1 - Math.pow(0.0008, dt / 1000);
    M.u += (M.tU - M.u) * k;
    if (Math.abs(M.tU - M.u) < 0.000015) M.u = M.tU;
    writeWage(M.u);
  }
  if (RM) { range.value = String(M.t); statusManual(); }
  renderMeter();

  /* ---------- live: simulasi (berlabel SIMULASI) atau papan app ---------- */
  const isFrame = c.MODE === 'LIVE' && !!c.URL_APP;
  const sim = isFrame ? null : new MockSim();
  let ups: { el: HTMLElement; bar: HTMLElement | null; id: number }[] = [];
  const card = (o: Order, now: number) => {
    const no = '#' + String(o.id).padStart(4, '0');
    if (o.status === 'Open') return `<div class="e-card"><div class="e-card-top"><span>${no}</span><span>${tf('e.c.left', { n: Math.max(0, Math.round(BATAS - (now - o.dibuat))) })}</span></div><div class="e-card-l">${esc(tm(o.label))}</div><div class="e-card-t">“${esc(tm(o.teks))}”</div></div>`;
    if (o.status === 'Claimed') {
      const u = upahSekarang(HARGA, o.batasKerja, now - (o.diclaim ?? now));
      return `<div class="e-card"><div class="e-card-top"><span>${tf('e.c.step', { no, a: o.langkahSelesai, b: o.langkah })}</span><span>${t('e.c.now')}</span></div><div class="e-card-up" data-up="${o.id}">${num(u)}</div><div class="e-card-bar"><i data-bar="${o.id}" style="transform:scaleX(${(u / HARGA).toFixed(4)})"></i></div><div class="e-card-t">${esc(tm(o.label))} · “${esc(tm(o.teks))}”</div></div>`;
    }
    if (o.status === 'Finished') return `<div class="e-card e-done"><div class="e-card-top"><span>${tf('e.c.done', { no, t: o.kerja ?? 0 })}</span><span>✓</span></div><div class="e-card-l">+${mon(o.upah ?? 0)}</div><div class="e-card-t">${tf('e.c.doneT', { r: num(o.refund ?? 0) })}</div></div>`;
    return `<div class="e-card e-exp"><div class="e-card-top"><span>${tf('e.c.late', { no })}</span><span>${t('e.c.refund')}</span></div><div class="e-card-l">${tf('e.c.lateL', { r: num(o.refund ?? HARGA) })}</div><div class="e-card-t">${tf('e.c.lateT', { max: BATAS })}</div></div>`;
  };
  function renderBoard() {
    if (!sim) return;
    const now = Date.now() / 1000, all = [...sim.orders.values()], lim = c.isMobile() ? 2 : 3;
    const q = all.filter(o => o.status === 'Open' || (o.status === 'Expired' && o.toko === null)).sort((a, b) => a.dibuat - b.dibuat).slice(0, lim);
    const colQ = $('[data-col="q"]');
    colQ.innerHTML = q.length ? q.map(o => card(o, now)).join('') : `<p class="e-empty">${t('e.l.empty')}</p>`;
    [0, 1].forEach(i => {
      const os = all.filter(o => o.toko === i).sort((a, b) => b.id - a.id).slice(0, lim);
      $(`[data-col="${i}"]`).innerHTML = os.length ? os.map(o => card(o, now)).join('') : `<p class="e-empty">${t('e.l.wait')}</p>`;
      $(`[data-omzet="${i}"]`).textContent = mon(sim.shops[i].omzet);
    });
    $('.e-tick').innerHTML = sim.txs.slice(0, 8).map(x => `<li><b>${esc(x.kind)}</b> #${String(x.id).padStart(4, '0')}</li>`).join('');
    $('.e-total').textContent = String(sim.total);
    ups = $$<HTMLElement>('[data-up]').map(el => ({ el, bar: root.querySelector<HTMLElement>(`[data-bar="${el.dataset.up}"]`), id: Number(el.dataset.up) }));
  }
  function updateUps() {
    if (!sim) return;
    const now = Date.now() / 1000;
    for (const x of ups) {
      const o = sim.orders.get(x.id); if (!o || o.diclaim === null) continue;
      const u = upahSekarang(HARGA, o.batasKerja, now - o.diclaim);
      x.el.textContent = num(u);
      if (x.bar) x.bar.style.transform = `scaleX(${(u / HARGA).toFixed(4)})`;
    }
  }
  if (sim) {
    sim.onChange(() => { if (liveVis) renderBoard(); });
    renderBoard();
  }

  /* ---------- QR ---------- */
  let qrDone = false;
  function drawQR() {
    if (qrDone) return; qrDone = true;
    const cv = $<HTMLCanvasElement>('.e-qr canvas');
    Promise.resolve(QRCode.toCanvas(cv, absUrl(c.URL_PESAN), { margin: 1, width: 640, errorCorrectionLevel: 'M', color: { dark: '#0E0F12', light: '#FFFFFF' } }))
      .catch(() => { qrDone = false; });
  }

  /* ================= gambar per frame ================= */
  function heroFrame(dt: number, v: number) { // garis kecepatan di belakang judul pembuka E
    const av = Math.abs(v);
    const boost = 1 + av * 2.2, s = dt / 1000, sc = (1 + av * 0.6).toFixed(3);
    heroLines.forEach(l => {
      l.x -= l.sp * boost * s; if (l.x < -l.w * 1.6) l.x = W + rnd(0, W * 0.3);
      l.el.style.transform = `translate3d(${l.x.toFixed(1)}px,0,0) scaleX(${sc})`;
    });
  }

  function streakFrame(dt: number, v: number) {
    const av = Math.abs(v), o = clamp((av - 0.35) * 0.32, 0, 0.6);
    if (o < 0.01 && st.streakO < 0.01) return;
    st.streakO = o; streakLayer.style.opacity = o.toFixed(3);
    const dir = v > 0 ? -1 : 1, s = dt / 1000;
    streaks.forEach(l => {
      l.x += dir * 1500 * av * l.sp * s;
      if (l.x < -l.w) l.x = W + rnd(0, W * 0.2);
      if (l.x > W) l.x = -l.w - rnd(0, W * 0.2);
      l.el.style.transform = `translate3d(${l.x.toFixed(1)}px,0,0)`;
    });
  }

  function placeFigs(now: number, sy: number, v: number) {
    const ls = sy - eTop;
    const s2 = eTop + (secTop[1] || 0), s3 = eTop + (secTop[2] || 0);
    const s5 = eTop + (secTop[4] || 0), s6 = eTop + (secTop[5] || 0), s7 = eTop + (secTop[6] || 0);
    // iframe figur menangkap ketukan di seluruh kotaknya: di rumus (slider) mesin depan turun separuh,
    // di papan live, bukti, dan QR turun ke tepi bawah supaya semuanya terbaca dan bisa diklik
    // di rumus: mesin depan parkir kecil di pojok kanan bawah (tombol aksinya tetap jalan), figur lain memudar.
    // di live, bukti, dan QR: semua figur menyingkir supaya isi terbaca dan bisa diklik.
    const inRumus = RM ? 0 : sstep(s2 - H * 0.6, s2 - H * 0.1, sy) * (1 - sstep(s3 - H * 0.6, s3 - H * 0.1, sy));
    const inTail = RM ? 0 : sstep(s5 - H * 0.7, s5 - H * 0.15, sy);
    const pinR = mobile ? 0 : inRumus; // HP terlalu sempit untuk parkir: mesin menyingkir penuh di rumus
    const drop = 1.15 * (mobile ? Math.max(inTail, inRumus) : inTail);
    const fadeMB = 1 - Math.max(inRumus, inTail);
    KS.forEach(k => {
      const s = slots[k]; if (!s.S || (k === 'mid' && !useMid)) return;
      const dsy = s.prevSy === null ? 0 : sy - s.prevSy; s.prevSy = sy;
      if (s.press) s.gom = 0;
      else if (now - s.t0 < 620) { const g1 = clamp((now - s.t0) / 620, 0, 1) - 1; s.gom = 1 + 1.9 * g1 * g1 * g1 + 0.9 * g1 * g1; }
      else s.gom = 1;
      if (!s.press) s.phX += dsy * s.spd * s.gom;
      let x = mod(s.phX, W + s.S) - s.S;
      const bob = Math.sin(now * 0.0011 + s.ph) * s.S * 0.016;
      let y: number, sc = 1;
      if (k === 'front') { // jalur bawah
        const kk = sstep(0, H * 0.7, ls);
        y = s.yh + (s.y0 - s.yh) * kk + bob + drop * s.S * 1.05;
        sc = s.sh + (1 - s.sh) * kk;
        if (pinR > 0.001) {
          const pinSc = sc * (1 - 0.4 * pinR);
          x = x + (W - s.S * pinSc * 0.9 - x) * pinR;
          y = y + (H - s.S * pinSc * 0.84 - y) * pinR;
          sc = pinSc;
        }
      } else {
        y = s.y0 + bob;
        const o = fadeMB.toFixed(3);
        if (s.el.style.opacity !== o) s.el.style.opacity = o;
      }
      const pe = inRumus > 0.5 || inTail > 0.5 ? 'none' : '';
      if (s.el.style.pointerEvents !== pe) s.el.style.pointerEvents = pe;
      const tilt = clamp(v * 2.2, -7, 7) * s.depth, sk = clamp(-v * 3.2, -9, 9) * s.depth;
      s.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${sc.toFixed(3)}) rotate(${tilt.toFixed(2)}deg) skewX(${sk.toFixed(2)}deg)`;
      s.trail.style.transform = `scaleX(${clamp(v * 0.32, -1.1, 1.1).toFixed(3)})`;
      s.trail.style.opacity = Math.min(Math.abs(v) * 0.5, 0.85).toFixed(3);
    });
    if (!RM) {
      const fb = 1 - 0.7 * sstep(s6 - H * 0.6, s6 - H * 0.1, sy) * (1 - sstep(s7 - H * 0.6, s7 - H * 0.1, sy));
      if (Math.abs(fb - backOp) > 0.005) { backOp = fb; backWrap.style.opacity = fb.toFixed(3); }
    }
  }

  function placeRows(sy: number, v: number) {
    const sk = clamp(-v * 3, -12, 12).toFixed(2);
    for (const r of slides) {
      const rc = eTop + r.top + r.h / 2 - sy - H / 2;
      if (Math.abs(rc) > H * 1.6) continue;
      const base = clamp(rc / H, -1, 1) * W * r.sp * r.dir;
      for (const p of r.parts) p.el.style.transform = `translate3d(${(base * p.m).toFixed(1)}px,0,0)${p.skew ? ` skewX(${sk}deg)` : ''}`;
    }
    if (sy + H > flowTop - 100 && sy < flowTop + (secH[2] || 0) + H) flowBg.style.transform = `translate3d(${(-(sy - flowTop + H) * 0.35).toFixed(1)}px,0,0)`;
  }

  /* ================= tata letak ================= */
  function layout() {
    W = frontLayer.clientWidth || Math.max(innerWidth || 0, 320);
    H = frontLayer.clientHeight || Math.max(innerHeight || 0, 480);
    W = Math.max(W, 320); H = Math.max(H, 480);
    mobile = c.isMobile(); useMid = !mobile;
    const rr = root.getBoundingClientRect(), y = scrollY;
    eTop = rr.top + y;
    secTop = secs.map(s => s.getBoundingClientRect().top - rr.top);
    secH = secs.map(s => s.offsetHeight);
    k1H = secH[0];
    oc = null;
    flowTop = eTop + secTop[2];
    slides.forEach(r => { const b = r.el.getBoundingClientRect(); r.top = b.top - rr.top; r.h = b.height; });
    const wh = `${W}x${H}x${mobile}`, resized = wh !== lastWH;
    figLayout(wh !== lastWH); lastWH = wh;
    if (!RM && resized) seedLines();
    ensureFigs();
    renderNow();
  }
  /* satu render sinkron: tampilan benar walau rAF belum/tidak jalan */
  function renderNow() {
    const y = scrollY, now = performance.now();
    st.sy = st.ly = y;
    if (RM) { placeFigs(now, eTop, 0); return; }
    heroFrame(0, 0);
    placeFigs(now, y, 0);
    placeRows(y, 0);
  }

  /* ================= loop (satu, milik bagian E) ================= */
  let raf = 0, active = false, copyAcc = 0, liveAcc = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    let dt = Math.min(now - st.last, 50); st.last = now; if (dt <= 0) dt = 16.7;
    const y = scrollY;
    eTop = root.getBoundingClientRect().top + y; // isi D di atas bisa berubah tinggi
    flowTop = eTop + (secTop[2] || 0);
    const vi = clamp((y - st.ly) / dt, -8, 8); st.ly = y;
    const f = dt / 16.67;
    st.v += (vi - st.v) * (1 - Math.pow(0.9, f)); // kemiringan & blur mengikuti kecepatan dengan pelambatan halus
    if (Math.abs(st.v) < 0.002) st.v = 0;
    st.sy += (y - st.sy) * (1 - Math.pow(0.86, f));
    if (Math.abs(y - st.sy) < 0.05) st.sy = y;
    const sy = st.sy, v = st.v, ls = sy - eTop;
    if (ls > -H * 1.05 && ls < k1H + 60) heroFrame(dt, v);
    streakFrame(dt, v);
    placeFigs(now, sy, v);
    placeRows(sy, v);
    updateParts(dt);
    meterFrame(now, dt);
    blokAcc += dt;
    if (blokAcc >= 400) { // ±400 ms per blok (docs Monad)
 blokAcc = 0; const r1 = eTop + (secTop[2] || 0); if (sy + H > r1 && sy < r1 + (secH[2] || 0)) { blokN++; blokEl.textContent = tf('e.m.blok', { n: blokN.toLocaleString(LOC) }); } }
    copyAcc += dt;
    if (copyAcc > 9000) { copyAcc = 0; if (ls > -H * 0.5 && ls < (secTop[2] || 0)) act('front', 'Copy!'); }
    if (liveVis && ups.length) { liveAcc += dt; if (liveAcc >= 200) { liveAcc = 0; updateUps(); } }
  }
  function startLoop() {
    if (RM || raf) return;
    st.last = performance.now(); st.ly = st.sy = scrollY; st.v = 0;
    KS.forEach(k => (slots[k].prevSy = null));
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  /* ================= pengamat ================= */
  new IntersectionObserver(es => {
    if (!es[es.length - 1].isIntersecting || near) return;
    near = true; ensureFigs(); drawQR();
  }, { rootMargin: '100% 0px' }).observe(root);
  new IntersectionObserver(es => {
    active = es[es.length - 1].isIntersecting;
    wraps.forEach(w => w.classList.toggle('e-off', !active));
    if (active) { layout(); startLoop(); } else stopLoop();
  }, { rootMargin: '15% 0px' }).observe(root);
  new IntersectionObserver(es => { meterVis = es[es.length - 1].isIntersecting; }, { threshold: 0.15 }).observe(meter);
  if (sim) {
    new IntersectionObserver(es => {
      liveVis = es[es.length - 1].isIntersecting;
      if (liveVis) { sim.start(); renderBoard(); } else sim.stop();
    }, { rootMargin: '30% 0px' }).observe(secs[4]);
  }
  const STEP: Record<string, () => void> = {
    blok: () => { act('front', 'Copy!'); act('back', 'Print!'); },
    refund: () => { act('mid', 'Masukkan pouch'); act('back', 'Print!'); },
    admin: () => { act('front', 'Ambil hasil', true); act('mid', 'Ambil hasil', true); act('back', 'Ambil hasil', true); },
    sisi: () => { const a = slots.front.api; if (!a || RM) return; try { a.spin(true); setTimeout(() => a.spin(false), 4200); } catch { /* abaikan */ } },
  };
  const stepIO = new IntersectionObserver(es => es.forEach(e => {
    const fn = STEP[(e.target as HTMLElement).dataset.step || ''];
    if (e.isIntersecting && fn) fn();
  }), { threshold: 0.55 });
  $$('[data-step]').forEach(el => stepIO.observe(el));

  let rT = 0;
  const sched = () => { clearTimeout(rT); rT = window.setTimeout(layout, 120); };
  addEventListener('resize', sched);
  addEventListener('pageshow', sched);
  document.fonts?.ready.then(sched);
  document.fonts?.addEventListener?.('loadingdone', sched);
  if ('ResizeObserver' in window) {
    let lr = 0, lb = 0;
    const ro = new ResizeObserver(() => {
      const a = root.offsetHeight, b = document.body.offsetHeight;
      if (Math.abs(a - lr) > 1 || Math.abs(b - lb) > 1) { lr = a; lb = b; sched(); }
    });
    ro.observe(root); ro.observe(document.body);
  }
  layout();
}

/** Posisi scrollY absolut tiap sub-bagian E (1–7) untuk mode panggung. */
function stops(): number[] {
  if (!secs.length) return [];
  const y = scrollY;
  return secs.map(s => Math.max(0, Math.round(s.getBoundingClientRect().top + y))).sort((a, b) => a - b);
}

export const E: Bagian = { mount, stops };
