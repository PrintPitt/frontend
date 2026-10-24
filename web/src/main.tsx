import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one';
import './styles.css';
import { NAMA } from './lib/merek';
import { RequireAuth, RUTE_PUBLIK } from './lib/auth';
import { useJalur } from './lib/navigasi';
import { PenyediaAuth } from './lib/privy';

// Kode tiap halaman dipisah: HP penonton (/pesan) tidak ikut mengunduh /layar dan /toko.
// Landing marketing ada di app terpisah (`landing/`, printpitt-landing.vercel.app); `/` app langsung ke lobi.
const Lobi = lazy(() => import('./pages/Lobi'));
const HALAMAN: Record<string, React.LazyExoticComponent<() => React.JSX.Element | null>> = {
  '/': Lobi,
  '/lobi': Lobi,
  '/main': lazy(() => import('./pages/Main')),
  '/pesan': lazy(() => import('./pages/Pesan')),
  '/toko': lazy(() => import('./pages/Toko')),
  '/layar': lazy(() => import('./pages/Layar')),
  '/cari': lazy(() => import('./pages/Cari')),
  '/masuk': lazy(() => import('./pages/Masuk')),
  '/karakter': lazy(() => import('./pages/Karakter')),
};

function Beranda() {
  return (
    <main className="beranda">
      <h1>{NAMA}</h1>
      <p className="muted">Toko fotokopi on-chain di Monad</p>
      <nav>
        <a href="/pesan">/pesan · penonton</a>
        <a href="/toko">/toko · pemain</a>
        <a href="/layar">/layar · proyektor</a>
      </nav>
    </main>
  );
}

function Router() {
  const path = useJalur();
  const Halaman = path === '/dev' ? Beranda : (HALAMAN[path] ?? Beranda);
  document.body.dataset.halaman = document.documentElement.dataset.halaman = path.slice(1) || 'lobi'; // `/` = lobi
  // semua halaman internal lewat satu gerbang login (lib/auth.tsx); hanya /masuk yang publik
  return RUTE_PUBLIK.has(path) ? <Halaman key={path} /> : <RequireAuth key={path}><Halaman /></RequireAuth>;
}
document.title = NAMA;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Memuat…</p>}>
      <PenyediaAuth>
        <Router />
      </PenyediaAuth>
    </Suspense>
  </StrictMode>,
);
