# PrintPitt — the onchain print shop on Monad

**Order a print from your phone, and two copy shops race for it onchain: the faster a shop finishes, the more it earns, and the rest flows back to you automatically.** Built for students and the copy kiosks around campus. Made at **Monad Blitz Jogja Vol. 2** (24 October 2026, Yogyakarta).

![PrintPitt](docs/printpitt.png)

> Demo video: **[ADD LINK]**

## Try it now

| What | Where |
|---|---|
| Order from your phone (scan the QR on stage) | https://fotokopi-kilat.vercel.app/pesan |
| Live board (projector) | https://fotokopi-kilat.vercel.app/layar |
| Shop game (the two print shops) | https://fotokopi-kilat.vercel.app/toko |
| Landing page | **[ADD URL]** (source: [`landing/`](landing/)) |
| Backend status (Railway) | https://backend-production-2b31.up.railway.app/status |

**Contracts on Monad Testnet (chain 10143)**, verified on Sourcify:

| Contract | Address |
|---|---|
| `FotokopiKilat` (escrow, claim race, decaying payout, refund, NFT receipt) | [`0x7aa3616045f98AE7CFEfD495aFEDbfCDE38B3181`](https://testnet.monadvision.com/address/0x7aa3616045f98AE7CFEfD495aFEDbfCDE38B3181) |
| `TestIDRX` (tIDRX, test Rupiah token with `permit`) | [`0xa5A96e268D6d75473B7b15c4BAFCDDCDC8223589`](https://testnet.monadvision.com/address/0xa5A96e268D6d75473B7b15c4BAFCDDCDC8223589) |

Example transaction (contract deployment): [`0xbec19f92…8261b03`](https://testnet.monadvision.com/tx/0xbec19f927f899fd1cdf3343db0f317059375d7c9bd1636359eefe8a1d8261b03). Example order transaction: **[ADD after demo]**.

**Run it locally (3 steps):**

```bash
git clone https://github.com/PrintPitt/frontend.git && cd frontend/web
npm install && cp .env.example .env.local   # testnet values: see "Moving to Monad testnet" in web/README.md
npm run dev                                  # open http://localhost:5173/pesan
```

It works if `/pesan` shows a Rupiah balance after "top up", and your order then appears on `/layar`.

## How it works (onchain flow)

1. **Order and pay.** The customer picks a job (copy, print, laminate) on `/pesan` and pays in Rupiah (tIDRX). No gas needed: the customer signs an EIP-712 order plus an EIP-2612 `permit`, and our relayer submits it. The money sits in the contract's escrow, not with any shop.
2. **Race.** Both shops see the order and call `claim`. The first transaction in a block wins. The other shop gets "taken by Shop X".
3. **Work.** The winning shop completes each step (`completeStep`): copy → print → laminate. Its pay drops every second:
   `payout = price × (timeLimit − workTime) / timeLimit`, `refund = price − payout`.
4. **Ready and hand over.** The shop marks the order ready (payout is fixed at that moment). Funds are released when the shop scans the customer's secret QR at pickup.
5. **Too late?** `expire` refunds 100% automatically. A keeper calls it, no admin needed.
6. **Receipt.** The customer gets an onchain SVG NFT of the print, with their name on it.

Revenue model (live in contract v2.1): 3% platform fee on completed orders to the treasury, Rp200 relayer fee per gasless order, and a "Toko Pro" subscription (Rp50,000 / 30 days, 3 km order radius).

## Why Monad

- **~0.4 s blocks and ~0.8 s finality** (Monad docs). A claim race is decided in one block, so "who was first" is fair and instant. Our team measured 0.303 s per block on testnet.
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
| Contract on Monad Testnet, verified | table above (Sourcify) |
| Publicly hosted | `fotokopi-kilat.vercel.app`, Railway backend |
| Live onchain transaction in the demo | scan the QR → order → watch `/layar` and the explorer |
| Others can run it from the README | "Run it locally" above |
| Product-market fit, revenue, innovation | "How it works", revenue model, "Why Monad" |

## Built during the event vs prepared before

**[TEAM TO CONFIRM BEFORE SUBMIT]** Before 24 October: idea, research, spikes and design documents (`vault`). On 24 October: the repos in this org were created and the code was pushed (first commits 11:13 WIB). This includes contract v2 and v2.1, the relayer and backend, the indexer, the web app with the game, and the landing page.

## Limits and what breaks first

- Public RPC rate limits break first under load, so we use a keyed RPC plus a single relayer queue. More relayers are the next step.
- tIDRX is a test token. A real launch would use IDRX with a payment-gateway top-up.
- Mainnet deployment: **[ADD if done]**.

## Team

- **Hans Gunawan**: smart contracts, backend, indexer, architecture
- **Dave**: web app, `/pesan`, `/layar`, shop game
- **Dex Bennett**: product, landing page, pitch

---

## Untuk developer (internal)

FE (Vercel) dikerjakan tim FE. Repo ini berisi aset dan kontrak integrasi yang sudah siap.

### Aset

`assets/figures/{fotokopi,printer,laminator}`: figur interaktif mesin (HTML mandiri, colorfigures). Buka file `.html`-nya langsung.

### Integrasi

| Kebutuhan | Sumber |
|---|---|
| ABI, alamat, helper (`teksValid`, `hitungPayout`, `formatRupiah`, `PESANAN_TYPES`, `PERMIT_TYPES`, `domainPesanan`, `domainTidrx`) | package `@printpitt/shared` dari repo `PrintPitt/contracts` (folder `shared/`). Selama private: pasang tarball `npm i ./vendor/printpitt-shared-0.1.0.tgz` (salin dari repo backend `vendor/`) |
| API backend: `/faucet`, `/topup`, `/topup/:id`, `/bayar/:id`, `/relay/order`, `/config`, `/status` | repo `PrintPitt/backend`, spesifikasi di vault `04-Architecture/Desain Backend.md` |
| Snapshot, riwayat, leaderboard (GraphQL) | repo `PrintPitt/indexer`, contoh query di README-nya |
| Event live game | WebSocket langsung ke RPC Monad (D-16) |

Alur, aturan, dan backlog FE: repo `PrintPitt/vault` → `06-FE-vault/`.

### App `web/` (FE + game)

React + Vite + three.js (React Three Fiber). Halaman: `/` landing, `/lobi`, `/main` (tanding 3D ala Overcooked), `/pesan` (HP penonton), `/toko`, `/layar` (proyektor). Detail di `web/README.md`.

```bash
cd web && npm install && npm run dev
```

Catatan: `shared/` di repo ini adalah snapshot ABI lama (pembayaran MON) yang dipakai `web/` saat ini; akan diganti `@printpitt/shared` (tIDRX + permit + relayer) begitu contract final.
