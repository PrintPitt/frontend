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

// Kode tiap halaman dipisah: HP penonton (/pesan) tidak ikut mengunduh /layar dan /toko.
// Landing marketing ada di app terpisah (`landing/`, printpitt-landing.vercel.app). `/` app = pilih peran:
// pelanggan (/pesan, cetak dokumen nyata), pemilik fotokopi (/toko, dashboard radius), atau mode panggung (/lobi, game).
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
  const isi = RUTE_PUBLIK.has(path) ? <Halaman key={path} /> : <RequireAuth key={path}><Halaman /></RequireAuth>;
  return (
    <>
      {isi}
      <TombolAkun jalur={path} />
    </>
  );
}
document.title = NAMA;

// PWA: service worker hanya di build produksi (dev server Vite tidak butuh cache)
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Memuat…</p>}>
      <PenyediaAuth>
        <Router />
        <LencanaJaringan />
      </PenyediaAuth>
    </Suspense>
  </StrictMode>,
);
