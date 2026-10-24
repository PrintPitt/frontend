// Satu tempat untuk semua fakta yang ditampilkan landing. Kosongkan ('') kalau belum ada → halaman menampilkan "—".
// Diisi Hans/Dex saat deploy. Jangan taruh kunci privat di sini.
export const NAMA = 'PrintPitt';
export const DESKRIPSI = 'toko fotokopi kilat onchain';
export const ORG_GITHUB = 'https://github.com/PrintPitt'; // repo belum dibuat
export const TAGLINE = 'Makin kilat, makin cuan.';

export const URL_APP = import.meta.env.VITE_APP_URL || ''; // app tim (React): /pesan, /toko, /layar
export const URL_PESAN = URL_APP ? `${URL_APP.replace(/\/$/, '')}/pesan?jenis=2&teks=Juri` : '/pesan?jenis=2&teks=Juri';
export const URL_LAYAR = URL_APP ? `${URL_APP.replace(/\/$/, '')}/layar` : '/layar';

export const BUKTI = {
  repo: import.meta.env.VITE_REPO_URL || '',
  kontrakTestnet: import.meta.env.VITE_CONTRACT_TESTNET || '',
  kontrakMainnet: import.meta.env.VITE_CONTRACT_MAINNET || '',
  urlLive: import.meta.env.VITE_LIVE_URL || '',
  deployment: import.meta.env.VITE_DEPLOYMENT || '', // mis. "Vercel · production"
  verifiedTestnet: import.meta.env.VITE_VERIFIED_TESTNET === '1',
  verifiedMainnet: import.meta.env.VITE_VERIFIED_MAINNET === '1',
};

export const EXPLORER = {
  testnet: 'https://testnet.monadvision.com',
  mainnet: 'https://monadvision.com',
};

// Angka produk (sama dengan kontrak): harga 0,02 MON, batas kerja 45 dtk.
export const HARGA_MON = 0.02;
export const BATAS_KERJA = 45;

// Model bisnis: angka yang belum disepakati trio ditandai [ISI] — jangan dikarang.
export const BISNIS = {
  feeRuangan: import.meta.env.VITE_FEE_RUANGAN || '[ISI]', // mis. "3%"
};

export const MODE: 'MOCK' | 'LIVE' = (import.meta.env.VITE_MODE as 'MOCK' | 'LIVE') || 'MOCK';
