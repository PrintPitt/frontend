# PrintPitt — the onchain print shop on Monad

**Order a print from your phone, and two copy shops race for it onchain: the faster a shop finishes, the more it earns, and the rest flows back to you automatically.** Built for students and the copy kiosks around campus. Made at **Monad Blitz Jogja Vol. 2** (24 October 2026, Yogyakarta).

![PrintPitt](docs/printpitt.png)

> Demo video: **[ADD LINK]**

## Try it now

| What | Where |
|---|---|
| Order from your phone (scan the QR on stage) | https://printpitt-app.vercel.app/pesan |
| Live board (projector) | https://printpitt-app.vercel.app/layar |
| Shop game (the two print shops) | https://printpitt-app.vercel.app/toko |
| Landing page | https://printpitt-landing.vercel.app (source: [`landing/`](landing/)) |
| Backend status (Railway) | testnet https://backend-production-2b31.up.railway.app/status · mainnet https://backend-mainnet-production-7835.up.railway.app/status |

**Contracts (v2.3), verified on Sourcify (exact match).** The app switches network with `?jaringan=mainnet` / `?jaringan=testnet` (badge in the bottom-left corner).

| Network | `FotokopiKilat` (escrow, claim race, decaying payout, refund, NFT receipt) | `TestIDRX` (tIDRX, Rupiah token with `permit`) | Deploy tx |
|---|---|---|---|
| **Monad Mainnet** (chain 143, block 116137717) | [`0x4b453b395eEa830C5CB208551A0326f6cd976f12`](https://monadvision.com/address/0x4b453b395eEa830C5CB208551A0326f6cd976f12) | [`0xEf3369C083B137C0FB3Fa9424990726d424ac205`](https://monadvision.com/address/0xEf3369C083B137C0FB3Fa9424990726d424ac205) | [`0xa1b1d9dd…4144019f`](https://monadvision.com/tx/0xa1b1d9dd4a85037ef24ec8156a623c81f8b5c5d9afb8890ec9c4ebaa4144019f) |
| **Monad Testnet** (chain 10143, block 73752547) | [`0x24b045E3B4155232F81c709dF3DD43595a5C5101`](https://testnet.monadvision.com/address/0x24b045E3B4155232F81c709dF3DD43595a5C5101) | [`0xcCf26C3b02a610fB87327f41a13384aF8ff57F45`](https://testnet.monadvision.com/address/0xcCf26C3b02a610fB87327f41a13384aF8ff57F45) | [`0x06746ec0…04e9e70f`](https://testnet.monadvision.com/tx/0x06746ec0ab0110ef87b5e6f6d05f5b8c3760b3e695062c41392c0f7204e9e70f) |

Real IDRX integration (proof only, not used by the demo app): `FotokopiKilat` on mainnet with real IDRX [`0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22`](https://monadvision.com/address/0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22) at [`0x1F8061d653896fF48EbFDD3Fee7C0684E2995f77`](https://monadvision.com/address/0x1F8061d653896fF48EbFDD3Fee7C0684E2995f77) (IDRX has no `permit`; the app falls back to a one-time `approve`).

On mainnet, judges pay nothing: one **judge code** on `/pesan` gives 1 MON for gas and a Rp20.000 tIDRX voucher. Example order transaction: **[ADD after demo]**.

**Run it locally (3 steps):**

```bash
git clone https://github.com/PrintPitt/frontend.git && cd frontend/web
npm install && cp .env.example .env.local   # testnet values: see "Moving to Monad testnet" in web/README.md
npm run dev                                  # open http://localhost:5173/pesan
```

It works if `/pesan` shows a Rupiah balance after "top up", and your order then appears on `/layar`.

## How it works (onchain flow)

1. **Order and pay.** The customer picks a job on `/pesan` (fixed-price jobs, or upload a real document priced per page by `hargaUntuk`) and pays in Rupiah (tIDRX). Uploaded files are stored encrypted by the backend; only the customer and the winning shop can download them, and they are deleted when the order is final. No gas needed: the customer signs an EIP-712 order plus an EIP-2612 `permit`, and our relayer submits it. The money sits in the contract's escrow, not with any shop.
2. **Race.** Shops within 1.5 km of the customer's rough location (3 km for Toko Pro) see the order and call `claim`. The first transaction in a block wins. The other shop gets "taken by Shop X".
3. **Work.** The winning shop completes each step (`completeStep`): copy → print → laminate. Its pay drops every second:
   `payout = price × (timeLimit − workTime) / timeLimit`, `refund = price − payout`.
4. **Ready and hand over.** The shop marks the order ready (payout is fixed at that moment). Funds are released when the shop scans the customer's secret QR at pickup.
5. **Too late?** `expire` refunds 100% automatically. A keeper calls it, no admin needed.
6. **Dispute.** While the order is ready, the customer can `komplain`. Funds are held until the operator decides; if nobody decides in time, `tutupSengketa` splits it 50/50.
7. **Receipt.** The customer gets an onchain SVG NFT receipt with the job, the order text, the shop and the work time.

Revenue model (live since contract v2.1): 3% platform fee on the shop's payout for completed orders, sent to the treasury (the customer's refund is never cut), Rp200 relayer fee per gasless order, and a "Toko Pro" subscription (Rp50,000 / 30 days, order radius 3 km instead of 1.5 km).

## Why Monad

- **~0.4 s blocks and ~0.8 s finality** (Monad docs). A claim race is decided in one block, so "who was first" is fair and instant.
- **Per-second pay only makes sense on a fast chain.** On a slow chain the order is stale before it confirms.
- **Low fees and full EVM.** Foundry, OpenZeppelin, viem and Envio work as-is, so a gasless Rupiah flow costs the customer nothing.

## Architecture

| Repo | What it does |
|---|---|
| `frontend` (this repo) | `web/`: React + Vite app with `/pesan` (phone), `/layar` (projector), `/toko` + 3D game. `landing/`: landing page. `assets/figures/`: interactive machine figures |
| `contracts` | `FotokopiKilat` + `TestIDRX` (Foundry, OpenZeppelin), unit + invariant tests, package `@printpitt/shared` (ABI, addresses, helpers) |
| `backend` | Railway service: faucet, simulated Rupiah top-up, relayer (gasless orders), keeper (auto `expire`), order bot |
| `indexer` | Envio HyperIndex: orders, shops, sessions, leaderboard, top-ups (GraphQL) |
| `vault` | Design docs, decisions, spikes, backlog, flow diagrams |

## Judging checklist

| Criterion | Where to check |
|---|---|
| Public GitHub repo | **[make repos public before submit]** |
| README with live URL + contract address | this file, "Try it now" |
| Contract on Monad Testnet, verified | table above (Sourcify exact match, testnet and mainnet) |
| Publicly hosted | `printpitt-app.vercel.app`, `printpitt-landing.vercel.app`, Railway backend |
| Live onchain transaction in the demo | scan the QR → order → watch `/layar` and the explorer |
| Others can run it from the README | "Run it locally" above |
| Product-market fit, revenue, innovation | "How it works", revenue model, "Why Monad" |

## Built during the event vs prepared before

**[TEAM TO CONFIRM BEFORE SUBMIT]** Before 24 October: idea, research, spikes and design documents (`vault`). On 24 October: the repos in this org were created and the code was pushed (first commits 11:13 WIB). This includes contracts v2 to v2.3 (testnet and mainnet), the relayer and backend, the indexer, the web app with the game, and the landing page.

## Limits and what breaks first

- Public RPC rate limits break first under load, so we use a keyed RPC plus a single relayer queue. More relayers are the next step.
- tIDRX is a test token. A real launch would use IDRX with a payment-gateway top-up.
- Mainnet: deployed (v2.3, tIDRX demo token + real IDRX proof contract), see the contracts table.

## Team

- **Hans Gunawan**: smart contracts, backend, indexer, architecture
- **Dave**: web app, `/pesan`, `/layar`, shop game
- **Dex Bennett**: product, landing page, pitch

---

## For developers

The frontend is deployed on Vercel. This repo also holds the machine figures and the integration contract.

### Assets

`assets/figures/{fotokopi,printer,laminator}`: interactive machine figures (standalone HTML, colorfigures). Open the `.html` file directly.

### Integration

| Need | Source |
|---|---|
| ABI, addresses, helpers (`teksValid`, `hitungPayout`, `formatRupiah`, `PESANAN_TYPES`, `PERMIT_TYPES`, `domainPesanan`, `domainTidrx`) | package `@printpitt/shared` from repo `PrintPitt/contracts` (folder `shared/`). While private: install the tarball `npm i ./vendor/printpitt-shared-0.1.0.tgz` (copy it from the backend repo's `vendor/`) |
| Backend API: `/faucet`, `/topup`, `/topup/:id`, `/bayar/:id`, `/relay/order`, `/config`, `/status` | repo `PrintPitt/backend`; spec in the vault, `04-Architecture/Desain Backend.md` |
| Snapshots, history, leaderboard (GraphQL) | repo `PrintPitt/indexer`; example queries in its README |
| Live game events | WebSocket straight to the Monad RPC (decision D-16) |

Frontend flows, rules and backlog: repo `PrintPitt/vault` → `06-FE-vault/`.

### App `web/` (frontend + game)

React + Vite + three.js (React Three Fiber). Pages: `/` landing, `/lobi` (lobby), `/main` (Overcooked-style 3D match), `/pesan` (customer phone), `/toko` (shop), `/layar` (projector board). Route names are Indonesian and stay as they are. Details in `web/README.md`.

```bash
cd web && npm install && npm run dev
```

Note: `shared/src/` in this repo is a copy of `@printpitt/shared` from repo `PrintPitt/contracts` (folder `shared/src/`, contract v2.3: testnet `0x24b0…5101`, mainnet `0x4b45…6f12`). After a contract redeploy, copy `index.ts` and `fotokopiKilat.generated.ts` here again.
