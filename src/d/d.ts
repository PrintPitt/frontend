/* Bagian D — "Arena Toko+".
   Layar VS (Fotokopi Jaya vs Sinar Copy) lalu tur satu tiket: HP → brankas kontrak → arena → stasiun figur → papan hasil + kartu NFT.
   Satu dunia besar digerakkan kamera (translate + scale). Scroll dipetakan ke "waktu cerita" lewat PETA:
   tiap bab punya plateau diam, bagian yang dulu terasa kecepatan diberi ruang lebih. Angka di sini contoh alur, bukan data chain. */
import QRCode from 'qrcode';
import type { Bagian, Ctx, FigApi } from '../ctx';
import { t, lang } from '../i18n';
import './d.css';

type V2 = [number, number];
type Kunci = [number, number, number, number]; // waktu cerita, x, y, zoom
type Arena = { x: number; y: number; w: number; h: number };
type Stasiun = { x: number; y: number; s: number };
type Papan = { x: number; y: number; w: number };
interface Denah {
  W: number; H: number; view: V2;
  phone: { x: number; y: number }; vault: { x: number; y: number }; sg1: Papan;
  ar: Arena; pr: Stasiun; fk: Stasiun; lm: Stasiun;
  jStart: V2; sStart: V2; land: V2; jClaim: V2; sStop: V2; jFk: V2; jLm: V2; sPr: V2;
  sg2: Papan; sg3: Papan; board: Papan; track: string;
  cam: (A: Arena, B: { cx: number; cy: number; z: number }) => Kunci[];
}
type FigKey = 'fk' | 'pr' | 'lm';
type Pegas = { x: number; v: number };

/* ---------- peta scroll → waktu cerita ----------
   [awal, akhir, panjang dalam vh]. awal === akhir = plateau (diam). Total ±2× ruang scroll mockup. */
const PETA: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 4],          // layar VS
  [0, .10, 30],       // VS bubar, kamera turun ke HP
  [.10, .135, 8],
  [.135, .135, 22],   // BAB 1 · pesan dari HP
  [.135, .25, 34],    // bayar, koin terbang ke brankas
  [.25, .275, 8],
  [.275, .275, 22],   // brankas terkunci 0,02 MON
  [.275, .40, 40],    // tiket terbang ke arena
  [.40, .495, 36],    // dua toko berlari, KLAIM!
  [.495, .495, 22],   // BAB 2 · rebutan
  [.495, .64, 46],    // tiket ke Jaya, fotokopi + print mulai
  [.64, .64, 22],     // BAB 3 · kerjakan
  [.64, .75, 36],     // pindah ke laminator
  [.75, .75, 22],     // laminating
  [.75, .87, 42],     // stempel SELESAI, lembar terbang ke papan
  [.87, .915, 22],    // bintang + upah terhitung
  [.915, .915, 22],   // BAB 4 · selesai
  [.915, .98, 28],    // kartu dibalik
  [.98, 1, 8],
  [1, 1, 22],         // BAB 5 · cetakanmu
];
const TOTAL = PETA.reduce((a, g) => a + g[2], 0);
const PLATO: { s: number; mid: number }[] = [];
{
  let acc = 0;
  for (const [a, b, len] of PETA) { if (a === b && len > 0) PLATO.push({ s: a, mid: (acc + len / 2) / TOTAL }); acc += len; }
}
function keCerita(u: number): number {
  let x = clamp(u) * TOTAL;
  for (const [a, b, len] of PETA) {
    if (x <= len) return len > 0 ? a + (b - a) * (x / len) : b;
    x -= len;
  }
  return 1;
}
function platoTerdekat(u: number): number {
  let best = PLATO[0];
  for (const q of PLATO) if (Math.abs(q.mid - u) < Math.abs(best.mid - u)) best = q;
  return best.s;
}

/* ---------- alat kecil ---------- */
function clamp(v: number, a = 0, b = 1): number { return Math.max(a, Math.min(b, v)); }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const halus = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = (t: number) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const eout = (t: number) => 1 - Math.pow(1 - t, 3);
const lontar = (t: number) => 1 + 2 * Math.pow(t - 1, 3) + Math.pow(t - 1, 2); // back-out, overshoot kecil
const bez = (a: V2, c: V2, b: V2, t: number): V2 => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];
/* angka sesuai bahasa: EN "0.0133", ID "0,0133" */
const dec = (v: number, n: number) => { const s = v.toFixed(n); return lang === 'id' ? s.replace('.', ',') : s; };
const KERJA = 15; // detik kerja dalam cerita contoh
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
const pegas = (x: number): Pegas => ({ x, v: 0 });
/* pegas teredam: w = frekuensi (rad/dtk), z = rasio redam. z≈.85 → overshoot <1 % */
function langkahPegas(o: Pegas, target: number, dt: number, w: number, z: number): number {
  const acc = (target - o.x) * w * w - 2 * z * w * o.v;
  o.v += acc * dt; o.x += o.v * dt;
  if (Math.abs(o.x - target) < 1e-5 && Math.abs(o.v) < 1e-4) { o.x = target; o.v = 0; }
  return o.x;
}
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/* ---------- denah dunia: layar lebar & layar tegak ---------- */
const DATAR: Denah = {
  W: 5200, H: 1600, view: [1500, 860],
  phone: { x: 370, y: 470 }, vault: { x: 1300, y: 640 }, sg1: { x: 730, y: 560, w: 520 },
  ar: { x: 1800, y: 160, w: 1900, h: 1260 },
  pr: { x: 330, y: 380, s: 420 }, fk: { x: 950, y: 360, s: 560 }, lm: { x: 1570, y: 380, s: 420 },
  jStart: [300, 1080], sStart: [1600, 1080], land: [950, 990], jClaim: [860, 1080], sStop: [1085, 1085],
  jFk: [950, 860], jLm: [1570, 860], sPr: [330, 860],
  sg2: { x: 560, y: 1100, w: 780 }, sg3: { x: 1080, y: 660, w: 390 },
  board: { x: 3980, y: 330, w: 1100 },
  track: 'M690 1000C900 1090 1180 1080 1320 960M1640 880C1700 920 1750 950 1800 960',
  cam: (A, B) => [
    [0, A.x + 950, 790, .62], [.10, 900, 770, 1.0], [.15, 900, 770, 1.0], [.25, 1000, 790, .98], [.28, 1060, 780, .95],
    [.34, 1900, 640, .66], [.40, A.x + 950, A.y + 860, .92], [.48, A.x + 950, A.y + 850, 1.0], [.56, A.x + 1000, A.y + 660, 1.02],
    [.62, A.x + 1080, A.y + 560, 1.0], [.76, A.x + 1280, A.y + 560, 1.0], [.80, A.x + 1500, A.y + 600, .88],
    [.87, B.cx, B.cy, B.z], [1, B.cx, B.cy, B.z * 1.02],
  ],
};
const TEGAK: Denah = {
  W: 1000, H: 5400, view: [760, 1300],
  phone: { x: 350, y: 180 }, vault: { x: 330, y: 1030 }, sg1: { x: 110, y: 800, w: 780 },
  ar: { x: 0, y: 1520, w: 1000, h: 2040 },
  pr: { x: 210, y: 860, s: 360 }, fk: { x: 500, y: 380, s: 520 }, lm: { x: 790, y: 860, s: 360 },
  jStart: [180, 1780], sStart: [820, 1780], land: [500, 1660], jClaim: [420, 1780], sStop: [612, 1785],
  jFk: [500, 870], jLm: [790, 1270], sPr: [210, 1270],
  sg2: { x: 90, y: 1820, w: 820 }, sg3: { x: 90, y: 1290, w: 820 },
  board: { x: 60, y: 3720, w: 880 },
  track: 'M500 770L500 1020M500 1372L500 1520',
  cam: (A, B) => [
    [0, 500, A.y + 1000, .62], [.10, 500, 700, .92], [.15, 500, 720, .92], [.25, 500, 900, .92], [.28, 500, 960, .9],
    [.34, 500, 1800, .66], [.40, 500, A.y + 1520, .86], [.48, 500, A.y + 1560, .9], [.56, 500, A.y + 820, .86],
    [.62, 500, A.y + 820, .86], [.76, 500, A.y + 960, .86], [.80, 500, A.y + 1500, .74],
    [.87, B.cx, B.cy, B.z], [1, B.cx, B.cy, B.z * 1.02],
  ],
};

/* palet figur mengikuti tema halaman: putih → Arcade Pagi, aspal → Senja Arena */
const FIGPAL = { pagi: { fk: 'tomato', side: 'mustard' }, senja: { fk: 'mint', side: 'cobalt' } } as const;

/* ---------- gambar ---------- */
function tokohSVG(kind: 'j' | 's'): string {
  const J = kind === 'j';
  const topi = J
    ? '<path d="M46 72L100 14l54 58z" fill="#fff" stroke="var(--d-stroke)" stroke-width="6" stroke-linejoin="round"/><path d="M70 72l30-32 30 32" fill="none" stroke="var(--d-stroke)" stroke-width="3" opacity=".35"/><rect x="40" y="64" width="120" height="14" rx="7" fill="var(--d-a2)" stroke="var(--d-stroke)" stroke-width="5"/>'
    : '<path d="M44 76Q100 6 156 76z" fill="var(--d-stroke)"/><path d="M120 70h54q8 0 3 7l-6 7h-51z" fill="var(--d-stroke)"/><path d="M106 26l-18 26h13l-9 20 25-30h-13l9-16z" fill="var(--c)"/>';
  const kumis = J ? '<path d="M78 121q11-10 22 0q11-10 22 0q-6 10-22 4q-16 6-22-4z" fill="var(--d-stroke)"/>' : '';
  return '<div class="d-wob"><svg viewBox="0 0 200 240" aria-hidden="true">' +
    '<ellipse cx="100" cy="231" rx="62" ry="9" fill="var(--d-stroke)" opacity=".18"/>' +
    '<g class="d-legL"><rect x="68" y="176" width="26" height="52" rx="13" fill="var(--d-stroke)"/></g>' +
    '<g class="d-legR"><rect x="106" y="176" width="26" height="52" rx="13" fill="var(--d-stroke)"/></g>' +
    '<g class="d-armL"><rect x="16" y="118" width="30" height="64" rx="15" fill="var(--c)" stroke="var(--d-stroke)" stroke-width="6"/></g>' +
    '<g class="d-armR"><rect x="154" y="118" width="30" height="64" rx="15" fill="var(--c)" stroke="var(--d-stroke)" stroke-width="6"/></g>' +
    '<rect x="36" y="58" width="128" height="142" rx="58" fill="var(--c)" stroke="var(--d-stroke)" stroke-width="7"/>' +
    '<path d="M64 144h72v28q0 20-20 20h-32q-20 0-20-20z" fill="#fff" stroke="var(--d-stroke)" stroke-width="5"/>' +
    '<text x="100" y="181" text-anchor="middle" font-family="Lilita One,Arial Rounded MT Bold,sans-serif" font-size="28" fill="var(--d-stroke)">' + (J ? 'J' : 'S') + '</text>' +
    '<g class="d-eyes"><ellipse cx="80" cy="101" rx="13" ry="15" fill="#fff" stroke="var(--d-stroke)" stroke-width="4"/><ellipse cx="120" cy="101" rx="13" ry="15" fill="#fff" stroke="var(--d-stroke)" stroke-width="4"/><circle cx="83" cy="104" r="6.5" fill="var(--d-stroke)"/><circle cx="123" cy="104" r="6.5" fill="var(--d-stroke)"/></g>' +
    '<circle cx="62" cy="124" r="8" fill="#FF8FA3" opacity=".55"/><circle cx="138" cy="124" r="8" fill="#FF8FA3" opacity=".55"/>' +
    kumis +
    '<path class="d-mh" d="M86 131q14 16 28 0" fill="none" stroke="var(--d-stroke)" stroke-width="5" stroke-linecap="round"/>' +
    '<path class="d-ms" d="M88 140q12-11 24 0" fill="none" stroke="var(--d-stroke)" stroke-width="5" stroke-linecap="round"/>' +
    '<path class="d-sweat" d="M152 80q9 13 0 19q-9-6 0-19z" fill="#7FC8FF" stroke="var(--d-stroke)" stroke-width="3"/>' +
    topi + '</svg></div>';
}
const CENTANG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="var(--d-stroke)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const KERTAS = '<svg viewBox="0 0 90 116"><rect x="4" y="4" width="82" height="108" rx="8" fill="var(--d-paper)" stroke="var(--d-stroke)" stroke-width="5"/><rect x="16" y="20" width="44" height="8" rx="4" fill="var(--d-a1)"/><rect x="16" y="38" width="58" height="6" rx="3" fill="var(--d-stroke)" opacity=".18"/><rect x="16" y="52" width="50" height="6" rx="3" fill="var(--d-stroke)" opacity=".18"/><rect x="16" y="66" width="56" height="6" rx="3" fill="var(--d-stroke)" opacity=".18"/></svg>';
const konfeti = (warna: string) => '<svg viewBox="0 0 90 116"><path d="M14 70q16-30 32 0t32 0" fill="none" stroke="var(--d-stroke)" stroke-width="16" stroke-linecap="round"/><path d="M14 70q16-30 32 0t32 0" fill="none" stroke="' + warna + '" stroke-width="8" stroke-linecap="round"/></svg>';
const LAMINATOR_DIAM = '<svg class="d-fallback" viewBox="0 0 300 220" aria-hidden="true"><rect x="20" y="70" width="260" height="110" rx="34" fill="var(--d-panel)" stroke="var(--d-stroke)" stroke-width="8"/><rect x="60" y="96" width="180" height="14" rx="7" fill="var(--d-stroke)"/><circle cx="236" cy="148" r="12" fill="var(--d-ok)" stroke="var(--d-stroke)" stroke-width="5"/><rect x="88" y="18" width="124" height="86" rx="6" fill="var(--d-paper)" stroke="var(--d-stroke)" stroke-width="6"/><rect x="106" y="38" width="70" height="9" rx="4" fill="var(--d-a1)"/><rect x="106" y="56" width="86" height="7" rx="3" fill="var(--d-stroke)" opacity=".2"/></svg>';
const tf = (key: string, v: Record<string, string | number>) => t(key).replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k] ?? ''));
/* data-a = label figur persis (bahasa Indonesia, dipakai api.act); teks tombol = terjemahan */
const TOMBOL: Record<string, string> = {
  'Nyalakan': 'd.btn.on', 'Print!': 'd.btn.print', 'Ambil hasil': 'd.btn.take', 'Angkat tutup': 'd.btn.lid',
  'Taruh dokumen': 'd.btn.doc', 'Copy!': 'd.btn.copy', 'Masukkan pouch': 'd.btn.pouch',
};
const abtn = (k: FigKey, a: string, kelas = '') => `<button class="d-abtn${kelas ? ' ' + kelas : ''}" type="button" data-k="${k}" data-a="${a}">${t(TOMBOL[a])}</button>`;
const hint = () => `<div class="d-sthint">${t('d.st.hint')}</div>`;

function templat(c: Ctx): string {
  const N = esc(c.NAMA);
  const H2 = dec(c.HARGA_MON, 2);
  const SA = t('d.shop.a'), SB = t('d.shop.b'), NM = t('d.customer'), KIND = t('d.order.kind'), TTL = t('d.order.title');
  const at = (k: string) => esc(t(k)); // teks untuk atribut
  const hl = t('d.hero.hl'), head = t('shell.headline');
  // kata sorotan + tanda baca sesudahnya tidak boleh terpisah baris ("Blitz," bukan "Blitz" / ", More")
  const judul = head.includes(hl) ? head.replace(new RegExp(hl + '([,.!?]?)'), `<span class="d-nw"><span class="d-hl">${hl}</span>$1</span>`) : head;
  return `
<div class="d-stage" id="D-stage" role="region" aria-label="${at('d.aria.stage')}">
 <div class="d-sticky" id="D-sticky">
  <div class="d-far" id="D-far"></div>

  <div class="d-world" id="D-world">
    <svg class="d-track" id="D-track" aria-hidden="true"><path id="D-trackP" d=""/></svg>

    <div class="d-obj d-phone" id="D-phone" aria-hidden="true">
      <div class="d-ph-scr">
        <div class="d-ph-head"><span>${N}</span><i class="d-av">${NM.charAt(0)}</i></div>
        <div class="d-ph-slot"><span id="D-phSent">&nbsp;</span></div>
        <div class="d-ph-row"><span>${t('d.phone.total')}</span><b class="d-num">${H2} MON</b></div>
        <div class="d-ph-pay" id="D-phPay"><span class="d-t1">${t('d.phone.pay')}</span><span class="d-t2">${t('d.phone.paid')}</span></div>
        <div class="d-ph-note" id="D-phNote">${tf('d.phone.customer', { name: NM })}</div>
      </div>
    </div>

    <div class="d-obj d-vault" id="D-vault" aria-hidden="true">
      <svg viewBox="0 0 340 340">
        <rect x="26" y="322" width="54" height="16" rx="6" fill="var(--d-stroke)"/><rect x="260" y="322" width="54" height="16" rx="6" fill="var(--d-stroke)"/>
        <rect x="20" y="52" width="300" height="276" rx="36" fill="var(--d-panel)" stroke="var(--d-stroke)" stroke-width="8"/>
        <rect x="46" y="80" width="248" height="222" rx="22" fill="var(--d-bg2)" stroke="var(--d-stroke)" stroke-width="6"/>
        <rect x="120" y="58" width="100" height="14" rx="7" fill="var(--d-stroke)"/>
        <g id="D-vDial" class="d-dial">
          <circle cx="124" cy="232" r="44" fill="var(--d-panel)" stroke="var(--d-stroke)" stroke-width="6"/>
          <circle cx="124" cy="232" r="14" fill="var(--d-a1)" stroke="var(--d-stroke)" stroke-width="5"/>
          <path d="M124 192v14M124 258v14M84 232h14M150 232h14" stroke="var(--d-stroke)" stroke-width="5" stroke-linecap="round"/>
        </g>
        <rect x="200" y="206" width="70" height="52" rx="14" fill="var(--d-a2)" stroke="var(--d-stroke)" stroke-width="6"/>
        <rect x="68" y="-4" width="204" height="48" rx="14" fill="var(--d-a2)" stroke="var(--d-stroke)" stroke-width="6"/>
        <text x="170" y="31" text-anchor="middle" font-family="Lilita One,Arial Rounded MT Bold,sans-serif" font-size="28" fill="var(--d-onA2)">${t('d.vault.label')}</text>
      </svg>
      <div class="d-vlcd d-num" id="D-vLcd">${dec(0, 2)} MON</div>
    </div>

    <div class="d-obj d-coin" id="D-coin" aria-hidden="true"><svg viewBox="0 0 80 80"><use href="#D-coinSym"/></svg></div>

    <div class="d-sign" id="D-sg1"><h3><span class="d-n">1</span>${t('d.step.1')}</h3><p>${t('d.sign.1')}</p></div>

    <div class="d-obj d-arena" id="D-arena">
      <div class="d-floor"></div>
      <div class="d-rim"></div>
      <svg class="d-bunting" id="D-bunting" aria-hidden="true"></svg>
      <div class="d-st" id="D-stPr"><div class="d-mat"></div><div class="d-fg" id="D-fgPr"></div><div class="d-stl">${t('d.st.print')}</div>
        <div class="d-stact" role="group" aria-label="${at('d.st.aria.pr')}">${abtn('pr', 'Nyalakan')}${abtn('pr', 'Print!', 'd-hot')}${abtn('pr', 'Ambil hasil')}</div>${hint()}
      </div>
      <div class="d-st" id="D-stFk"><div class="d-mat"></div><div class="d-fg" id="D-fgFk"></div><div class="d-stl">${t('d.st.copy')}</div>
        <div class="d-stact" role="group" aria-label="${at('d.st.aria.fk')}">${abtn('fk', 'Angkat tutup')}${abtn('fk', 'Taruh dokumen')}${abtn('fk', 'Copy!', 'd-hot')}${abtn('fk', 'Ambil hasil')}</div>${hint()}
      </div>
      <div class="d-st" id="D-stLm"><div class="d-mat"></div><div class="d-fg" id="D-fgLm"></div><div class="d-stl">${t('d.st.lam')}</div>
        <div class="d-stact" role="group" aria-label="${at('d.st.aria.lm')}">${abtn('lm', 'Nyalakan')}${abtn('lm', 'Masukkan pouch', 'd-warm')}${abtn('lm', 'Ambil hasil')}</div>${hint()}
      </div>
      <div class="d-sign d-tilt" id="D-sg2"><h3><span class="d-n">2</span>${t('d.step.2')}</h3><p>${t('d.sign.2')}</p></div>
      <div class="d-sign" id="D-sg3"><h3><span class="d-n">3</span>${t('d.step.3')}</h3><p>${t('d.sign.3')}</p>
        <div class="d-chips3"><span class="d-chk" id="D-ck1"><i>${CENTANG}</i>${t('d.st.copy')}</span><span class="d-chk" id="D-ck2"><i>${CENTANG}</i>${t('d.st.lam')}</span></div>
      </div>
      <div class="d-chr" id="D-cJ" style="--c:var(--d-a1)" aria-hidden="true">${tokohSVG('j')}</div>
      <div class="d-chr" id="D-cS" style="--c:var(--d-a2)" aria-hidden="true">${tokohSVG('s')}</div>
      <div class="d-burst" id="D-burst" aria-hidden="true">
        <svg class="d-rays" viewBox="-100 -100 200 200"><g id="D-raysG"></g></svg>
        <div><b>${t('d.claim')}</b><small>${t('d.claim.sub')}</small></div>
      </div>
      <div class="d-bubble" id="D-late" aria-hidden="true">${t('d.late')}</div>
    </div>

    <div class="d-obj d-board" id="D-board">
      <div class="d-rib">${t('d.board.rib')}</div>
      <span class="d-contoh">${t('d.board.sample')}</span>
      <div class="d-bl">
        <div class="d-stars" id="D-stars"></div>
        <div class="d-btime">${tf('d.board.time', { t: dec(KERJA, 1), max: c.BATAS_KERJA })}</div>
        <div class="d-pay d-r1"><svg class="d-cn" viewBox="0 0 80 80"><use href="#D-coinSym"/></svg><b class="d-num" id="D-pv1">+${dec(0, 4)} MON</b><span>${tf('d.board.toShop', { shop: SA })}</span></div>
        <div class="d-pay d-r2"><svg class="d-cn" viewBox="0 0 80 80"><use href="#D-coinSym"/></svg><b class="d-num" id="D-pv2">+${dec(0, 4)} MON</b><span>${tf('d.board.refund', { name: NM })}</span></div>
        <p class="d-cap"><span class="d-n">4</span><span><b>${t('d.step.4')}</b>${t('d.cap.4')}</span></p>
      </div>
      <div class="d-br">
        <div class="d-card" id="D-card"><div class="d-card-in" id="D-cardIn">
          <div class="d-face d-fb"><span class="d-lg">${N}</span><span class="d-q">?</span><span class="d-k d-num">${t('d.card.back')}</span></div>
          <div class="d-face d-ff">
            <div class="d-fftop"><span>${t('d.card.nft')}</span><span>${t('d.card.chain')}</span></div>
            <div class="d-pg"><div class="d-kind">${KIND}</div><h4>${TTL}</h4><div class="d-ln"></div><div class="d-ln" style="width:82%"></div><div class="d-ln" style="width:64%"></div></div>
            <div class="d-who">${t('d.card.for')}<b>${NM}</b>${tf('d.card.meta', { shop: SA, t: dec(KERJA, 1) })}</div>
            <div class="d-holo"></div>
          </div>
        </div></div>
        <p class="d-cap"><span class="d-n">5</span><span><b>${t('d.step.5')}</b>${t('d.cap.5')}</span></p>
      </div>
    </div>

    <div class="d-obj d-sheet" id="D-sheet" aria-hidden="true"><i></i><i></i><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i></div>
  </div>

  <div class="d-near" id="D-near" aria-hidden="true"></div>
  <div class="d-veil" id="D-veil"></div>

  <div class="d-hero" id="D-hero">
    <div class="d-hcopy" id="D-hcopy">
      <h1>${judul}</h1>
      <p class="d-sub">${t('shell.sub')}</p>
      <p class="d-subline">${t('shell.subline')}</p>
      <div class="d-hact">
        <a class="d-gbtn" id="D-cta" href="${esc(c.URL_PESAN)}" target="_blank" rel="noopener">${t('shell.cta')}</a>
        <span class="d-qr"><canvas id="D-qr" width="144" height="144" role="img" aria-label="${at('d.hero.qrAria')}"></canvas><span>${t('d.hero.qr')}</span></span>
        <span class="d-cue"><svg viewBox="0 0 26 26" aria-hidden="true"><rect x="7" y="2" width="12" height="20" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M13 7v4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>${t('d.hero.cue')}</span>
      </div>
    </div>
    <div class="d-vs" id="D-vs" aria-hidden="true">
      <div class="d-side d-l" id="D-vsL"><div class="d-bgp"></div><div class="d-chr" style="--c:var(--d-a1)">${tokohSVG('j')}</div><div class="d-plate">${SA}</div></div>
      <div class="d-vmid"><div class="d-tkslot" id="D-tkSlot"></div><div class="d-vsword" id="D-vsWord"><svg class="d-burstv" viewBox="-100 -100 200 200"><path id="D-vsBurst" fill="var(--d-a1)" stroke="var(--d-stroke)" stroke-width="4" stroke-linejoin="round"/></svg>VS</div></div>
      <div class="d-side d-r" id="D-vsR"><div class="d-bgp"></div><div class="d-chr" style="--c:var(--d-a2)">${tokohSVG('s')}</div><div class="d-plate">${SB}</div></div>
      <div class="d-rdslot" id="D-rdSlot"></div>
    </div>
  </div>

  <div class="d-round" id="D-round" aria-hidden="true">
    <div class="d-rd-top"><span id="D-rdLbl">${t('d.round.pay')}</span><span class="d-rd-t d-num"><svg viewBox="0 0 20 20"><circle cx="10" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M10 7v4.5l2.6 1.6M8 1.8h4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg><span id="D-rdT">${dec(c.BATAS_KERJA, 1)} ${t('d.unit.s')}</span></span></div>
    <div class="d-rd-bar"><i id="D-rdFill"></i></div>
    <div class="d-rd-num d-num" id="D-rdNum">${dec(c.HARGA_MON, 4)}<small>MON</small></div>
    <div class="d-rd-ref">${tf('d.round.ref', { name: NM })} <b class="d-num" id="D-rdRef">${dec(0, 4)}</b> MON</div>
  </div>

  <div class="d-ticket" id="D-ticket" aria-hidden="true"><div class="d-tkin" id="D-tkIn">
    <div class="d-tk-pat"><i id="D-tkPat"></i></div>
    <div class="d-tk-head"><span class="d-num">#0042</span><span class="d-num">${H2} MON</span></div>
    <div class="d-tk-item"><svg viewBox="0 0 66 62"><rect x="10" y="6" width="46" height="52" rx="6" fill="var(--d-a1)" stroke="var(--d-stroke)" stroke-width="4"/><rect x="10" y="6" width="11" height="52" rx="4" fill="var(--d-stroke)"/><rect x="27" y="16" width="22" height="6" rx="3" fill="var(--d-paper)"/><rect x="27" y="27" width="16" height="4" rx="2" fill="var(--d-paper)" opacity=".8"/></svg></div>
    <div class="d-tk-name">${KIND}</div>
    <div class="d-tk-txt">“${TTL}”</div>
    <div class="d-tk-rec"><span><svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="10" rx="2" fill="var(--d-panel)" stroke="var(--d-stroke)" stroke-width="2.4"/><path d="M5 9l2-4h10l2 4" fill="none" stroke="var(--d-stroke)" stroke-width="2.4" stroke-linejoin="round"/><rect x="7" y="13" width="10" height="2.4" fill="var(--d-stroke)"/></svg></span>+<span><svg viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="9" rx="4" fill="var(--d-panel)" stroke="var(--d-stroke)" stroke-width="2.4"/><path d="M6 12.5h12" stroke="var(--d-stroke)" stroke-width="2.4" stroke-linecap="round"/><rect x="7" y="3" width="10" height="5" fill="var(--d-paper)" stroke="var(--d-stroke)" stroke-width="2"/></svg></span></div>
    <div class="d-tk-who">${NM}</div>
    <div class="d-tk-stamp" id="D-tkStamp">${t('d.ticket.done')}</div>
  </div></div>

  <div class="d-top" id="D-top">
    <nav class="d-steps" id="D-steps" aria-label="${at('d.steps.aria')}">
      <div class="d-seg"><i></i><b>1</b><span>${t('d.step.1')}</span></div>
      <div class="d-seg"><i></i><b>2</b><span>${t('d.step.2')}</span></div>
      <div class="d-seg"><i></i><b>3</b><span>${t('d.step.3')}</span></div>
      <div class="d-seg"><i></i><b>4</b><span>${t('d.step.4')}</span></div>
      <div class="d-seg"><i></i><b>5</b><span>${t('d.step.5')}</span></div>
    </nav>
  </div>
 </div>
</div>
<svg class="d-defs" width="0" height="0" aria-hidden="true"><defs>
  <symbol id="D-coinSym" viewBox="0 0 80 80">
    <circle cx="40" cy="44" r="33" fill="var(--d-stroke)"/>
    <circle cx="40" cy="38" r="33" fill="var(--d-a2)" stroke="var(--d-stroke)" stroke-width="5"/>
    <circle cx="40" cy="38" r="22" fill="none" stroke="var(--d-stroke)" stroke-width="3.5" opacity=".55"/>
    <text x="40" y="46" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="900" font-size="20" fill="var(--d-onA2)">MON</text>
  </symbol>
  <symbol id="D-starSym" viewBox="0 0 100 100"><path d="M50 5l13.6 27.6 30.4 4.4-22 21.5 5.2 30.3L50 74.5 22.8 88.8 28 58.5 6 37l30.4-4.4z" stroke-linejoin="round"/></symbol>
</defs></svg>`;
}

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;700;800;900&display=swap';
function muatFont(sesudah: () => void): void {
  let l = document.querySelector<HTMLLinkElement>(`link[href="${FONT_URL}"]`);
  if (!l) {
    l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_URL;
    document.head.appendChild(l);
  }
  const ok = () => {
    if (!document.fonts) return sesudah();
    Promise.all([document.fonts.load('400 40px "Lilita One"'), document.fonts.load('800 20px Nunito')]).then(sesudah, sesudah);
  };
  if (l.sheet) ok(); else l.addEventListener('load', ok, { once: true });
}

/* tinggi header tetap milik halaman (di luar bagian D), supaya bilah langkah D tidak tertutup */
function tinggiHeader(root: HTMLElement): number {
  let h = 0;
  document.querySelectorAll<HTMLElement>('body > header, header.top').forEach(el => {
    if (root.contains(el)) return;
    const cs = getComputedStyle(el);
    if ((cs.position !== 'fixed' && cs.position !== 'sticky') || cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.top <= 1 && r.height > 0 && r.height < innerHeight * .3) h = Math.max(h, r.bottom);
  });
  return Math.round(h);
}

/* ---------- state modul (untuk stops) ---------- */
let stageRef: HTMLElement | null = null;
let stickyRef: HTMLElement | null = null;

function pasang(root: HTMLElement, c: Ctx): void {
  root.classList.add('D');
  root.style.setProperty('--d-len', String(TOTAL));
  root.innerHTML = templat(c);

  const $ = <T extends Element = HTMLElement>(id: string): T => {
    const e = root.querySelector<T>('#D-' + id);
    if (!e) throw new Error('Bagian D: #D-' + id + ' tidak ada');
    return e;
  };
  const stage = $('stage'), sticky = $('sticky'), world = $('world');
  stageRef = stage; stickyRef = sticky;
  const els = {
    far: $('far'), track: $<SVGSVGElement>('track'), trackP: $<SVGPathElement>('trackP'),
    phone: $('phone'), vault: $('vault'), coin: $('coin'), sg1: $('sg1'), arena: $('arena'),
    stPr: $('stPr'), stFk: $('stFk'), stLm: $('stLm'), sg2: $('sg2'), sg3: $('sg3'),
    cJ: $('cJ'), cS: $('cS'), burst: $('burst'), late: $('late'), board: $('board'), sheet: $('sheet'),
    card: $('card'), cardIn: $('cardIn'), bunting: $<SVGSVGElement>('bunting'),
    hero: $('hero'), hcopy: $('hcopy'), vsL: $('vsL'), vsR: $('vsR'), vsWord: $('vsWord'), veil: $('veil'),
    ticket: $('ticket'), tkIn: $('tkIn'), tkPat: $('tkPat'), tkStamp: $('tkStamp'),
    round: $('round'), rdNum: $('rdNum'), rdRef: $('rdRef'), rdT: $('rdT'), rdFill: $('rdFill'), rdLbl: $('rdLbl'),
    tkSlot: $('tkSlot'), rdSlot: $('rdSlot'), top: $('top'),
    phPay: $('phPay'), phNote: $('phNote'), phSent: $('phSent'), vLcd: $('vLcd'), vDial: $<SVGGElement>('vDial'),
    pv1: $('pv1'), pv2: $('pv2'), ck1: $('ck1'), ck2: $('ck2'), near: $('near'), stars: $('stars'),
  };
  const segs = Array.from(root.querySelectorAll<HTMLElement>('.d-seg'));
  const segFill = segs.map(s => s.querySelector('i') as HTMLElement);
  const rdNumText = els.rdNum.firstChild as Text;

  const R = c.reduced;
  const small = c.isMobile(); // diputuskan sekali: di HP maksimal 2 figur aktif
  const HARGA = c.HARGA_MON, BATAS = c.BATAS_KERJA;
  const upah = (dt: number) => Math.max(0, HARGA * (BATAS - dt) / BATAS);
  /* teks runtime, diambil sekali dari kamus */
  const NM = t('d.customer'), unitS = ' ' + t('d.unit.s');
  const TX = {
    held: t('d.phone.held'), cust: tf('d.phone.customer', { name: NM }), sent: t('d.phone.sent'),
    pay: t('d.round.pay'), late: t('d.round.late'), payShop: tf('d.round.payShop', { shop: t('d.shop.a') }),
    done: tf('d.round.done', { t: dec(KERJA, 1) }), tick: '−' + dec(.0001, 4),
  };

  /* ---------- hiasan statis ---------- */
  {
    let d = '';
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, r = i % 2 ? 62 : 96;
      d += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1);
    }
    $<SVGPathElement>('vsBurst').setAttribute('d', d + 'Z');
    let g = '';
    for (let i = 0; i < 12; i++) {
      const a0 = i / 12 * Math.PI * 2, a1 = a0 + Math.PI / 24;
      g += '<path d="M0 0L' + (Math.cos(a0) * 140).toFixed(1) + ' ' + (Math.sin(a0) * 140).toFixed(1) + 'L' + (Math.cos(a1) * 140).toFixed(1) + ' ' + (Math.sin(a1) * 140).toFixed(1) + 'Z" fill="var(--d-a1)" opacity="' + (i % 2 ? .35 : .7) + '"/>';
    }
    $<SVGGElement>('raysG').innerHTML = g;
  }
  els.stars.innerHTML = [0, 1, 2].map(() => '<svg class="d-star" viewBox="0 0 100 100"><use href="#D-starSym" fill="var(--d-bg2)" stroke="var(--d-stroke)" stroke-width="7"/><g class="d-sf"><use href="#D-starSym" fill="var(--d-a2)" stroke="var(--d-stroke)" stroke-width="7"/></g></svg>').join('');
  const starF = Array.from(els.stars.querySelectorAll<SVGGElement>('.d-sf'));

  /* lapisan dekat: kertas melayang + konfeti, paralaks lebih cepat dari dunia */
  const NZ: { el: HTMLElement; x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'd-nz';
    d.innerHTML = '<div class="d-fl">' + (i % 3 === 2 ? konfeti(i % 2 ? 'var(--d-a2)' : 'var(--d-a1)') : KERTAS) + '</div>';
    els.near.appendChild(d);
    NZ.push({ el: d, x: 0, y: 0, s: .7 + (i % 4) * .14 });
  }

  /* ---------- QR kecil di layar VS (disembunyikan di HP lewat CSS) ---------- */
  try {
    const abs = new URL(c.URL_PESAN, location.href).href;
    QRCode.toCanvas($<HTMLCanvasElement>('qr'), abs, { margin: 1, width: 144, color: { dark: '#1C2430', light: '#FFFFFF' } }).catch(() => {});
  } catch { /* QR opsional */ }

  /* ---------- tema ---------- */
  const tema = (): 'pagi' | 'senja' => (document.documentElement.dataset.pal === 'aspal' ? 'senja' : 'pagi');
  const F: Partial<Record<FigKey, FigApi>> = {};
  function figPal(): void {
    const P = FIGPAL[tema()];
    try { F.fk?.palette(P.fk); } catch { /* figur belum siap */ }
    try { F.pr?.palette(P.side); } catch { /* */ }
    try { F.lm?.palette(P.side); } catch { /* */ }
  }
  function terapkanTema(): void { root.classList.toggle('d-senja', tema() === 'senja'); figPal(); }
  terapkanTema();
  new MutationObserver(terapkanTema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-pal'] });

  /* ---------- figur (lazy) ---------- */
  const nanti = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
  const act = (k: FigKey, label: string): boolean => { const a = F[k]; if (!a) return false; try { return a.act(label); } catch { return false; } };
  let dokTerpasang = false, nCopy = 0;
  function fkCopy(): void {
    if (!F.fk) return;
    if (!dokTerpasang) { act('fk', 'Taruh dokumen'); dokTerpasang = true; nanti(1500, () => act('fk', 'Copy!')); }
    else act('fk', 'Copy!');
    nCopy++;
    nanti(6500, () => act('fk', 'Ambil hasil'));
    if (nCopy % 9 === 0) nanti(9000, () => act('fk', 'Isi kertas'));
  }
  function prPrint(): void { if (!F.pr) return; act('pr', 'Print!'); nanti(9000, () => act('pr', 'Ambil hasil')); }
  function lmFeed(): void { if (!F.lm) return; act('lm', 'Masukkan pouch'); nanti(7000, () => act('lm', 'Ambil hasil')); nanti(11000, () => act('lm', 'Ambil hasil')); }

  if (small) {
    $('fgLm').innerHTML = LAMINATOR_DIAM;
    els.stLm.querySelectorAll<HTMLElement>('.d-stact, .d-sthint').forEach(e => { e.style.display = 'none'; });
  }
  let figMulai = false, figAntre = false;
  function pasangFigur(): void {
    if (figMulai) return;
    figMulai = true;
    const P0 = FIGPAL[tema()];
    c.mountFig($('fgFk'), 'mesin-fotokopi', { interactive: true, title: t('d.fig.fk'), palette: P0.fk }).then(api => { F.fk = api; figPal(); });
    nanti(350, () => {
      c.mountFig($('fgPr'), 'printer-inkjet', { interactive: true, title: t('d.fig.pr'), palette: P0.side }).then(api => {
        F.pr = api; figPal();
        act('pr', 'Nyalakan');
        nanti(2600, () => act('pr', 'Colok flashdisk'));
        nanti(4200, () => act('pr', 'skripsi_FINAL'));
      });
    });
    if (!small) {
      nanti(700, () => {
        c.mountFig($('fgLm'), 'laminator-a4', { interactive: true, title: t('d.fig.lm'), palette: P0.side }).then(api => { F.lm = api; figPal(); act('lm', 'Nyalakan'); });
      });
    }
  }
  /* figur berat: dipasang setelah halaman tenang (load + idle) atau langsung saat pengguna berinteraksi di bagian D */
  function antreFigur(): void {
    if (figMulai || figAntre) return;
    figAntre = true;
    const go = () => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(pasangFigur, { timeout: 1500 });
      else window.setTimeout(pasangFigur, 400);
    };
    if (document.readyState === 'complete') window.setTimeout(go, 600);
    else addEventListener('load', () => window.setTimeout(go, 600), { once: true });
  }
  const sentuhPertama = () => { if (terlihat) pasangFigur(); };
  (['pointerdown', 'wheel', 'touchstart', 'keydown'] as const).forEach(ev => addEventListener(ev, sentuhPertama, { once: true, passive: true }));

  /* tombol aksi gaya game per stasiun → api.act(label) persis label figur */
  function tekan(k: FigKey, a: string): void {
    if (a === 'Copy!') fkCopy();
    else if (a === 'Print!') prPrint();
    else if (a === 'Masukkan pouch') lmFeed();
    else if (a === 'Taruh dokumen') { act(k, a); dokTerpasang = true; }
    else act(k, a);
  }
  root.querySelectorAll<HTMLButtonElement>('.d-abtn').forEach(b => {
    b.addEventListener('click', () => {
      const k = b.dataset.k as FigKey, a = b.dataset.a ?? '';
      if (!F[k]) { pasangFigur(); return; }
      tekan(k, a);
      if (!R) b.animate([{ transform: 'scale(.9) translateY(2px)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
  });

  /* pemicu otomatis saat scroll melewati titik cerita (aksi sama dengan tombol) */
  const PICU: { at: number; fn: () => void; siap: boolean }[] = [
    { at: .565, fn: () => { if (dokTerpasang) act('fk', 'Angkat tutup'); else if (F.fk) { act('fk', 'Taruh dokumen'); dokTerpasang = true; } }, siap: true },
    { at: .61, fn: () => { if (act('fk', 'Copy!')) nanti(6500, () => act('fk', 'Ambil hasil')); }, siap: true },
    { at: .625, fn: prPrint, siap: true },
    { at: .725, fn: lmFeed, siap: true },
  ];

  /* ---------- tata letak ---------- */
  let L: Denah = DATAR, por = false, vw = 1, vh = 1, s0 = 1, topH = 64, cyS = 0, K: Kunci[] = [];
  let hdr = 0, perluTata = true;
  const G = { A: DATAR.ar, phoneSpot: [0, 0] as V2, coin0: [0, 0] as V2, coin1: [0, 0] as V2, landW: [0, 0] as V2, boardSpot: [0, 0] as V2, cardC: [0, 0] as V2, cardW: 360, lmOut: [0, 0] as V2 };
  const HERO = { tk: [0, 0] as V2, tkScale: 1, rd: [0, 0] as V2, rdScale: 1, rdH: 200, rdDock: [0, 0] as V2, rdDockScale: .7, tkDock: [0, 0] as V2, tkDockScale: .7 };

  function taruh(el: HTMLElement, x: number, y: number, w?: number, h?: number): void {
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (w != null) el.style.width = w + 'px';
    if (h != null) el.style.height = h + 'px';
  }
  function posDalam(el: HTMLElement, anc: HTMLElement): V2 {
    let x = 0, y = 0;
    let e: HTMLElement | null = el;
    while (e && e !== anc) {
      const op = e.offsetParent as HTMLElement | null;
      x += e.offsetLeft + (op ? op.clientLeft : 0); y += e.offsetTop + (op ? op.clientTop : 0);
      e = op;
    }
    return [x, y];
  }

  function tata(): void {
    perluTata = false;
    vw = sticky.clientWidth || innerWidth; vh = sticky.clientHeight || innerHeight;
    por = vw / vh < .9;
    L = por ? TEGAK : DATAR;
    const mob = vw < 700;
    hdr = tinggiHeader(root);
    const barH = hdr > 0 ? (mob ? 48 : 56) : (mob ? 56 : 64);
    topH = hdr + barH;
    root.classList.toggle('d-hashdr', hdr > 0);
    root.style.setProperty('--d-hdr', hdr + 'px');
    root.style.setProperty('--d-barH', barH + 'px');
    root.style.setProperty('--d-heroTop', (hdr > 0 ? hdr : barH) + 'px');
    cyS = topH + (vh - topH) / 2;
    s0 = Math.min(vw / L.view[0], (vh - topH * .5) / L.view[1]);
    world.classList.toggle('d-por', por);
    world.style.width = L.W + 'px'; world.style.height = L.H + 'px';
    els.track.setAttribute('width', String(L.W)); els.track.setAttribute('height', String(L.H));
    els.trackP.setAttribute('d', L.track);

    taruh(els.phone, L.phone.x, L.phone.y);
    taruh(els.vault, L.vault.x, L.vault.y);
    taruh(els.sg1, L.sg1.x, L.sg1.y, L.sg1.w);
    const A = L.ar;
    taruh(els.arena, A.x, A.y, A.w, A.h);
    ([[els.stPr, L.pr], [els.stFk, L.fk], [els.stLm, L.lm]] as const).forEach(([e, s]) => {
      taruh(e, s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
      e.style.zIndex = String(Math.round(s.y + s.s * .3));
    });
    taruh(els.sg2, L.sg2.x, L.sg2.y, L.sg2.w);
    taruh(els.sg3, L.sg3.x, L.sg3.y, L.sg3.w);
    els.sg2.style.zIndex = '1'; els.sg3.style.zIndex = '1';
    taruh(els.board, L.board.x, L.board.y, L.board.w);

    /* umbul-umbul di atas arena */
    let bp = '', bendera = '';
    const n = Math.round(A.w / 70);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = t * A.w, y = 40 + Math.sin(t * Math.PI) * 60;
      bp += (k ? 'L' : 'M') + x.toFixed(0) + ' ' + y.toFixed(0);
      if (k < n && k > 0) bendera += '<path d="M' + (x - 20).toFixed(0) + ' ' + (y - 2).toFixed(0) + 'h40l-20 40z" fill="' + (k % 2 ? 'var(--d-a1)' : 'var(--d-a2)') + '" stroke="var(--d-stroke)" stroke-width="5" stroke-linejoin="round"/>';
    }
    els.bunting.setAttribute('width', String(A.w)); els.bunting.setAttribute('height', '200');
    els.bunting.innerHTML = '<path d="' + bp + '" fill="none" stroke="var(--d-stroke)" stroke-width="6"/>' + bendera;

    /* geometri dunia */
    const bh = els.board.offsetHeight, bw = L.board.w;
    G.A = A;
    G.phoneSpot = [L.phone.x + 150, L.phone.y + 44 + 100 + 66];
    G.coin0 = [L.phone.x + 236, L.phone.y + 424];
    G.coin1 = [L.vault.x + 170, L.vault.y + 66];
    G.landW = [A.x + L.land[0], A.y + L.land[1]];
    G.boardSpot = [L.board.x + bw - 40, L.board.y + 40];
    const co = posDalam(els.card, world);
    G.cardC = [co[0] + els.card.offsetWidth / 2, co[1] + els.card.offsetHeight / 2];
    G.cardW = els.card.offsetWidth || 360;
    G.lmOut = [A.x + L.lm.x, A.y + L.lm.y + 20];
    const zfit = Math.min(.98, (vh - topH - 70) / (s0 * (bh + 60)), (vw - 40) / (s0 * (bw + 40)));
    K = L.cam(A, { cx: L.board.x + bw / 2, cy: L.board.y + bh / 2 - 10, z: zfit });

    /* jangkar lapisan dekat di sekitar titik kamera */
    const vwW = L.view[0], vhW = L.view[1];
    const jangkar = [1, 3, 5, 6, 8, 10, 11, 12];
    NZ.forEach((nz, i) => {
      const k = K[jangkar[i % jangkar.length]];
      const sisi = i % 2 ? 1 : -1;
      nz.x = k[1] + sisi * vwW * (por ? .44 : .5) / k[3];
      nz.y = k[2] + ((i >> 1) % 2 ? .36 : -.3) * vhW / k[3];
    });

    /* target overlay layar VS (koordinat relatif sticky) */
    const sr = sticky.getBoundingClientRect();
    const tr = els.tkSlot.getBoundingClientRect();
    HERO.tkScale = (tr.width || 160) / 200;
    els.tkSlot.style.height = (262 * HERO.tkScale) + 'px';
    const tr2 = els.tkSlot.getBoundingClientRect();
    HERO.tk = [tr2.left - sr.left + tr2.width / 2, tr2.top - sr.top + tr2.height / 2];
    const rh = els.round.offsetHeight || 200;
    HERO.rdH = rh;
    const rr = els.rdSlot.getBoundingClientRect();
    HERO.rdScale = (rr.width || 400) / 400;
    els.rdSlot.style.height = (rh * HERO.rdScale) + 'px';
    const rr2 = els.rdSlot.getBoundingClientRect();
    HERO.rd = [rr2.left - sr.left + rr2.width / 2, rr2.top - sr.top + rr2.height / 2];
    const g = mob ? 16 : 24;
    const dockW = mob ? 168 : 290;
    HERO.rdDockScale = dockW / 400;
    HERO.rdDock = [vw - g - dockW / 2, topH + 10 + rh * HERO.rdDockScale / 2];
    HERO.tkDockScale = mob ? .42 : .7;
    HERO.tkDock = [g + 100 * HERO.tkDockScale + 6, topH + 14 + 131 * HERO.tkDockScale];
    kotor = true;
  }

  /* ---------- kamera: Catmull-Rom melewati titik kunci ---------- */
  function kamera(s: number): { x: number; y: number; z: number } {
    const n = K.length;
    if (s <= K[0][0]) return { x: K[0][1], y: K[0][2], z: K[0][3] };
    if (s >= K[n - 1][0]) return { x: K[n - 1][1], y: K[n - 1][2], z: K[n - 1][3] };
    let i = 0;
    while (i < n - 2 && s > K[i + 1][0]) i++;
    const P0 = K[Math.max(i - 1, 0)], P1 = K[i], P2 = K[i + 1], P3 = K[Math.min(i + 2, n - 1)];
    const t = (s - P1[0]) / (P2[0] - P1[0]);
    return {
      x: catmull(P0[1], P1[1], P2[1], P3[1], t),
      y: catmull(P0[2], P1[2], P2[2], P3[2], t),
      z: Math.max(.3, catmull(P0[3], P1[3], P2[3], P3[3], t)),
    };
  }
  /* lintasan tokoh: [waktu, x, y] dalam koordinat arena */
  type Jejak = { x: number; y: number; mv: boolean; dx: number };
  function lintas(s: number, pts: [number, number, number][]): Jejak {
    if (s <= pts[0][0]) return { x: pts[0][1], y: pts[0][2], mv: false, dx: 0 };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (s <= b[0]) {
        if (a[1] === b[1] && a[2] === b[2]) return { x: a[1], y: a[2], mv: false, dx: 0 };
        const u = eio((s - a[0]) / (b[0] - a[0]));
        return { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u), mv: u > 0 && u < 1, dx: b[1] - a[1] };
      }
    }
    const z = pts[pts.length - 1];
    return { x: z[1], y: z[2], mv: false, dx: 0 };
  }
  const P = (s: number, xy: V2): [number, number, number] => [s, xy[0], xy[1]];

  /* ---------- state ---------- */
  let p = 0, sp = 0, s = 0, sTuju = 0, sLalu = -1, kotor = true, tLalu = performance.now();
  const t0 = performance.now();
  let upahLalu = '', popLalu = 0, detikLalu = -1, jatuhLalu = 0, picuLalu = 0;
  let dtNow = 0.016, tkX = 0, ambLalu = performance.now(), amb = 0, cekHdrLalu = 0;
  const condongJ = pegas(0), condongS = pegas(0);
  const ayun = { a: 0, v: 0, lx: NaN }; // bandul tiket
  const SU = pegas(HARGA), SRf = pegas(0), STt = pegas(BATAS);

  function bacaP(): void {
    const r = stage.getBoundingClientRect();
    const max = stage.offsetHeight - vh;
    p = max > 0 ? clamp(-r.top / max) : 0;
  }

  function jatuh(txt: string): void {
    const d = document.createElement('span');
    d.className = 'd-drop d-num'; d.dataset.t = txt; d.setAttribute('aria-hidden', 'true'); // angka hias: teks lewat ::before supaya tidak dibaca sebagai teks halaman
    els.round.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }
  /* angka upah/refund/waktu ditween lewat pegas: tidak pernah lompat, settle lembut + "pop" saat berubah */
  function setRonde(t: number, label: string, now: number, live: boolean): void {
    const u = upah(t), rf = HARGA - u, pt = 1 - t / BATAS;
    if (R) { SU.x = u; SRf.x = rf; STt.x = BATAS - t; }
    else {
      const dts = Math.min(.05, Math.max(.001, dtNow));
      langkahPegas(SU, u, dts, 12, .85); langkahPegas(SRf, rf, dts, 12, .85); langkahPegas(STt, BATAS - t, dts, 12, .85);
    }
    const txt = dec(SU.x, 4);
    if (txt !== upahLalu) {
      rdNumText.nodeValue = txt;
      els.rdRef.textContent = dec(SRf.x, 4);
      if (!R && now - popLalu > 110) {
        els.rdNum.animate([{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 230, easing: 'cubic-bezier(.2,1.7,.4,1)' });
        popLalu = now;
      }
      if (!live && !R && now - jatuhLalu > 380 && upahLalu && parseFloat(txt.replace(',', '.')) < parseFloat(upahLalu.replace(',', '.'))) {
        jatuh(TX.tick); jatuhLalu = now;
      }
      upahLalu = txt;
    }
    els.rdT.textContent = dec(Math.max(0, STt.x), 1) + unitS;
    els.rdFill.style.transform = 'scaleX(' + pt.toFixed(4) + ')';
    const warna = pt > .6 ? 'var(--d-ok)' : pt > .3 ? 'var(--d-a2)' : 'var(--d-bad)';
    els.rdFill.style.backgroundColor = warna;
    els.tkPat.style.transform = 'scaleX(' + pt.toFixed(4) + ')';
    els.tkPat.style.backgroundColor = warna;
    if (els.rdLbl.textContent !== label) els.rdLbl.textContent = label;
  }

  const LANGKAH: V2[] = [[.06, .27], [.27, .52], [.52, .80], [.80, .91], [.91, .99]];
  const TURUN = '−' + dec(HARGA / BATAS, 4);

  function gambar(now: number): void {
    const h = 1 - halus(0, .1, s);

    /* panel ronde: loop hidup di layar VS, digerakkan scroll selama tur */
    if (h > .5) {
      const el = ((now - t0) / 1000) % (BATAS + 5);
      const t = Math.min(el, BATAS);
      setRonde(t, el > BATAS ? TX.late : TX.pay, now, true);
      const det = Math.floor(el);
      if (!R && det !== detikLalu && el < BATAS) { detikLalu = det; if (det > 0) jatuh(TURUN); }
    } else {
      const tj = KERJA * clamp((s - .46) / (.80 - .46));
      setRonde(tj, s > .80 ? TX.done : s > .46 ? TX.payShop : TX.pay, now, false);
    }
    const berat = kotor || Math.abs(s - sLalu) > 1e-6;
    if (!berat) return;
    sLalu = s; kotor = false;

    /* kamera */
    const cam = kamera(s);
    const S = s0 * cam.z;
    const tx = vw / 2 - cam.x * S, ty = cyS - cam.y * S;
    world.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + S.toFixed(5) + ')';
    const proj = (x: number, y: number): V2 => [x * S + tx, y * S + ty];
    els.far.style.backgroundPosition = (-cam.x * S * .32).toFixed(1) + 'px ' + (-cam.y * S * .32).toFixed(1) + 'px';

    /* lapisan dekat */
    const NF = 1.35;
    for (const nz of NZ) {
      const x = vw / 2 + (nz.x - cam.x) * S * NF, y = cyS + (nz.y - cam.y) * S * NF;
      if (x < -200 || x > vw + 200 || y < -200 || y > vh + 200) { nz.el.style.visibility = 'hidden'; continue; }
      const sc = S * NF * nz.s * (por ? 1.2 : 1);
      nz.el.style.visibility = 'visible';
      nz.el.style.transform = 'translate(' + (x - 45).toFixed(1) + 'px,' + (y - 58).toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')';
    }

    /* layar VS bubar */
    const e = halus(0, .09, s);
    els.veil.style.opacity = (1 - e).toFixed(3);
    els.hcopy.style.transform = 'translateY(' + (-e * 34).toFixed(2) + 'vh)';
    els.hcopy.style.opacity = clamp(1 - e * 1.4).toFixed(3);
    els.vsL.style.transform = 'translateX(' + (-e * 70).toFixed(2) + 'vw) rotate(' + (-e * 14).toFixed(2) + 'deg)';
    els.vsR.style.transform = 'translateX(' + (e * 70).toFixed(2) + 'vw) rotate(' + (e * 14).toFixed(2) + 'deg)';
    els.vsWord.style.transform = 'rotate(-6deg) scale(' + (1 + e * 2.4).toFixed(3) + ')';
    els.vsWord.style.opacity = clamp(1 - e * 1.6).toFixed(3);
    els.hero.style.visibility = e > .985 ? 'hidden' : 'visible';
    /* kalau halaman punya header tetap, bilah langkah D baru muncul setelah layar VS bubar */
    const tb = hdr > 0 ? halus(.04, .09, s) : 1;
    els.top.style.opacity = tb.toFixed(3);
    els.top.style.visibility = tb > .01 ? 'visible' : 'hidden';

    /* HP, koin, brankas */
    els.phPay.classList.toggle('d-paid', s > .17);
    els.phNote.textContent = s > .17 ? TX.held : TX.cust;
    els.phSent.textContent = s > .3 ? TX.sent : ' ';
    const cu = halus(.15, .25, s);
    const cc: V2 = por ? [G.coin0[0] + 330, (G.coin0[1] + G.coin1[1]) / 2] : [(G.coin0[0] + G.coin1[0]) / 2, Math.min(G.coin0[1], G.coin1[1]) - 330];
    const cp = bez(G.coin0, cc, G.coin1, cu);
    const flip = Math.max(.18, Math.abs(Math.cos(cu * Math.PI * 5)));
    const gem = 1 + .35 * Math.sin(cu * Math.PI);
    els.coin.style.transform = 'translate(' + (cp[0] - 37).toFixed(1) + 'px,' + (cp[1] - 37).toFixed(1) + 'px) scale(' + (flip * gem).toFixed(3) + ',' + gem.toFixed(3) + ')';
    els.coin.style.opacity = s > .252 ? '0' : '1';
    els.vLcd.textContent = dec(s > .248 ? HARGA : 0, 2) + ' MON';
    els.vDial.style.transform = 'rotate(' + (halus(.2, .27, s) * 540).toFixed(1) + 'deg)';
    const vb = Math.sin(clamp((s - .245) / .03) * Math.PI);
    els.vault.style.transform = 'scale(' + (1 + .06 * vb).toFixed(3) + ',' + (1 - .04 * vb).toFixed(3) + ')';

    /* tokoh */
    const A = G.A;
    const gerak = Math.abs(sTuju - s) > .0006;
    const jt = lintas(s, [P(0, L.jStart), P(.36, L.jStart), P(.46, L.jClaim), P(.50, L.jClaim), P(.56, L.jFk), P(.69, L.jFk), P(.72, L.jLm), P(1, L.jLm)]);
    const st = lintas(s, [P(0, L.sStart), P(.37, L.sStart), P(.48, L.sStop), P(.55, L.sStop), P(.62, L.sPr), P(1, L.sPr)]);
    const lompat = Math.sin(clamp((s - .46) / .04) * Math.PI) * 70;
    const jy = jt.y - lompat;
    const taruhTokoh = (el: HTMLElement, cj: Jejak, y: number, condong: number, sp2: Pegas) => {
      const lari = cj.mv && gerak;
      el.classList.toggle('d-run', lari);
      const arah = cj.dx < 0 ? -1 : 1;
      langkahPegas(sp2, lari ? arah * condong : 0, Math.min(.05, Math.max(.001, dtNow)), 10, .78);
      el.style.transform = 'translate(' + (cj.x - 90).toFixed(1) + 'px,' + (y - 220).toFixed(1) + 'px) rotate(' + sp2.x.toFixed(2) + 'deg)';
      el.style.zIndex = String(Math.round(cj.y));
    };
    taruhTokoh(els.cJ, jt, jy, 9, condongJ);
    taruhTokoh(els.cS, st, st.y, 7, condongS);
    els.cJ.classList.toggle('d-work', (s > .565 && s < .69) || (s > .725 && s < .80));
    els.cS.classList.toggle('d-work', s > .625);
    els.cS.classList.toggle('d-sad', s > .475 && s < .63);
    if (Math.abs(condongJ.x) > 1e-3 || Math.abs(condongS.x) > 1e-3) kotor = true; // biarkan pegas condong selesai

    /* KLAIM! + gelembung telat */
    const bIn = halus(.455, .475, s), bOut = 1 - halus(.55, .585, s);
    const bk = bIn * bOut;
    els.burst.style.opacity = bk.toFixed(3);
    els.burst.style.visibility = bk > .01 ? 'visible' : 'hidden';
    els.burst.style.transform = 'translate(' + (L.land[0] - 220) + 'px,' + (L.land[1] - 360) + 'px) scale(' + (.3 + .7 * lontar(bIn)).toFixed(3) + ')';
    const lk = halus(.48, .495, s) * (1 - halus(.56, .58, s));
    els.late.style.opacity = lk.toFixed(3);
    els.late.style.visibility = lk > .01 ? 'visible' : 'hidden';
    // gelembung di kanan-atas kepala toko S, supaya tidak menutupi label "Monad decides" di bawah KLAIM!
    const lx = st.x + (por ? 175 : 170), ly = st.y - (por ? 40 : 200);
    els.late.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px) translate(-50%,-100%) scale(' + (.5 + .5 * lk).toFixed(3) + ')';
    // papan bab 3 baru muncul saat kerja dimulai (sebelumnya bertumpuk dengan ledakan KLAIM!)
    const g3 = halus(.55, .62, s);
    els.sg3.style.opacity = g3.toFixed(3);
    els.sg3.style.visibility = g3 > .01 ? 'visible' : 'hidden';
    // papan bab 2 mundur setelah bab 3, supaya tidak mengintip di balik bilah langkah di akhir tur
    const g2 = 1 - halus(.66, .72, s);
    els.sg2.style.opacity = g2.toFixed(3);
    els.sg2.style.visibility = g2 > .01 ? 'visible' : 'hidden';
    els.ck1.classList.toggle('d-on', s > .665);
    els.ck2.classList.toggle('d-on', s > .785);

    /* tiket: slot VS → HP → terbang → lantai → Jaya → dok HUD → papan */
    let wx: number, wy: number, w: number, r: number;
    const ps = G.phoneSpot;
    if (s < .25) { wx = ps[0]; wy = ps[1]; w = 190; r = 0; }
    else if (s < .28) { const u = halus(.25, .28, s); wx = ps[0]; wy = ps[1] - 40 * u; w = 190 + 20 * u; r = -8 * u; }
    else if (s < .40) {
      const u = eio((s - .28) / .12);
      const a: V2 = [ps[0], ps[1] - 40], b = G.landW;
      const cc2: V2 = por ? [a[0] + 460, (a[1] + b[1]) / 2] : [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 640];
      const q = bez(a, cc2, b, u);
      wx = q[0]; wy = q[1]; w = lerp(210, 150, u) + 70 * Math.sin(u * Math.PI); r = -8 + 720 * eout(u);
    }
    else if (s < .495) { wx = G.landW[0]; wy = G.landW[1] - 20 * Math.sin(clamp((s - .40) / .02) * Math.PI); w = 150; r = -8; }
    else if (s < .79) {
      const u = halus(.495, .52, s);
      const cx = A.x + jt.x, cy = A.y + jy - 250;
      wx = lerp(G.landW[0], cx, u); wy = lerp(G.landW[1], cy, u) - 60 * Math.sin(u * Math.PI); w = lerp(150, 120, u); r = lerp(-8, 6, u);
    }
    else { wx = G.boardSpot[0]; wy = G.boardSpot[1]; w = 170; r = 10; }
    const pw = proj(wx, wy);
    let X = pw[0], Y = pw[1], SC = w * S / 200, RT = r;
    const dk = halus(.555, .60, s) * (1 - halus(.79, .85, s));
    if (dk > 0) {
      const busur = s > .79 ? -110 * Math.sin(halus(.79, .85, s) * Math.PI) : -80 * Math.sin(halus(.555, .60, s) * Math.PI);
      X = lerp(X, HERO.tkDock[0], dk); Y = lerp(Y, HERO.tkDock[1], dk) + busur;
      SC = lerp(SC, HERO.tkDockScale, dk); RT = lerp(RT, -3, dk);
    }
    if (h > 0) { X = lerp(X, HERO.tk[0], h); Y = lerp(Y, HERO.tk[1], h); SC = lerp(SC, HERO.tkScale, h); RT = lerp(RT, 0, h); }
    els.ticket.style.transform = 'translate(' + X.toFixed(1) + 'px,' + Y.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + RT.toFixed(2) + 'deg) scale(' + SC.toFixed(4) + ')';
    tkX = X;
    // saat kartu NFT terbalik, tiket "berubah" jadi NFT: tiket memudar supaya label "example round" dan kartu tidak tertutup
    const tv = 1 - halus(.925, .965, s);
    els.ticket.style.opacity = tv.toFixed(3);
    els.ticket.style.visibility = tv > .01 ? 'visible' : 'hidden';
    const sk = halus(.80, .82, s);
    els.tkStamp.style.opacity = sk.toFixed(3);
    els.tkStamp.style.transform = 'translate(-50%,-50%) rotate(-16deg) scale(' + (1.7 - .7 * sk).toFixed(3) + ')';

    /* panel ronde: slot VS → dok kanan atas */
    const rX = lerp(HERO.rdDock[0], HERO.rd[0], h), rY = lerp(HERO.rdDock[1], HERO.rd[1], h), rS = lerp(HERO.rdDockScale, HERO.rdScale, h);
    els.round.style.transform = 'translate(' + (rX - 200).toFixed(1) + 'px,' + (rY - HERO.rdH / 2).toFixed(1) + 'px) scale(' + rS.toFixed(4) + ')';
    const rv = 1 - halus(.83, .87, s);
    els.round.style.opacity = rv.toFixed(3);
    els.round.style.visibility = rv > .01 ? 'visible' : 'hidden';

    /* lembar cetakan terbang ke papan, jadi kartu */
    const su = halus(.79, .885, s);
    const sv = su > 0 && su < 1;
    els.sheet.style.visibility = sv ? 'visible' : 'hidden';
    if (sv) {
      const a = G.lmOut, b = G.cardC;
      const cc3: V2 = por ? [a[0] - 420, (a[1] + b[1]) / 2] : [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 520];
      const q = bez(a, cc3, b, eio(su));
      const ss = lerp(.35, G.cardW / 360, eio(su));
      els.sheet.style.transform = 'translate(' + (q[0] - 180).toFixed(1) + 'px,' + (q[1] - 250).toFixed(1) + 'px) rotate(' + lerp(-24, 0, su).toFixed(1) + 'deg) scale(' + ss.toFixed(3) + ')';
      els.sheet.style.opacity = (1 - halus(.92, 1, su)).toFixed(3);
    }

    /* papan: bintang, upah, kartu dibalik */
    [.87, .885, .90].forEach((th, i) => {
      const k = halus(th, th + .014, s);
      starF[i].style.transform = 'scale(' + (k > 0 ? lontar(k) : 0).toFixed(3) + ') rotate(' + ((1 - k) * -40).toFixed(1) + 'deg)';
    });
    const pk = halus(.86, .91, s);
    els.pv1.textContent = '+' + dec(upah(KERJA) * pk, 4) + ' MON';
    els.pv2.textContent = '+' + dec((HARGA - upah(KERJA)) * pk, 4) + ' MON';
    const fl = halus(.92, .98, s);
    els.cardIn.style.transform = 'rotateY(' + (fl * 180).toFixed(1) + 'deg) rotateZ(' + (Math.sin(fl * Math.PI) * -6).toFixed(2) + 'deg) scale(' + (1 + Math.sin(fl * Math.PI) * .08).toFixed(3) + ')';

    /* bilah langkah */
    LANGKAH.forEach((rg, i) => {
      const f = clamp((s - rg[0]) / (rg[1] - rg[0]));
      segFill[i].style.transform = 'scaleX(' + f.toFixed(3) + ')';
      segs[i].classList.toggle('d-on', s >= rg[0] && (i === LANGKAH.length - 1 || s < LANGKAH[i + 1][0]));
    });

    /* pemicu figur (hanya saat melewati titik ke depan) */
    if (!R) {
      for (const t of PICU) {
        if (t.siap && s >= t.at && picuLalu < t.at) { t.siap = false; t.fn(); }
        if (s < t.at - .04) t.siap = true;
      }
    }
    picuLalu = s;
  }

  /* ---------- satu loop rAF; berhenti saat bagian D di luar layar ---------- */
  let jalan = false, raf = 0, terlihat = false;
  function bingkai(now: number): void {
    if (!jalan) return;
    const dt = Math.min(.1, (now - tLalu) / 1000); tLalu = now; dtNow = dt;
    /* header.top kerangka bisa terpasang/berubah setelah D: cek tingginya tiap detik */
    if (now - cekHdrLalu > 1000) { cekHdrLalu = now; if (tinggiHeader(root) !== hdr) perluTata = true; }
    if (perluTata) tata();
    bacaP();
    if (R) { sp = p; s = sTuju = platoTerdekat(p); }
    else {
      const k = 1 - Math.exp(-dt * 6.5);
      sp += (p - sp) * k;
      if (Math.abs(p - sp) < 1e-5) sp = p;
      sTuju = keCerita(p); s = keCerita(sp);
    }
    /* tiket: bandul teredam (ayun idle + dorongan dari gerak horizontal) */
    if (!R) {
      const dt2 = Math.min(.05, Math.max(.001, dt));
      const vx = Number.isNaN(ayun.lx) ? 0 : (tkX - ayun.lx) / dt2;
      ayun.lx = tkX;
      const tgt = Math.sin(now * .0019) * 2.2 + clamp(vx * .010, -8, 8);
      const acc = (tgt - ayun.a) * 27.04 - 2 * .72 * 5.2 * ayun.v;
      ayun.v += acc * dt2; ayun.a += ayun.v * dt2;
      els.tkIn.style.transform = 'rotate(' + ayun.a.toFixed(3) + 'deg)';
      /* layar VS: arena di balik tirai tetap bekerja */
      if (s <= .05 && F.fk && !document.hidden && now - ambLalu > 5200) {
        ambLalu = now;
        const k = amb++ % 3;
        if (k === 0) fkCopy(); else if (k === 1) prPrint(); else lmFeed();
      }
    }
    gambar(now);
    raf = requestAnimationFrame(bingkai);
  }
  function mulai(): void {
    if (jalan) return;
    jalan = true; kotor = true; tLalu = performance.now(); ayun.lx = NaN;
    raf = requestAnimationFrame(bingkai);
  }
  function henti(): void { jalan = false; cancelAnimationFrame(raf); }

  new IntersectionObserver(es => {
    for (const en of es) {
      terlihat = en.isIntersecting;
      if (terlihat) { mulai(); antreFigur(); } else henti();
    }
  }, { rootMargin: '15% 0px' }).observe(stage);

  /* bilah URL HP muncul/hilang memicu resize, tapi sticky 100svh tidak berubah → abaikan */
  addEventListener('resize', () => {
    if (sticky.clientWidth !== vw || sticky.clientHeight !== vh || tinggiHeader(root) !== hdr) { perluTata = true; kotor = true; }
  });
  muatFont(() => { perluTata = true; kotor = true; });

  /* awal: tata + gambar satu kali supaya layar VS sudah benar sebelum loop jalan */
  tata();
  bacaP(); sp = p; s = sTuju = R ? platoTerdekat(p) : keCerita(p); picuLalu = s;
  gambar(performance.now());
}

export const D: Bagian = {
  mount(root: HTMLElement, c: Ctx): void { pasang(root, c); },
  /* posisi scrollY absolut: layar VS + tengah tiap plateau bab */
  stops(): number[] {
    const st = stageRef, sk = stickyRef;
    if (!st || !sk) return [];
    const top = st.getBoundingClientRect().top + scrollY;
    const max = Math.max(0, st.offsetHeight - sk.clientHeight);
    return [Math.round(top), ...PLATO.filter(q => q.s > 0).map(q => Math.round(top + q.mid * max))];
  },
};
