// Satu tempat untuk semua fakta yang ditampilkan landing. Kosongkan ('') kalau belum ada → halaman menampilkan "—".
// Diisi Hans/Dex saat deploy. Jangan taruh kunci privat di sini.
export const NAMA = 'PrintPitt';
export const DESKRIPSI = 'toko fotokopi kilat onchain';
export const ORG_GITHUB = 'https://github.com/PrintPitt';
export const TAGLINE = 'Makin kilat, makin cuan.';

export const URL_APP = import.meta.env.VITE_APP_URL || ''; // app tim (React): /pesan, /toko, /layar
// prefill: jenis 3 = LAMINATING IJAZAH (katalog kontrak), teks order "Juri" (dibaca /pesan)
export const URL_PESAN = URL_APP ? `${URL_APP.replace(/\/$/, '')}/pesan?jenis=3&teks=Juri` : '/pesan?jenis=3&teks=Juri';
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

// Angka produk (sama dengan katalog kontrak v2.2, jenis 3 LAMINATING IJAZAH): harga Rp10.000 (tIDRX), batas kerja 45 dtk.
export const HARGA = 10_000;
export const BATAS_KERJA = 45;
/** Rupiah bulat gaya Indonesia tanpa "Rp" ("6.666"). Upah dibulatkan ke bawah seperti kontrak. */
export const rpAngka = (x: number) => Math.floor(x).toLocaleString('id-ID');

// Model bisnis (keputusan D-19, contract v2.1+).
export const BISNIS = {
  feePlatform: '3%', // dari upah toko, hanya order yang selesai
  feeRelay: 'Rp200', // per pesanan tanpa gas
  pro: 'Rp50.000', // Toko Pro per 30 hari
  radius: '1,5 km', // feed kios (Toko Pro 3 km)
};

export const MODE: 'MOCK' | 'LIVE' = (import.meta.env.VITE_MODE as 'MOCK' | 'LIVE') || 'MOCK';
