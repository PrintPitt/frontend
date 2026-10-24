# web/ — frontend PrintPitt

React + Vite + viem + Mera + Motion (sesuai FE-00 dan Arsitektur di vault). Satu app, tiga halaman:

| Halaman | Untuk | Pemilik | Status |
|---|---|---|---|
| `/pesan` | Penonton di HP: akun → saldo awal → pesan → status live → NFT/refund | #fe-web | Jalan di anvil (BLZ-09) |
| `/layar` | Proyektor: QR, antrean, 2 toko live, payout turun per detik, omzet, uang mengalir, confetti, pemenang | #fe-web | Jalan di anvil (BLZ-12) |
| `/toko` | Pemain: feed order, rebut, 3 mini-game (Fotokopi, Print, Laminating), HUD payout, skor | #fe-game | Jalan di anvil (BLZ-10, BLZ-11, SFX BLZ-16.T1) |

## Jalankan lokal (anvil)

```bash
anvil --block-time 1                 # terminal 1 (block-time supaya countdown ikut jam)
cd web && node scripts/seed-anvil.mjs   # sekali tiap anvil baru: deploy + katalog + 2 toko + buka sesi
npm run dev                          # http://localhost:5173
```

- `/toko?dev=1` = Toko A, `/toko?dev=2` = Toko B (akun anvil, khusus chain 31337).
- `/pesan?burner=1` memaksa akun sementara (tanpa passkey).
- Order otomatis: `ops/` → `npm run bot` (lihat README root).
- Faucet lokal jalan otomatis di `vite dev` (akun anvil #5), tidak perlu env.

## Game (`/toko`)

- `src/pages/Toko.tsx`: feed order + tombol REBUT (kalah cepat → "Diambil Toko X"), runner resep, HUD payout yang turun tiap detik, papan skor semua toko.
- Runner: satu mini-game per langkah; saat lulus, `completeStep` dikirim sambil langkah berikutnya sudah dimainkan (⧗ = tx jalan, ✓ = tercatat on-chain). Tx gagal → langkah diulang.
- Mini-game di `src/game/` (props sama: `teks`, `label`, `onLulus`):
  - `Fotokopi.tsx`: seret dokumen ke garis putus-putus di kaca, lalu COPY (miring = ditolak).
  - `Print.tsx`: pilih `<teks>.pdf` dari flashdisk penuh umpan `.exe` (salah = layar virus), lalu kertas macet: tap TARIK 5x.
  - `Laminating.tsx`: TAHAN (atau Spasi) supaya jarum di zona hijau; terlalu cepat = kusut, terlalu pelan = gosong.
- SFX ZzFX di `src/game/sfx.ts` (tanpa file audio).
- Figur mesin Colorfigures (MIT, dari `figures/`) disalin ke `public/figures/` dan tampil di panel toko `/layar` lewat `src/components/MesinFigur.tsx`: iframe same-origin, bingkai halaman disembunyikan, mesin digerakkan sesuai langkah (termasuk kertas macet, isi kertas, ganti tinta).

## Layar (`/layar`)

- Koin terbang: pelanggan (QR) → escrow saat order masuk; escrow → toko (+bayaran) dan → pelanggan (refund) saat selesai/kedaluwarsa.
- Suara: klik 🔈 sekali di awal (browser butuh gesture), lalu ada bunyi untuk order masuk, rebutan, selesai, refund, dan pemenang.
- `endSession` → layar pemenang + peringkat + confetti. Riwayat sesi tetap ada setelah reload.
- Nama project: satu konstanta di `src/lib/merek.ts` (atau env `VITE_NAMA_PROYEK`).

## Pindah ke Monad testnet

Isi `web/.env.local` (contoh di `.env.example`): `VITE_CHAIN_ID=10143`, `VITE_RPC_URL` (RPC berkunci, SPK-05), `VITE_WS_URL`, `VITE_PUBLIC_URL`, dan alamat contract (otomatis dari `shared/` setelah deploy + `export.mjs`, atau `VITE_CONTRACT_ADDRESS`). Faucet di Vercel butuh env `FAUCET_PRIVATE_KEY`, `FAUCET_RPC_URL`, `FAUCET_AMOUNT_MON`.

Deploy Vercel: root directory `web/`, framework Vite, function `api/faucet.ts` ikut otomatis. Passkey (Mera) hanya jalan di HTTPS atau localhost; selain itu otomatis jatuh ke akun sementara.

## Struktur

```
api/faucet.ts      Vercel function POST /api/faucet  (logika di api/_faucet.ts, dipakai juga oleh vite dev)
src/lib/chain.ts   chain, client viem (HTTP batch + 1 WebSocket), alamat contract
src/lib/akun.ts    Mera passkey → signing session → akun viem; fallback burner; akun dev anvil
src/lib/tx.ts      kirim tx + gas limit dari shared/, pesan error, biaya maks (reserve balance Monad)
src/lib/katalog.ts read ringan: katalog, order, toko, NFT
src/lib/live.ts    snapshot + event live untuk /layar dan /toko
src/pages/         Pesan, Layar, Toko
scripts/seed-anvil.mjs  deploy + seed anvil lokal
```

## Kredit aset

- Model 3D generik (konter, kardus, rak) di `public/models/delixia/` dari [Delixia](https://github.com/TriForMine/Delixia) oleh TriForMine, lisensi Apache-2.0 (salinan lisensi di folder yang sama). Aset makanan/dapur tidak dipakai.
- Mesin fotokopi, printer, laminator 3D (`src/arena3d/Mesin3D.tsx`) dimodelkan ulang dari figur tim di `figures/` (Colorfigures).
- Tukang fotokopi 3D (`src/arena3d/Pekerja3D.tsx`) dibuat prosedural.
