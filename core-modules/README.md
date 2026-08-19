# FCC Core Modules — Login & Credits MVP

Reusable building blocks for **all** our Nimiq Mini Apps. Each app imports
these modules and gets wallet login and a credits store with USDT/NIM
purchasing out of the box.

## Modules

### `src/modules/auth` — Login
- **Nimiq Wallet** (primary): `listAccounts()` via `@nimiq/mini-app-sdk` — the
  wallet address is the identity. One native approval dialog, no passwords.
- **Google** (secondary): Google Identity Services. Requires `googleClientId`
  in config. ⚠️ Google blocks OAuth inside embedded WebViews, so this may not
  work inside Nimiq Pay itself — it's for the browser/desktop version of our
  apps. Wallet login is the path we demo for the competition.

### `src/modules/credits` — Payments & credits
- **$5 USDT = 300 credits** — ERC-20 `transfer` on Polygon (6 decimals!)
  through `window.ethereum`, ABI-encoded with viem.
- **Pay with NIM = 150% credits** (450 for the $5 pack) — `sendBasicTransactionWithData`
  with the app id + pack reference in the data field so the backend can
  reconcile. NIM amount converted live via CoinGecko (60s cache, static fallback).
- Balance + purchase history per user in localStorage (MVP), `spend()` helper
  for consuming credits in-app.

## Reuse in a new mini app

```ts
import { configure, useAuth, useCredits } from '<path-to>/core-modules/src/modules'

configure({
  appId: 'aeternum',                    // namespaces balances per app
  nimTreasuryAddress: 'NQ...',          // where NIM payments land
  evmTreasuryAddress: '0x...',          // where USDT payments land
  googleClientId: '...apps.googleusercontent.com', // optional
  packs: [{ usd: 5, credits: 300 }],
  nimBonusMultiplier: 1.5,
})
```

Then use `useAuth()` / `useCredits()` in any component (see
`src/components/LoginCard.vue` and `CreditsCard.vue` for reference UIs).
The provider logic is plain TypeScript (`nimiqAuth.ts`, `payUsdt.ts`,
`payNim.ts`) — reusable from React/Svelte too; only the `use*` composables
are Vue-specific.

## Run the demo

```bash
npm install
npm run dev            # already binds --host (vite.config.ts)
```

Phone (same Wi-Fi) → Nimiq Pay → Mini Apps → enter the Network URL
(e.g. `http://192.168.x.x:5173`). For NIM testing without real funds:
long-press Nimiq Pay's settings button 10s → switch to Testnet → "Get free NIM".
**EVM/USDT stays on mainnet even on testnet** — test USDT with small amounts.

## Before production (full project)

1. Replace the placeholder treasury addresses in `src/modules/config.ts`.
2. Move credit granting server-side: verify the tx hash on-chain before
   crediting (`useCredits.ts` documents the seam). Never trust client balances.
   Done for `otherme-app` (its own Firebase Functions backend verifies on-chain
   and grants credits server-side) — this Vue demo app has no backend of its
   own, so the item still applies here.
3. Add a signed-challenge step to wallet login (`sign()`) for backend sessions.
   Same as above: shipped in `otherme-app`, still open for this demo app.
4. Google login: backend redirect flow via external browser for in-WebView use.
5. Node 22+ on dev machines (currently pinned to Vite 5 for Node 18).
