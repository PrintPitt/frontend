import QRCode from 'qrcode';
import { NAMA, URL_PESAN, URL_LAYAR, BUKTI, EXPLORER, HARGA_MON, BATAS_KERJA, BISNIS, MODE, URL_APP } from './config';
import { MockSim, fmtMon, upahSekarang } from './mock';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3); // easeOutCubic
const easeIO = (t: number) => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (x: number, d = 4) => x.toFixed(d).replace('.', ',');

/* ---------- teks & tautan dari config ---------- */
document.querySelectorAll('[data-nama]').forEach(e => (e.textContent = NAMA));
['heroCta', 'ctaBtn', 'topCta'].forEach(id => ($<HTMLAnchorElement>(id).href = URL_PESAN));
$<HTMLAnchorElement>('liveLink').href = URL_LAYAR;
$('fee').textContent = BISNIS.feeRuangan;
const isLive = MODE === 'LIVE';
if (isLive) {
  ['modeTag', 'liveTag'].forEach(id => { const t = $(id); t.textContent = 'LIVE · testnet'; t.classList.add('live'); });
  $('counterLabel').textContent = 'order di Monad testnet';
}

/* ---------- QR ---------- */
function drawQR() {
  const dark = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() === '#F1EFEA' ? '#0E0F12' : '#0E0F12';
  const abs = new URL(URL_PESAN, location.href).href;
  QRCode.toCanvas($('qrMini'), abs, { margin: 1, width: 176, color: { dark, light: '#FFFFFF' } }).catch(() => {});
  QRCode.toCanvas($('qrBig'), abs, { margin: 1, width: 600, color: { dark, light: '#FFFFFF' } }).catch(() => {});
}
drawQR();

/* ---------- palet ---------- */
const palBtn = $('palBtn');
function setPal(p: 'putih' | 'aspal') {
  document.documentElement.dataset.pal = p;
  palBtn.textContent = p === 'putih' ? 'Aspal' : 'Putih';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', p === 'putih' ? '#F4F5F6' : '#232220');
  try { localStorage.setItem('fk-pal', p); } catch {}
}
try { const p = localStorage.getItem('fk-pal'); if (p === 'aspal') setPal('aspal'); } catch {}
palBtn.addEventListener('click', () => setPal(document.documentElement.dataset.pal === 'aspal' ? 'putih' : 'aspal'));

/* ---------- figur Hans (interaktif, lazy) ---------- */
type FigApi = { act: (l: string) => boolean; palette: (p: string) => boolean; reset: () => void; spin: (on: boolean) => void };
declare global { interface Window { FIG?: { mount: (el: HTMLElement, name: string, o: Record<string, unknown>) => Promise<FigApi> } } }
let figLib: Promise<void> | null = null;
function loadFig() {
  if (!figLib) figLib = new Promise(res => { const s = document.createElement('script'); s.src = '/fig.js'; s.onload = () => res(); document.head.appendChild(s); });
  return figLib;
}
const figs: Record<string, FigApi | undefined> = {};
async function mountFig(el: HTMLElement) {
  if (el.dataset.mounted) return; el.dataset.mounted = '1';
  await loadFig();
  const api = await window.FIG!.mount(el, el.dataset.fig || 'mesin-fotokopi', { interactive: true, palette: 'monad', title: 'Mesin fotokopi' });
  figs[el.id] = api;
  document.querySelectorAll<HTMLButtonElement>(`.fig-acts[data-for="${el.id}"] button`).forEach(b => (b.disabled = false));
}
document.querySelectorAll<HTMLButtonElement>('.fig-acts button').forEach(b => {
  b.disabled = true;
  b.addEventListener('click', () => { const id = (b.parentElement as HTMLElement).dataset.for!; figs[id]?.act(b.dataset.act!); });
});
const idle = (fn: () => void) => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 600));
addEventListener('load', () => idle(() => mountFig($('figHero'))));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { mountFig(e.target as HTMLElement); io.unobserve(e.target); } }), { rootMargin: '120% 0px' });
document.querySelectorAll<HTMLElement>('[data-lazy]').forEach(el => io.observe(el));

/* ---------- tur 6 bab ---------- */
const BAB = [
  ['PESAN.', 'Pelanggan memesan dari HP, uangnya langsung ditahan kontrak.'],
  ['BRANKAS.', '0,02 MON masuk escrow, bukan ke toko, bukan ke kami.'],
  ['REBUTAN.', 'Dua toko berebut. Yang klaim duluan, Monad yang memutuskan dalam satu blok.'],
  ['KERJAKAN.', 'Fotokopi, print, laminating. Upah toko turun tiap detik.'],
  ['BAYAR.', 'Toko dibayar sesuai kecepatan. Sisanya balik otomatis ke pelanggan.'],
  ['CETAKANMU.', 'Pelanggan dapat NFT hasil cetakan, lengkap dengan namanya.'],
];
const tur = $('tur'), arena = $('arena'), babTitle = $('babTitle');
const OBJ = ['phone', 'vault', 'coin', 'ticket', 'shopA', 'shopB', 'klaim', 'blok', 'station', 'meter', 'result', 'nft'] as const;
type Obj = typeof OBJ[number];
const el = Object.fromEntries(OBJ.map(k => [k, $(k)])) as Record<Obj, HTMLElement>;
const size: Record<string, [number, number]> = {};
let W = 1, H = 1, K = 1, turTop = 0, turH = 1, VH = innerHeight;
function measure() {
  VH = innerHeight; W = arena.clientWidth; H = arena.clientHeight; K = clamp(Math.min(W / 640, H / 560), .55, 1.15);
  OBJ.forEach(k => (size[k] = [el[k].offsetWidth, el[k].offsetHeight]));
  const r = tur.getBoundingClientRect(); turTop = r.top + scrollY; turH = tur.offsetHeight;
}
// vis: 1 di pusat, turun linear ke 0 sejauh w
const vis = (s: number, c: number, w: number) => clamp(1 - Math.abs(s - c) / w);
// interpolasi titik antar bab: daftar [s, x, y, skala]
function path(s: number, pts: number[][]) {
  if (s <= pts[0][0]) return pts[0].slice(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (s <= b[0]) { const t = easeIO((s - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, j) => lerp(v, b[j + 1], t)); }
  }
  return pts[pts.length - 1].slice(1);
}
function place(k: Obj, x: number, y: number, sc: number, o: number, extra = '') {
  const [w, h] = size[k]; const e = el[k];
  e.style.opacity = o.toFixed(3);
  e.style.visibility = o < .01 ? 'hidden' : 'visible';
  e.style.transform = `translate3d(${(x * W - w / 2).toFixed(1)}px,${(y * H - h / 2).toFixed(1)}px,0) scale(${(sc * K).toFixed(3)})${extra}`;
}
let sTarget = 0, sNow = 0, gNow = 0, babShown = -1;
let tkAng = 0, tkVel = 0, tkPrevX = 0;
let stFlag = 0, vaultPulsed = false, lastSnap = 0;
function chapterS(g: number) {
  const i = Math.floor(clamp(g, 0, 5.999)), u = g - i;
  if (u < .3) return i === 0 ? 0 : (i - 1) + easeIO((.2 + u) / .5);
  if (u <= .8) return i;
  return i === 5 ? 5 : i + easeIO((u - .8) / .5);
}
function renderTur(s: number, g: number, dt: number) {
  // judul bab
  const bab = Math.round(clamp(s, 0, 5));
  if (bab !== babShown) {
    babShown = bab; babTitle.classList.add('swap');
    setTimeout(() => { $('babNo').textContent = `BAB 0${bab + 1} / 06`; $('babVerb').textContent = BAB[bab][0]; $('babLine').textContent = BAB[bab][1]; babTitle.classList.remove('swap'); }, 180);
    document.querySelectorAll('#rail button').forEach((b, i) => b.classList.toggle('on', i === bab));
  }
  // HP
  const ph = path(s, [[0, .3, .5, 1], [1, .2, .52, .92], [2, .1, .55, .8], [4, .16, .55, .85], [5, .24, .52, 1]]);
  place('phone', ph[0], ph[1], ph[2], Math.max(vis(s, .4, 1.6), vis(s, 5, 1.1)));
  // brankas
  const va = path(s, [[0, .74, .5, .85], [1, .6, .48, 1.08], [2, .5, .18, .62], [3, .82, .14, .5], [4, .5, .16, .66], [5, .5, .1, .5]]);
  place('vault', va[0], va[1], va[2], Math.max(vis(s, 1, 1.4) * 1, vis(s, 4, .9) * .8, .0));
  const vaultVal = s < 1 ? HARGA_MON * ease(clamp((s - .55) / .45)) : s < 4 ? HARGA_MON : HARGA_MON * (1 - ease(clamp((s - 3.5) / .5)));
  $('vaultV').textContent = fmt(vaultVal) + ' MON';
  if (s > .97 && s < 1.2 && !vaultPulsed) { vaultPulsed = true; el.vault.classList.remove('pulse'); void el.vault.offsetWidth; el.vault.classList.add('pulse'); }
  if (s < .6) vaultPulsed = false;
  // koin HP → brankas (busur)
  const ct = ease(clamp((s - .35) / .6));
  const cx = lerp(ph[0] + .02, va[0], ct), cy = lerp(ph[1] + .05, va[1], ct) - Math.sin(ct * Math.PI) * .22;
  place('coin', cx, cy, 1 + Math.sin(ct * Math.PI) * .25, vis(s, .6, .6) * (s < 1.05 ? 1 : 0), ` rotate(${(ct * 540).toFixed(0)}deg)`);
  // tiket keluar dari brankas → tengah arena → stasiun
  const tk = path(s, [[1.3, .6, .48, .5], [2, .5, .42, 1], [2.6, .5, .42, 1], [3, .3, .12, .62]]);
  const dx = (tk[0] - tkPrevX) * W; tkPrevX = tk[0];
  // pendulum: goyang dari kecepatan horizontal + ayunan diam kecil
  tkVel += (-tkAng * 70 - tkVel * 9 - dx * 22) * dt; tkAng += tkVel * dt;
  const sway = reduced ? 0 : tkAng + Math.sin(performance.now() / 900) * 1.6;
  place('ticket', tk[0], tk[1], tk[2], vis(s, 2.2, 1.0), ` rotate(${clamp(sway, -14, 14).toFixed(2)}deg)`);
  ($('tkBar') as HTMLElement).style.transform = `scaleX(${(1 - clamp((s - 1.6) / 1.6) * .7).toFixed(3)})`;
  ($('tkBar') as HTMLElement).style.transformOrigin = '0 50%';
  // dua toko + klaim
  const shopIn = ease(clamp((s - 1.5) / .5)) * (1 - ease(clamp((s - 2.55) / .4)));
  place('shopA', lerp(-.1, .2, shopIn), .76, 1, shopIn);
  place('shopB', lerp(1.1, .8, shopIn), .76, 1, shopIn);
  const won = s > 1.98;
  el.shopA.classList.toggle('win', won); $('shopATag').textContent = won ? 'klaim duluan ✓' : 'siap';
  $('shopBTag').textContent = won ? 'telat 1 blok' : 'siap';
  const kl = vis(s, 2.05, .3);
  place('klaim', .3, .6, .6 + kl * .45, kl, ` rotate(-6deg)`);
  place('blok', .5, .93, 1, vis(s, 2, .6));
  // stasiun kerja + meteran (waktu digulir oleh scroll di plateau bab 4)
  const tt = clamp((g - 3.25) / .55) * 15;
  const upah = upahSekarang(HARGA_MON, BATAS_KERJA, tt);
  const stv = vis(s, 3, .85);
  place('station', .3, .5, 1, stv);
  place('meter', .74, .5, 1, stv);
  $('meterV').textContent = fmt(upah);
  ($('meterBar') as HTMLElement).style.transform = `scaleX(${(upah / HARGA_MON).toFixed(4)})`;
  $('meterT').textContent = `t ${String(Math.round(tt)).padStart(2, '0')} / 45 dtk · balik ke Ratna ${fmt(HARGA_MON - upah)}`;
  $('st1').classList.toggle('done', tt > 7); $('st2').classList.toggle('done', tt >= 14.9);
  const fs = figs.figSt;
  if (fs) {
    if (stFlag === 0 && g > 3.2 && g < 3.9) { stFlag = 1; fs.act('Taruh dokumen'); setTimeout(() => fs.act('Copy!'), 500); }
    else if (stFlag === 1 && g > 3.85) { stFlag = 2; fs.act('Ambil hasil'); }
    else if (g < 3.0 || g > 4.4) stFlag = 0;
  }
  // hasil
  const rv = vis(s, 4, .8), fill = ease(clamp((s - 3.45) / .5));
  place('result', .58, .52, 1, rv);
  const finalUpah = upahSekarang(HARGA_MON, BATAS_KERJA, 15), finalRefund = HARGA_MON - finalUpah;
  ($('rBarA') as HTMLElement).style.width = (fill * finalUpah / HARGA_MON * 100).toFixed(1) + '%';
  ($('rBarB') as HTMLElement).style.width = (fill * finalRefund / HARGA_MON * 100).toFixed(1) + '%';
  $('rA').textContent = '+' + fmt(finalUpah * fill) + ' MON'; $('rB').textContent = '+' + fmt(finalRefund * fill) + ' MON';
  // NFT terbalik
  const nf = ease(clamp((s - 4.35) / .65));
  place('nft', lerp(.4, .66, nf), .5, lerp(.55, 1, nf), clamp((s - 4.3) / .3));
  ($('nft').firstElementChild as HTMLElement).style.transform = `rotateY(${((1 - nf) * -180).toFixed(1)}deg)`;
}

/* ---------- KILAT (hero) ---------- */
const kilat = $('kilatWord');
let lastY = scrollY, vel = 0, skew = 0;

/* ---------- loop ---------- */
let prev = performance.now();
function frame(now: number) {
  const dt = Math.min(.05, (now - prev) / 1000); prev = now;
  const y = scrollY;
  vel = lerp(vel, (y - lastY) / Math.max(dt, .001), .2); lastY = y;
  if (!reduced && y < VH * 1.2) {
    skew = lerp(skew, clamp(vel / 260, -4, 4), .1);
    kilat.style.transform = `translate3d(0,${(y * .25).toFixed(1)}px,0) skewX(${(-skew).toFixed(2)}deg)`;
  }
  if (!reduced) {
    const p = clamp((y - turTop) / Math.max(1, turH - VH));
    const g = p * 6;
    sTarget = chapterS(g);
    sNow = lerp(sNow, sTarget, 1 - Math.pow(.92, dt * 60)); // penghalus ±0,08/frame
    gNow = lerp(gNow, g, 1 - Math.pow(.88, dt * 60));
    if (y > turTop - VH && y < turTop + turH) renderTur(sNow, gNow, dt);
  }
  requestAnimationFrame(frame);
}
if (!reduced) { measure(); renderTur(0, 0, .016); }
addEventListener('resize', () => { measure(); drawQR(); });
document.fonts?.ready.then(measure);
requestAnimationFrame(frame);

/* rel bab: klik untuk lompat */
function babY(i: number) { return turTop + ((i + .55) / 6) * (turH - VH); }
document.querySelectorAll<HTMLButtonElement>('#rail button').forEach(b => b.addEventListener('click', () => scrollTo({ top: babY(+b.dataset.bab!), behavior: reduced ? 'auto' : 'smooth' })));

/* ---------- rumus interaktif ---------- */
const ruT = $<HTMLInputElement>('ruT');
function renderRumus() {
  const t = +ruT.value, up = upahSekarang(HARGA_MON, BATAS_KERJA, t), rf = HARGA_MON - up;
  $('ruTv').textContent = String(t); $('ruV').textContent = fmt(up);
  $('ruA').textContent = fmt(up); $('ruB').textContent = fmt(rf);
  $('ruBarA').style.width = (up / HARGA_MON * 100) + '%'; $('ruBarB').style.width = (rf / HARGA_MON * 100) + '%';
}
ruT.addEventListener('input', renderRumus); renderRumus();

/* ---------- live (simulasi sampai tersambung) ---------- */
const sim = new MockSim();
const colQ = $('colQueue'), colA = $('colA'), colB = $('colB'), ticker = $('ticker');
function cardHTML(o: import('./mock').Order, now: number) {
  if (o.status === 'Open') return `<div class="card" data-id="${o.id}"><div class="c-top"><span>#${o.id}</span><span>antre ${Math.max(0, Math.round(45 - (now - o.dibuat)))} dtk</span></div><div class="c-l">${o.label}</div><div class="c-t">${o.teks}</div></div>`;
  if (o.status === 'Claimed') { const up = upahSekarang(HARGA_MON, o.batasKerja, now - (o.diclaim || now));
    return `<div class="card" data-id="${o.id}"><div class="c-top"><span>#${o.id} · langkah ${o.langkahSelesai}/${o.langkah}</span><span>upah sekarang</span></div><div class="c-up" data-up="${o.id}">${fmt(up)}</div><div class="c-t">${o.label} · ${o.teks}</div></div>`; }
  if (o.status === 'Finished') return `<div class="card done" data-id="${o.id}"><div class="c-top"><span>#${o.id} · selesai ${o.kerja} dtk</span><span>✓</span></div><div class="c-l">+${fmt(o.upah || 0)} MON</div><div class="c-t">${fmt(o.refund || 0)} MON balik ke pelanggan · NFT terkirim</div></div>`;
  return `<div class="card exp" data-id="${o.id}"><div class="c-top"><span>#${o.id} · telat</span><span>refund</span></div><div class="c-l">${fmt(o.refund || HARGA_MON)} MON kembali penuh</div></div>`;
}
function renderLive() {
  const now = Date.now() / 1000, all = [...sim.orders.values()].sort((a, b) => b.id - a.id);
  const q = all.filter(o => o.status === 'Open');
  colQ.innerHTML = q.length ? q.map(o => cardHTML(o, now)).join('') : '<p class="empty">Belum ada pesanan. Scan QR!</p>';
  [colA, colB].forEach((col, i) => { const os = all.filter(o => o.toko === i && o.status !== 'Open').slice(0, 3); col.innerHTML = os.map(o => cardHTML(o, now)).join('') || '<p class="empty">Menunggu order…</p>'; });
  $('omzetA').textContent = fmtMon(sim.shops[0].omzet); $('omzetB').textContent = fmtMon(sim.shops[1].omzet);
  ticker.innerHTML = sim.txs.slice(0, 8).map(t => `<li>${t.kind} · #${t.id}</li>`).join('');
  $('counterN').textContent = String(sim.total);
}
let liveOn = false;
if (isLive && URL_APP) {
  // mode live: papan asli dari app tim (/layar) disisipkan di sini
  const papan = document.querySelector('.papan') as HTMLElement;
  papan.innerHTML = `<iframe src="${URL_LAYAR}?sisip=1" title="Papan live" style="grid-column:1/-1;width:100%;height:640px;border:1px solid var(--line);border-radius:18px;background:var(--panel)" loading="lazy"></iframe>`;
  ticker.remove();
} else {
  const lio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && !liveOn) { liveOn = true; sim.start(); } else if (!e.isIntersecting && liveOn) { liveOn = false; sim.stop(); }
  }), { rootMargin: '30% 0px' });
  lio.observe($('live'));
  sim.onChange(renderLive);
  sim.start(); setTimeout(() => { if (!liveOn) sim.stop(); }, 50); // isi penghitung hero sekali
  setInterval(() => { if (!liveOn) return; const now = Date.now() / 1000;
    document.querySelectorAll<HTMLElement>('[data-up]').forEach(e => { const o = sim.orders.get(+e.dataset.up!); if (o?.diclaim) e.textContent = fmt(upahSekarang(HARGA_MON, o.batasKerja, now - o.diclaim)); });
  }, 250);
}

/* ---------- bukti onchain ---------- */
const short = (a: string) => a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
$('bRepo').innerHTML = BUKTI.repo ? link(BUKTI.repo, BUKTI.repo.replace(/^https?:\/\//, '')) : '—';
$('bTest').innerHTML = BUKTI.kontrakTestnet ? link(`${EXPLORER.testnet}/address/${BUKTI.kontrakTestnet}`, short(BUKTI.kontrakTestnet)) + (BUKTI.verifiedTestnet ? '<span class="verified">VERIFIED</span>' : '') : '—';
$('bMain').innerHTML = BUKTI.kontrakMainnet ? link(`${EXPLORER.mainnet}/address/${BUKTI.kontrakMainnet}`, short(BUKTI.kontrakMainnet)) + (BUKTI.verifiedMainnet ? '<span class="verified">VERIFIED</span>' : '') : '—';
$('bLive').innerHTML = BUKTI.urlLive ? link(BUKTI.urlLive, BUKTI.urlLive.replace(/^https?:\/\//, '')) : link(location.origin, location.host);
$('bDeploy').textContent = BUKTI.deployment || '—';
$('bTx').innerHTML = BUKTI.kontrakTestnet ? link(`${EXPLORER.testnet}/address/${BUKTI.kontrakTestnet}`, 'lihat di explorer →') : '—';
$('footLinks').innerHTML = [BUKTI.repo && link(BUKTI.repo, 'Repo'), BUKTI.kontrakTestnet && link(`${EXPLORER.testnet}/address/${BUKTI.kontrakTestnet}`, 'Kontrak testnet')].filter(Boolean).join(' · ');

/* ---------- mode panggung: → ← Spasi PageDown PageUp ---------- */
function stops() {
  const ids = ['top', 'masalah'];
  const ys = ids.map(id => $(id).getBoundingClientRect().top + scrollY - (id === 'top' ? 0 : 70));
  if (!reduced) for (let i = 0; i < 6; i++) ys.push(babY(i)); else ys.push($('tur').getBoundingClientRect().top + scrollY - 70);
  ['rumus', 'live', 'kenapa', 'bisnis', 'bukti', 'pesan'].forEach(id => ys.push($(id).getBoundingClientRect().top + scrollY - 70));
  return ys.map(v => Math.max(0, Math.round(v))).sort((a, b) => a - b);
}
let helpShown = false;
addEventListener('keydown', e => {
  const tag = (e.target as HTMLElement).tagName;
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  const fwd = ['ArrowRight', 'PageDown', ' ', 'ArrowDown'].includes(e.key) && !(e.key === ' ' && e.shiftKey);
  const back = ['ArrowLeft', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
  if (!fwd && !back) return;
  if (e.key === 'ArrowDown' && !document.documentElement.classList.contains('panggung')) return; // panah bawah biasa tetap scroll biasa
  e.preventDefault();
  const ys = stops(), y = scrollY;
  const target = fwd ? ys.find(v => v > y + 8) ?? ys[ys.length - 1] : [...ys].reverse().find(v => v < y - 8) ?? 0;
  scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
  if (!helpShown) { helpShown = true; const h = $('stageHelp'); h.hidden = false; setTimeout(() => (h.hidden = true), 3200); }
});
// ?panggung=1 → huruf lebih besar untuk proyektor
if (new URLSearchParams(location.search).has('panggung')) document.documentElement.classList.add('panggung');
document.documentElement.classList.remove('no-js');
