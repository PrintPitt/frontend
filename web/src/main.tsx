import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import './styles.css';
import { NAMA } from './lib/merek';
import LencanaJaringan from './components/LencanaJaringan';
import TombolAkun from './components/TombolAkun';
import { RequireAuth, RUTE_PUBLIK } from './lib/auth';
import { useJalur } from './lib/navigasi';
import { PenyediaAuth } from './lib/privy';

// Each page's code is split: the audience phone (/pesan) does not download /layar and /toko.
// The marketing landing is a separate app (`landing/`, printpitt-landing.vercel.app). App `/` = pick a role:
// customer (/pesan, real document printing), print shop owner (/toko, radius dashboard), or stage mode (/lobi, game).
const Lobi = lazy(() => import('./pages/Lobi'));
const HALAMAN: Record<string, React.LazyExoticComponent<() => React.JSX.Element | null>> = {
  '/': lazy(() => import('./pages/Beranda')),
  '/lobi': Lobi,
  '/main': lazy(() => import('./pages/Main')),
  '/pesan': lazy(() => import('./pages/Pesan')),
  '/toko': lazy(() => import('./pages/Toko')),
  '/layar': lazy(() => import('./pages/Layar')),
  '/cari': lazy(() => import('./pages/Cari')),
  '/masuk': lazy(() => import('./pages/Masuk')),
  '/akun': lazy(() => import('./pages/Akun')),
  '/karakter': lazy(() => import('./pages/Karakter')),
};

function Beranda() {
  return (
    <main className="beranda">
      <h1>{NAMA}</h1>
      <p className="muted">On-chain print shop on Monad</p>
      <nav>
        <a href="/pesan">/pesan · audience</a>
        <a href="/toko">/toko · players</a>
        <a href="/layar">/layar · projector</a>
      </nav>
    </main>
  );
}

function Router() {
  const path = useJalur();
  const Halaman = path === '/dev' ? Beranda : (HALAMAN[path] ?? Beranda);
  document.body.dataset.halaman = document.documentElement.dataset.halaman = path.slice(1) || 'lobi'; // `/` = lobi
  // all internal pages go through one sign-in gate (lib/auth.tsx); only /masuk is public
  const isi = RUTE_PUBLIK.has(path) ? <Halaman key={path} /> : <RequireAuth key={path}><Halaman /></RequireAuth>;
  return (
    <>
      {isi}
      <TombolAkun jalur={path} />
    </>
  );
}
document.title = NAMA;

// PWA: service worker only in production builds (the Vite dev server needs no cache)
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Loading…</p>}>
      <PenyediaAuth>
        <Router />
        <LencanaJaringan />
      </PenyediaAuth>
    </Suspense>
  </StrictMode>,
);
