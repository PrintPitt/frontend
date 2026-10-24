// PrintPitt · pre-hero P (paling atas halaman).
// Kata raksasa PRINTPITT dengan bahasa gerak Kilat+ (irisan, celah, garis kecepatan, miring mengikuti kecepatan scroll),
// tiga figur Hans yang bergerak & bekerja sendiri, lalu "masuk arena": kamera menyelam ke lubang huruf P pertama
// sampai layar penuh warna arena D (#EEF3F6 + titik) → bagian D mulai tepat di bawahnya.
// Kata raksasa = teks biasa yang langsung tergambar (LCP); figur iframe baru dipasang setelah 'load' + ±1 dtk.
import './p.i18n'; // daftarkan kunci 'p.*' sebelum t() dipakai
import './p.css';
import type { Bagian, Ctx, FigApi, FigName } from '../ctx';
import { t } from '../i18n';

type K = 'front' | 'mid' | 'back';
interface Slot {
  k: K; fig: FigName; title: string; boot: string | null; seq: string[]; gap: number; ph: number; depth: number;
  el: HTMLElement; box: HTMLElement; trail: HTMLElement; hint: HTMLElement | null;
  S: number; x0: number; y0: number; tt: number; api: FigApi | null; mounting: boolean; press: boolean; si: number; next: number;
}
interface Line { el: HTMLElement; x: number; y: number; w: number; h: number; sp: number; y2: boolean }
interface Hole { x: number; y: number; r: number } // pusat & jari-jari lubang P, per em, relatif ke (awal huruf, baseline)

const Z0 = 0.28, Z1 = 0.9, PRE = 0.26; // progres: diam → [Z0..Z1] menyelam → bingkai arena bersih
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const sstep = (a: number, b: number, x: number) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const BOLT = '<svg class="p-bolt p-bolt-h" viewBox="0 0 1000 46" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 24 L180 24 L212 6 L236 38 L262 16 L520 16 L548 40 L570 10 L596 28 L1000 28"/></svg>';

let rootEl: HTMLElement | null = null;
let stickyEl: HTMLElement | null = null;

/** Cari lubang (counter) huruf P dengan menggambarnya di kanvas lalu flood-fill dari tepi. */
const holeCache: Record<string, Hole | null> = {};
function findHole(stretch: string, advEm: number): Hole | null {
  if (holeCache[stretch]) return holeCache[stretch];
  try {
    const S = 300, w = 480, h = 480, ox = 60, oy = 380;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true }) as (CanvasRenderingContext2D & { fontStretch?: string }) | null;
    if (!g) return null;
    g.font = `900 ${S}px Anybody`;
    if ('fontStretch' in g) (g as unknown as { fontStretch: string }).fontStretch = stretch;
    g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
    // kanvas harus memakai fon & lebar yang sama dengan DOM: cocokkan lebar huruf, kalau beda jangan dipakai (coba lagi nanti)
    if (Math.abs(g.measureText('P').width / S - advEm) / advEm > 0.03) return null;
    g.fillText('P', ox, oy);
    const d = g.getImageData(0, 0, w, h).data;
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) ink[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    const out = new Uint8Array(w * h), st: number[] = [];
    for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
    while (st.length) {
      const i = st.pop()!; if (out[i] || ink[i]) continue; out[i] = 1;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w);
    }
    let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let i = 0; i < w * h; i++) if (!ink[i] && !out[i]) { n++; const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (n < 40) return null;
    const r = 0.42 * Math.min(x1 - x0, y1 - y0);
    return (holeCache[stretch] = { x: ((x0 + x1) / 2 - ox) / S, y: ((y0 + y1) / 2 - oy) / S, r: r / S });
  } catch { return null; }
}

function mount(root: HTMLElement, c: Ctx): void {
  if (root.dataset.pMounted) return;
  root.dataset.pMounted = '1';
  rootEl = root;
  const RM = c.reduced;
  root.classList.add('P');

  const WORD = t('p.word'), CUT = Math.ceil(WORD.length / 2);
  const parts = [WORD.slice(0, CUT), WORD.slice(CUT)];
  const letter = (ch: string, first: boolean) =>
    `<span class="p-ch"><span class="p-b">${ch}${first ? '<i class="p-base"></i>' : ''}</span><span class="p-cut p-cut0">${ch}</span><span class="p-cut p-cut1">${ch}</span><span class="p-cut p-cut2">${ch}</span></span>`;
  const word = parts.map((ln, li) => `<span class="p-line">${Array.from(ln).map((ch, j) => letter(ch, li === 0 && j === 0)).join('')}</span>`).join('');
  const ghost = parts.map(ln => `<span class="p-line">${ln}</span>`).join('');
  const fw = (k: K) => `<div class="p-fw" data-k="${k}"><div class="p-trail" aria-hidden="true"><i></i><i></i><i></i></div><div class="p-fbox"></div>${k === 'front' ? '<span class="p-fhint" aria-hidden="true"></span>' : ''}</div>`;
  const flags = Array.from({ length: 15 }, (_, i) => { const x = 20 + i * 70, y = 22 + Math.sin(i / 14 * Math.PI) * 26; return `<path d="M${x - 16} ${y}L${x + 16} ${y + 2}L${x} ${y + 34}Z" fill="${i % 2 ? '#F4B829' : '#EF6A4C'}" stroke="#1C2430" stroke-width="3" stroke-linejoin="round"/>`; }).join('');

  root.innerHTML = `
<div class="p-sticky">
  <div class="p-layer p-lines" aria-hidden="true"></div>
  <div class="p-layer p-figs p-figs-back">${fw('back')}${fw('mid')}</div>
  <div class="p-layer p-arena" aria-hidden="true"></div>
  <div class="p-layer p-portal" aria-hidden="true"><svg viewBox="0 0 1060 90" preserveAspectRatio="none"><path d="M0 20 Q530 76 1060 20" fill="none" stroke="#1C2430" stroke-width="3"/>${flags}</svg><div class="p-floor"></div></div>
  <div class="p-center">
    <div class="p-word" aria-hidden="true"><span class="p-ghost">${ghost}</span><span class="p-letters">${word}</span><span class="p-slits"></span></div>
    <div class="p-under"><span class="p-block"><i></i><span>${t('p.block')}</span></span>${BOLT}</div>
    <p class="p-tag">${t('p.tag')}</p>
  </div>
  <div class="p-layer p-figs p-figs-front">${fw('front')}</div>
  <div class="p-cue" aria-hidden="true">${t('p.cue')}<i></i></div>
  <div class="p-layer p-cover" aria-hidden="true"></div>
</div>`;

  const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => r.querySelector(s) as T;
  const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => Array.from(r.querySelectorAll(s)) as T[];
  const sticky = $('.p-sticky'); stickyEl = sticky;
  const center = $('.p-center'), wordEl = $('.p-word'), ghostEl = $('.p-ghost'), slitsBox = $('.p-slits'), lettersEl = $('.p-letters');
  const under = $('.p-under'), tag = $('.p-tag'), cue = $('.p-cue'), probe = $('.p-base');
  const arena = $('.p-arena'), portal = $('.p-portal'), cover = $('.p-cover'), linesBox = $('.p-lines');
  const figBack = $('.p-figs-back'), figFront = $('.p-figs-front');
  const lineEls = $$('.p-line', lettersEl);
  const letters = $$('.p-ch', lettersEl).map(el => ({ el, s: $$('.p-cut', el) }));
  const NL = letters.length, MIDL = (NL - 1) / 2;

  /* ---------- garis kecepatan & celah ---------- */
  function makeLines(box: HTMLElement, n: number, cls: string, kinds: Record<number, string> = {}): Line[] {
    const out: Line[] = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = cls + (kinds[i] ? ' ' + kinds[i] : '');
      box.appendChild(el); out.push({ el, x: 0, y: 0, w: 0, h: 0, sp: 0, y2: kinds[i] === 'p-y' });
    }
    return out;
  }
  const hLines = makeLines(linesBox, 18, 'p-ln', { 3: 'p-a', 11: 'p-a', 7: 'p-y' });
  const slits = RM ? [] : makeLines(slitsBox, 6, 'p-slit');
  let GL: number[][] = letters.map(() => [0, 0, 0]), glitch = 0;
  const bolt = root.querySelector('.p-bolt-h path');
  if (bolt && !RM) { const ng = () => { GL = letters.map(() => [rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)]); glitch = 1; }; bolt.addEventListener('animationiteration', ng); bolt.addEventListener('animationstart', ng); }

  /* ---------- figur ---------- */
  const DEF: Record<K, [FigName, string, string | null, string[], number, number, number]> = {
    front: ['mesin-fotokopi', t('p.fig.fk'), null, ['Taruh dokumen', 'Copy!', 'Ambil hasil'], 3200, 0, 1],
    mid: ['laminator-a4', t('p.fig.lm'), 'Nyalakan', ['Masukkan pouch', 'Ambil hasil'], 4200, 2.1, 0.6],
    back: ['printer-inkjet', t('p.fig.pr'), 'Nyalakan', ['Print!', 'Ambil hasil'], 3600, 4.0, 0.35],
  };
  const KS: K[] = ['front', 'mid', 'back'];
  const slots = {} as Record<K, Slot>;
  KS.forEach(k => {
    const el = $(`.p-fw[data-k="${k}"]`), d = DEF[k];
    slots[k] = { k, fig: d[0], title: d[1], boot: d[2], seq: d[3], gap: d[4], ph: d[5], depth: d[6], el, box: $('.p-fbox', el), trail: $('.p-trail', el),
      hint: el.querySelector<HTMLElement>('.p-fhint'), S: 0, x0: 0, y0: 0, tt: 0, api: null, mounting: false, press: false, si: 0, next: 0 };
  });

  /* ---------- ukuran ---------- */
  let W = 1280, H = 800, mobile = c.isMobile(), fs = 200, rootH = 1, stretch = 'semi-expanded';
  let hx = 0, hy = 0, r0 = 10, sMax = 60, tx0 = 640, ty0 = 430; // pusat lubang P (panggung), jari-jari awal, skala akhir, titik tujuan kamera
  let figsOn = false, tries = 0;

  function fit() {
    // rasio lebar terukur untuk Anybody 900 / 112,5% (desktop: PRINT+PITT satu baris, HP: baris terlebar).
    // Sengaja konstan, tidak diukur ulang: kalau diukur saat font cadangan masih tampil, ukuran kata melompat
    // begitu Anybody masuk dan mendorong isi di bawahnya (CLS ±0,3 di HP).
    const R = mobile ? 3.68 : 6.39;
    const avail = center.clientWidth || W - 32;
    let f = avail / R * 0.995;
    // batas tinggi: 1 baris (desktop) ≤ ±42% tinggi di bawah bilah atas; 2 baris (HP) ≤ ±45%
    f = clamp(Math.min(f, (H - 60) * (mobile ? 0.26 : 0.5)), 36, 900);
    wordEl.style.fontSize = f.toFixed(1) + 'px';
    return f;
  }

  function figLayout() {
    const f = slots.front, m = slots.mid, b = slots.back;
    if (mobile) {
      f.S = Math.min(W * 0.62, H * 0.42); f.x0 = W * 0.98 - f.S; f.y0 = H - f.S * 0.9;
      m.S = 0;
      b.S = Math.min(W * 0.38, H * 0.24); b.x0 = W * 0.02; b.y0 = 60 + H * 0.01;
    } else {
      f.S = clamp(Math.min(W * 0.3, H * 0.56), 220, 600); f.x0 = W * 0.66; f.y0 = H - f.S * 0.92;
      m.S = Math.min(W * 0.18, H * 0.3); m.x0 = W * 0.62; m.y0 = 60 - m.S * 0.04;
      b.S = Math.min(W * 0.15, H * 0.27); b.x0 = W * 0.1; b.y0 = 60 + H * 0.01;
    }
    KS.forEach(k => { const s = slots[k]; s.el.style.display = s.S ? '' : 'none'; if (s.S) s.el.style.width = s.el.style.height = s.S.toFixed(0) + 'px'; });
  }

  function seedLines() {
    hLines.forEach(l => {
      l.w = l.y2 ? rnd(24, 60) : rnd(40, W * 0.36); l.y = rnd(H * 0.1, H * 0.97); l.x = rnd(-l.w, W);
      l.sp = rnd(70, 420) * (l.y2 ? 2.4 : 1);
      l.el.style.width = l.w.toFixed(0) + 'px'; l.el.style.top = l.y.toFixed(0) + 'px';
      l.el.style.transform = `translate3d(${l.x.toFixed(1)}px,0,0)`;
    });
    const kh = wordEl.offsetHeight;
    slits.forEach((l, i) => {
      l.w = W * rnd(0.05, 0.22); l.h = Math.max(2, fs * rnd(0.008, 0.024));
      l.y = kh * (0.12 + (i / slits.length) * 0.8 + rnd(-0.04, 0.04)); l.x = rnd(-l.w, W); l.sp = rnd(520, 1300);
      l.el.style.width = l.w.toFixed(0) + 'px'; l.el.style.height = l.h.toFixed(1) + 'px'; l.el.style.top = l.y.toFixed(0) + 'px';
      l.el.style.transform = `translate3d(${l.x.toFixed(1)}px,0,0)`;
    });
  }

  function measureHole() {
    center.style.transform = 'none';
    letters.forEach(L => (L.el.style.transform = 'none'));
    const sr = sticky.getBoundingClientRect(), cr = center.getBoundingClientRect();
    const l0 = letters[0].el.getBoundingClientRect(), base = probe.getBoundingClientRect().top;
    const fontOk = !document.fonts || document.fonts.check(`900 40px Anybody`);
    const hole = fontOk ? findHole(stretch, l0.width / fs) : null;
    const k: Hole = hole ?? { x: l0.width / fs * 0.5, y: -0.42, r: 0.05 };
    if (!hole && tries++ < 8) setTimeout(() => { if (!holeCache[stretch]) layout(); }, 700);
    hx = l0.left - sr.left + k.x * fs; hy = base - sr.top + k.y * fs;
    r0 = Math.max(3, k.r * fs);
    center.style.transformOrigin = `${(hx - (cr.left - sr.left)).toFixed(1)}px ${(hy - (cr.top - sr.top)).toFixed(1)}px`;
    // kamera ikut bergeser: lubang P dibawa ke tengah layar sambil membesar, jadi cukup menutup jarak tengah→sudut
    tx0 = W / 2; ty0 = 60 + (H - 60) / 2;
    sMax = 1.15 * Math.hypot(Math.max(tx0, W - tx0), Math.max(ty0, H - ty0)) / r0;
  }

  function layout() {
    W = sticky.clientWidth || innerWidth; H = sticky.clientHeight || innerHeight;
    mobile = c.isMobile(); stretch = mobile ? 'condensed' : 'semi-expanded';
    fs = fit();
    rootH = root.offsetHeight;
    figLayout();
    seedLines();
    measureHole();
    render(performance.now(), 0, true);
  }

  /* ---------- pasang figur: setelah load + ±1 dtk, saat senggang ---------- */
  function wire(s: Slot, api: FigApi) {
    const down = () => { s.press = true; if (s.hint) s.hint.textContent = t('p.held'); };
    const up = () => { if (!s.press) return; s.press = false; s.next = performance.now() + 2500; if (s.hint) s.hint.textContent = t('p.hint'); };
    const ts: EventTarget[] = [api.frame];
    try { if (api.doc) ts.push(api.doc); } catch { /* abaikan */ }
    ts.forEach(x => { x.addEventListener('pointerdown', down, true); x.addEventListener('pointerup', up, true); x.addEventListener('pointercancel', up, true); });
    addEventListener('pointerup', up);
  }
  function mountSlot(s: Slot) {
    if (s.api || s.mounting || !s.S) return;
    s.mounting = true;
    c.mountFig(s.box, s.fig, { interactive: true, palette: 'monad', title: s.title }).then(api => {
      s.api = api; wire(s, api);
      if (s.hint) { s.hint.textContent = t('p.hint'); s.hint.classList.add('p-on'); }
      if (s.boot) { try { api.act(s.boot); } catch { /* abaikan */ } }
      s.next = performance.now() + 900 + s.ph * 300;
    }).catch(() => { s.mounting = false; });
  }
  function mountFigs() {
    figsOn = true;
    const order: K[] = mobile ? ['front', 'back'] : ['front', 'back', 'mid']; // HP: maks 2 figur
    order.forEach((k, i) => setTimeout(() => mountSlot(slots[k]), i * 400));
  }
  const later = () => setTimeout(() => {
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(mountFigs, { timeout: 1500 }); else mountFigs();
  }, 1000);
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });

  /* ---------- gambar ---------- */
  const st = { ly: scrollY, v: 0, last: performance.now(), blur: -1, op: { arena: -1, portal: -1, cover: -1, ui: -1, lines: -1, figs: -1 } };
  const setOp = (el: HTMLElement, key: keyof typeof st.op, v: number) => { if (Math.abs(v - st.op[key]) > 0.004) { st.op[key] = v; el.style.opacity = v.toFixed(3); } };

  function render(now: number, dt: number, still = false) {
    const y = scrollY;
    const top = root.getBoundingClientRect().top + y;
    const run = Math.max(1, rootH - H);
    const p = clamp((y - top) / run, 0, 1);
    const u = clamp((p - Z0) / (Z1 - Z0), 0, 1);
    const v = still ? 0 : st.v, av = Math.abs(v);

    if (RM) { // gerak dikurangi: tanpa selam, cukup memudar ke warna arena
      setOp(cover, 'cover', sstep(Z0, Z1, p));
      setOp(under, 'ui', 1 - sstep(Z0, Z0 + 0.2, p)); tag.style.opacity = under.style.opacity; cue.style.opacity = under.style.opacity;
      KS.forEach(k => { const s = slots[k]; if (s.S) s.el.style.transform = `translate3d(${s.x0.toFixed(1)}px,${s.y0.toFixed(1)}px,0)`; });
      return;
    }

    const calm = 1 - sstep(0, 0.06, u); // efek kecepatan mereda saat menyelam supaya lubang P tetap di tempat
    // menyelam ke lubang P: skala eksponensial (kecepatan terasa tetap), pusat = lubang
    const s = Math.pow(sMax, Math.pow(u, 1.2));
    const pan = sstep(0, 0.55, u), px = (tx0 - hx) * pan, py = (ty0 - hy) * pan, cx = hx + px, cy = hy + py; // pusat lubang di layar
    center.style.transform = u > 0 ? `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) scale(${s.toFixed(4)})` : 'none';
    const ui = 1 - sstep(0, 0.12, u);
    setOp(under, 'ui', ui); tag.style.opacity = under.style.opacity;
    cue.style.opacity = (ui * (1 - sstep(0.02, 0.12, p))).toFixed(3);
    setOp(arena, 'arena', sstep(0.05, 0.5, u));
    const po = sstep(0.01, 0.1, u) * (1 - sstep(0.72, 0.9, u));
    setOp(portal, 'portal', po);
    if (po > 0) portal.style.clipPath = `circle(${(r0 * s).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
    setOp(cover, 'cover', sstep(0.86, 0.98, u));
    setOp(linesBox, 'lines', 1 - sstep(0, 0.3, u));

    // kata: miring/merenggang/blur mengikuti kecepatan scroll, irisan bergetar saat petir
    glitch *= Math.pow(0.002, dt / 1000); if (glitch < 0.002) glitch = 0;
    const vv = v * calm, avv = av * calm;
    const skew = clamp(-vv * 4.5, -16, 16), spread = Math.min(avv * 18, 70), gAmp = fs * 0.09 * glitch * calm;
    for (let i = 0; i < NL; i++) {
      const L = letters[i];
      const tx = (i - MIDL) * spread - vv * 10;
      L.el.style.transform = calm > 0.001 ? `translate3d(${tx.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)` : 'none';
      for (let j = 0; j < 3; j++) L.s[j].style.transform = `translate3d(${((j - 1) * vv * 14 * (1 + i * 0.1) + gAmp * GL[i][j]).toFixed(1)}px,0,0)`;
    }
    const b = Math.round(Math.min(Math.max(avv - 0.3, 0) * 0.8, 2.5) * 2) / 2;
    if (b !== st.blur) { st.blur = b; lettersEl.style.filter = b ? `blur(${b}px)` : 'none'; }
    ghostEl.style.opacity = (Math.min(avv * 0.22, 0.55)).toFixed(3);
    ghostEl.style.transform = `translate3d(${(-vv * 38).toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    slitsBox.style.opacity = u > 0.02 ? '0' : '1';
    const boost = 1 + av * 2.2, sec = dt / 1000, sc = (1 + av * 0.6).toFixed(3);
    hLines.forEach(l => { l.x -= l.sp * boost * sec; if (l.x < -l.w * 1.6) l.x = W + rnd(0, W * 0.3); l.el.style.transform = `translate3d(${l.x.toFixed(1)}px,0,0) scaleX(${sc})`; });
    slits.forEach(l => { l.x -= l.sp * boost * sec; if (l.x < -l.w) l.x = W + rnd(0, W * 0.5); l.el.style.transform = `translate3d(${l.x.toFixed(1)}px,0,0)`; });

    // figur: melayang, bergeser pelan, bekerja sendiri; saat menyelam terlempar keluar dan memudar
    const fo = 1 - sstep(0, 0.2, u);
    setOp(figBack, 'figs', fo); figFront.style.opacity = figBack.style.opacity;
    KS.forEach(k => {
      const sl = slots[k]; if (!sl.S) return;
      if (!sl.press) sl.tt += dt;
      const T = sl.tt;
      const dx = Math.sin(T * 0.00021 + sl.ph) * W * 0.025 + Math.sin(T * 0.00009 + sl.ph * 2) * W * 0.012;
      const dy = Math.sin(T * 0.0011 + sl.ph) * sl.S * 0.02 + Math.sin(T * 0.00037 + sl.ph) * sl.S * 0.03;
      let x = sl.x0 + dx, yy = sl.y0 + dy, sc2 = 1;
      if (u > 0) { const fx = x + sl.S / 2, fy = yy + sl.S / 2, f = u * 1.6; x += (fx - hx) * f; yy += (fy - hy) * f; sc2 = 1 + u * 1.4; }
      const tilt = clamp(v * 2.2, -7, 7) * sl.depth + Math.sin(T * 0.0007 + sl.ph) * 1.2;
      const sk = clamp(-v * 3.2, -9, 9) * sl.depth;
      sl.el.style.transform = `translate3d(${x.toFixed(1)}px,${yy.toFixed(1)}px,0) scale(${sc2.toFixed(3)}) rotate(${tilt.toFixed(2)}deg) skewX(${sk.toFixed(2)}deg)`;
      sl.trail.style.transform = `scaleX(${clamp(v * 0.32, -1.1, 1.1).toFixed(3)})`;
      sl.trail.style.opacity = Math.min(av * 0.5, 0.85).toFixed(3);
      // putaran aksi sendiri (berhenti saat ditahan atau saat sudah masuk arena)
      if (sl.api && !sl.press && u < 0.2 && now > sl.next) {
        try { sl.api.act(sl.seq[sl.si % sl.seq.length]); } catch { /* abaikan */ }
        sl.si++; sl.next = now + sl.gap + rnd(-300, 500);
      }
    });
  }

  /* ---------- satu loop rAF, berhenti saat P di luar layar ---------- */
  let raf = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    let dt = Math.min(now - st.last, 50); st.last = now; if (dt <= 0) dt = 16.7;
    const y = scrollY;
    const vi = clamp((y - st.ly) / dt, -8, 8); st.ly = y;
    st.v += (vi - st.v) * (1 - Math.pow(0.9, dt / 16.67)); if (Math.abs(st.v) < 0.002) st.v = 0;
    render(now, dt);
  }
  const start = () => { if (RM || raf) return; st.last = performance.now(); st.ly = scrollY; st.v = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(es => { if (es[es.length - 1].isIntersecting) start(); else stop(); }, { rootMargin: '10% 0px' }).observe(root);
  if (RM) addEventListener('scroll', () => render(performance.now(), 0, true), { passive: true });

  let rT = 0;
  const sched = () => { clearTimeout(rT); rT = window.setTimeout(() => { layout(); if (figsOn) mountFigs(); }, 120); };
  addEventListener('resize', sched);
  document.fonts?.ready.then(sched);
  document.fonts?.addEventListener?.('loadingdone', sched);
  layout(); // sinkron: kata raksasa sudah pas lebar sebelum gambar pertama
  if (import.meta.env.DEV) (window as unknown as { __p: unknown }).__p = () => ({ hx, hy, r0, sMax, fs, W, H, stretch, hole: holeCache[stretch], l0: letters[0].el.getBoundingClientRect().toJSON(), base: probe.getBoundingClientRect().top, ff: getComputedStyle(wordEl).fontStretch });
}

/** [awal P, bingkai tepat sebelum menyelam ke lubang P] */
function stops(): number[] {
  if (!rootEl || !stickyEl) return [];
  const top = rootEl.getBoundingClientRect().top + scrollY;
  const run = Math.max(0, rootEl.offsetHeight - (stickyEl.clientHeight || innerHeight));
  return [Math.round(top), Math.round(top + PRE * run)];
}

export const P: Bagian = { mount, stops };
