import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { NAMA } from './lib/merek';
import { useJalur } from './lib/navigasi';

// Kode tiap halaman dipisah: HP penonton (/pesan) tidak ikut mengunduh /layar dan /toko.
const HALAMAN: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  '/': lazy(() => import('./pages/Landing')),
  '/lobi': lazy(() => import('./pages/Lobi')),
  '/main': lazy(() => import('./pages/Main')),
  '/pesan': lazy(() => import('./pages/Pesan')),
  '/toko': lazy(() => import('./pages/Toko')),
  '/layar': lazy(() => import('./pages/Layar')),
  '/cari': lazy(() => import('./pages/Cari')),
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
  document.body.dataset.halaman = path.slice(1) || 'beranda';
  return <Halaman key={path} />;
}
document.title = NAMA;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Memuat…</p>}>
      <Router />
    </Suspense>
  </StrictMode>,
);
