# PrintPitt · frontend

FE (Vercel) dikerjakan tim FE. Repo ini berisi aset dan kontrak integrasi yang sudah siap.

## Aset

`assets/figures/{fotokopi,printer,laminator}`: figur interaktif mesin (HTML mandiri, colorfigures). Buka file `.html`-nya langsung.

## Integrasi

| Kebutuhan | Sumber |
|---|---|
| ABI, alamat, helper (`teksValid`, `hitungPayout`, `formatRupiah`, `PESANAN_TYPES`, `PERMIT_TYPES`, `domainPesanan`, `domainTidrx`) | package `@printpitt/shared` dari repo `PrintPitt/contracts` (folder `shared/`). Selama private: pasang tarball `npm i ./vendor/printpitt-shared-0.1.0.tgz` (salin dari repo backend `vendor/`) |
| API backend: `/faucet`, `/topup`, `/topup/:id`, `/bayar/:id`, `/relay/order`, `/config`, `/status` | repo `PrintPitt/backend`, spesifikasi di vault `04-Architecture/Desain Backend.md` |
| Snapshot, riwayat, leaderboard (GraphQL) | repo `PrintPitt/indexer`, contoh query di README-nya |
| Event live game | WebSocket langsung ke RPC Monad (D-16) |

Alur, aturan, dan backlog FE: repo `PrintPitt/vault` → `06-FE-vault/`.

## App `web/` (FE + game)

React + Vite + three.js (React Three Fiber). Halaman: `/` landing, `/lobi`, `/main` (tanding 3D ala Overcooked), `/pesan` (HP penonton), `/toko`, `/layar` (proyektor). Detail di `web/README.md`.

```bash
cd web && npm install && npm run dev
```

Catatan: `shared/src/` di repo ini adalah salinan `@printpitt/shared` dari repo `PrintPitt/contracts` (folder `shared/src/`, contract v2.2 `0x08b7…c959`). Setelah contract di-deploy ulang, salin lagi `index.ts` dan `fotokopiKilat.generated.ts` ke sini.
