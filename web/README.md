# web/ — PrintPitt frontend

React + Vite + viem + Mera + Motion (per FE-00 and the Architecture note in the vault). One app, three pages:

| Page | For | Owner | Status |
|---|---|---|---|
| `/pesan` | Audience on their phones: account → starter balance → order → live status → NFT/refund | #fe-web | Runs on anvil (BLZ-09) |
| `/layar` | Projector: QR, queue, 2 live shops, payout dropping every second, revenue, money flow, confetti, winner | #fe-web | Runs on anvil (BLZ-12) |
| `/toko` | Players: order feed, claim race, 3 mini-games (Photocopy, Print, Laminate), payout HUD, score | #fe-game | Runs on anvil (BLZ-10, BLZ-11, SFX BLZ-16.T1) |

## Run locally (anvil)

```bash
anvil --block-time 1                 # terminal 1 (block-time so the countdown follows the clock)
cd web && node scripts/seed-anvil.mjs   # once per fresh anvil: deploy + catalog + 2 shops + open session
npm run dev                          # http://localhost:5173
```

- `/toko?dev=1` = Shop A, `/toko?dev=2` = Shop B (anvil accounts, chain 31337 only).
- `/pesan?burner=1` forces a temporary account (no passkey).
- Automatic orders: `ops/` → `npm run bot` (see the root README).
- The local faucet runs automatically in `vite dev` (anvil account #5), no env needed.

## Game (`/toko`)

- `src/pages/Toko.tsx`: order feed + CLAIM button (too slow → "Taken by Shop X"), recipe runner, payout HUD that drops every second, scoreboard for all shops.
- Runner: one mini-game per step; when you pass, `completeStep` is sent while you already play the next step (⧗ = tx pending, ✓ = recorded on-chain). Failed tx → the step is repeated.
- Mini-games in `src/game/` (same props: `teks`, `label`, `onLulus`):
  - `Fotokopi.tsx`: drag the document onto the dashed line on the glass, then COPY (crooked = rejected).
  - `Print.tsx`: pick `<teks>.pdf` from a flash drive full of `.exe` bait (wrong = virus screen), then a paper jam: tap PULL 5x.
  - `Laminating.tsx`: HOLD (or Space) to keep the needle in the green zone; too fast = wrinkled, too slow = burnt.
- ZzFX SFX in `src/game/sfx.ts` (no audio files).
- Real document orders (type 5+, contract v2.1): **Set shop location** button (backend feed radius 1.5 km, Shop Pro 3 km), download the document, mark steps with buttons, order Ready → **Scan QR** of the customer (`src/components/PindaiQr.tsx`) → `serahkan`. Shop Pro subscription from the header.
- Colorfigures machine figures (MIT, from `figures/`) are copied to `public/figures/` and shown in the shop panel on `/layar` via `src/components/MesinFigur.tsx`: same-origin iframe, page frame hidden, machine animated per step (including paper jam, paper refill, ink change).

## Screen (`/layar`)

- Flying coins: customer (QR) → escrow when an order comes in; escrow → shop (+payment) and → customer (refund) on finish/expiry.
- Sound: click 🔈 once at the start (browsers need a gesture), then there are sounds for new order, claim race, finish, refund, and winner.
- `endSession` → winner screen + ranking + confetti. Session history survives a reload.
- Project name: one constant in `src/lib/merek.ts` (or env `VITE_NAMA_PROYEK`).

## Move to Monad testnet

Fill `web/.env.local` (example in `.env.example`): `VITE_CHAIN_ID=10143`, `VITE_RPC_URL` (keyed RPC, SPK-05), `VITE_WS_URL`, `VITE_PUBLIC_URL`, and the contract address (automatic from `shared/` after deploy + `export.mjs`, or `VITE_CONTRACT_ADDRESS`). The faucet on Vercel needs env `FAUCET_PRIVATE_KEY`, `FAUCET_RPC_URL`, `FAUCET_AMOUNT_MON`.

Vercel deploy: root directory `web/`, framework Vite, function `api/faucet.ts` is included automatically. Passkey (Mera) only works on HTTPS or localhost; anywhere else it falls back to a temporary account.

## Structure

```
api/faucet.ts      Vercel function POST /api/faucet  (logic in api/_faucet.ts, also used by vite dev)
src/lib/chain.ts   chain, viem client (HTTP batch + 1 WebSocket), contract address
src/lib/akun.ts    Mera passkey → signing session → viem account; burner fallback; anvil dev accounts
src/lib/tx.ts      send tx + gas limit from shared/, error messages, max cost (Monad reserve balance)
src/lib/katalog.ts light reads: catalog, orders, shops, NFT
src/lib/live.ts    snapshot + live events for /layar and /toko
src/pages/         Pesan, Layar, Toko
scripts/seed-anvil.mjs  deploy + seed local anvil
```

## Asset credits

- Generic 3D models (counter, boxes, shelves) in `public/models/delixia/` from [Delixia](https://github.com/TriForMine/Delixia) by TriForMine, Apache-2.0 license (license copy in the same folder). Food/kitchen assets are not used.
- 3D photocopier, printer and laminator (`src/arena3d/Mesin3D.tsx`) are remodeled from the team's figures in `figures/` (Colorfigures).
- The 3D copy-shop worker (`src/arena3d/Pekerja3D.tsx`) is procedural.
