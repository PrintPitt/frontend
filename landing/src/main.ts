// Kerangka halaman PrintPitt: bilah atas (logo + bahasa), bagian D (Arena Toko+) lalu bagian E (Blitz+), plus mode panggung.
import './shell.css';
import { ctx, reduced } from './ctx';
import { t, lang, setLang } from './i18n';
import { D } from './d/d';
import { E } from './e/e';
import type { Bagian } from './ctx';
// pre-hero (src/p/) — dimuat lewat glob supaya build tetap jalan selama berkasnya belum ada
const pMods = import.meta.glob<{ P?: Bagian }>('./p/p.ts', { eager: true });
const P: Bagian | undefined = Object.values(pMods)[0]?.P;

document.documentElement.classList.remove('no-js');
const q = new URLSearchParams(location.search);
if (q.has('panggung')) document.documentElement.classList.add('panggung');
if (q.has('og')) document.documentElement.classList.add('og');

/* ---------- bilah atas: logo + wordmark + EN · ID ---------- */
const top = document.createElement('header');
top.className = 'top';
top.innerHTML = `
  <a class="brand" href="#D" aria-label="${ctx.NAMA}"><img src="/logo.svg" alt="" width="30" height="30" /><span>${ctx.NAMA}</span></a>
  <div class="top-r">
    <div class="lang" role="group" aria-label="${t('shell.lang.aria')}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
      <button type="button" data-l="en" aria-pressed="${lang === 'en'}" lang="en">EN</button><span aria-hidden="true">·</span><button type="button" data-l="id" aria-pressed="${lang === 'id'}" lang="id">ID</button>
    </div>
    <a class="top-cta" href="${ctx.URL_PESAN}" target="_blank" rel="noopener">${t('shell.cta')}</a>
  </div>`;
document.body.prepend(top);
top.querySelectorAll<HTMLButtonElement>('.lang button').forEach(b => b.addEventListener('click', () => { if (b.dataset.l !== lang) setLang(b.dataset.l as 'en' | 'id'); }));
document.getElementById('stageHelp')!.textContent = t('shell.stagehelp');
document.title = `${ctx.NAMA} — ${t('shell.headline')}`;

const pEl = document.getElementById('P')!;
if (P) P.mount(pEl, ctx); else pEl.remove();
D.mount(document.getElementById('D')!, ctx);

// bagian E baru dibangun saat pembaca mendekatinya (atau saat mode panggung / ?s= / kembali dari ganti bahasa),
// supaya kerja awal halaman ringan. Cadangan: tetap dibangun beberapa detik setelah halaman termuat.
let eMounted = false;
function mountE() { if (eMounted) return; eMounted = true; E.mount(document.getElementById('E')!, ctx); }
new IntersectionObserver((en, io) => { if (en.some(x => x.isIntersecting)) { io.disconnect(); mountE(); } }, { rootMargin: '0px 0px 250% 0px' })
  .observe(document.getElementById('E')!);
addEventListener('load', () => setTimeout(mountE, 8000), { once: true });

// kembali ke posisi baca setelah ganti bahasa
// (pemulihan scroll bawaan browser dimatikan supaya tidak bentrok; dipulihkan setelah font termuat karena tinggi bagian E bergantung font)
try { history.scrollRestoration = 'manual'; } catch { /* abaikan */ }
try {
  const y = sessionStorage.getItem('pp-scroll');
  if (y) {
    sessionStorage.removeItem('pp-scroll'); mountE(); scrollTo(0, +y);
    const back = () => document.fonts.ready.then(() => requestAnimationFrame(() => scrollTo(0, +y)));
    if (document.readyState === 'complete') back(); else addEventListener('load', back, { once: true });
  }
} catch { /* abaikan */ }
// ?s=n → buka langsung di adegan ke-n (0 = hero); dipakai saat demo dan untuk screenshot
// (ditunda sampai font bagian E termuat, karena tinggi bagian berubah setelah font masuk)
if (q.has('s')) {
  mountE();
  const go = () => { const ys = stops(); const n = Math.min(ys.length - 1, Math.max(0, parseInt(q.get('s')!, 10) || 0)); scrollTo(0, ys[n] + (+(q.get('dy') || 0))); };
  const later = () => setTimeout(() => document.fonts.ready.then(() => setTimeout(go, 300)), 600);
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}

/* ---------- mode panggung: → ← Spasi PageDown PageUp lompat ke berhenti berikutnya ---------- */
function stops() {
  mountE();
  return [0, ...(P ? P.stops() : []), ...D.stops(), ...E.stops()].map(v => Math.max(0, Math.round(v))).sort((a, b) => a - b)
    .filter((v, i, a) => i === 0 || v - a[i - 1] > 24);
}
let helpShown = false;
addEventListener('keydown', e => {
  const el = e.target as HTMLElement;
  if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(el.tagName) && e.key === ' ') return;
  if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable) return;
  const fwd = ['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey);
  const back = ['ArrowLeft', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
  if (!fwd && !back) return;
  e.preventDefault();
  const ys = stops(), y = scrollY;
  const target = fwd ? (ys.find(v => v > y + 8) ?? ys[ys.length - 1]) : ([...ys].reverse().find(v => v < y - 8) ?? 0);
  scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
  if (!helpShown) { helpShown = true; const h = document.getElementById('stageHelp')!; h.hidden = false; setTimeout(() => (h.hidden = true), 3200); }
});
