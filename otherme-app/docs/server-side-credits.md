# Server-side credits with on-chain reconciliation

Status: **Phase 1 complete & deployed** · Phases 2–5 pending
Owner: OtherMe / FCC core-modules
Last updated: 2026-07-22

This document specifies how OtherMe moves credit granting from the current
client-side MVP to a server-authoritative model with on-chain transaction
verification. It is the reference for the phased implementation; each phase
links back to the numbered sections here.

## Progress

- ✅ **Phase 1 — signed-challenge auth (§5): DONE, deployed, verified on-device.**
  Login on othermeapp.com creates both a Firestore `users/{NQ-address}` doc and a
  Firebase Auth user. Backend lives in the existing `functions` `api` Express
  function (`/api/auth/challenge`, `/api/auth/verify`); client in
  `src/core/{firebase,session}.ts`, wired non-blocking in `src/core/auth.ts`.
- ✅ **Phase 2 — server-authoritative ledger (§6): DONE, deployed, verified
  on-device.** Migration confirmed (user doc shows `balance: 4404`,
  `welcomeGranted: true`). Routes on the `api` function: `GET
  /api/credits/balance`, `POST /api/credits/{migrate,spend,record-purchase}`
  (`functions/src/credits/`). Client (`src/core/credits.ts`) seeds from the
  server on session, dual-writes spends and purchases, keeps localStorage as an
  offline cache. Wallet logins only; `record-purchase` trusts the client for
  now — replaced by Phase 4's reconciler.
- ✅ **Phase 3 — payment intents (§7): DONE, deployed, verified on-device.**
  Order doc confirmed (`status: submitted`, matching `txHash`, server-computed
  `expectedAmount`/`expectedBaseUnits`/`reference`, `credits: 90`). `POST
  /api/orders` (server fixes amount from its own PACKS + frozen NIM rate + a
  reference) and `POST /api/orders/:id/claim` (`functions/src/orders/`,
  `functions/src/config.ts`). Client purchase flow (`src/core/credits.ts`):
  order → pay the server amount tagging the tx with the order id → claim.
  `payUsdt` now also returns the payer address. Credits still granted via the
  temporary `record-purchase`; Phase 4 moves granting to the verified reconciler.

**— Phases 1–3 complete (server owns identity, ledger, and payment intents).
Remaining work replaces the client-trusted `record-purchase` with on-chain
verification. —**

- ⬜ Phase 4 — background reconciler (§8) — **blocked on on-chain RPC access.**
  Polygon RPC key (free Alchemy/Infura) unblocks USDT verification immediately;
  NIM needs a self-run Nimiq Albatross node (no free public RPC). Plan: verify
  USDT first, add NIM once a node is up. See §14/notes.
- ⬜ Phase 5 — atomic grant (§9)

## Security notes

- **Firebase web API key (`src/core/firebase.ts`) is public by design** and safe
  to commit — it ships in the client bundle regardless. GitHub secret-scanning
  flags all `AIza…` keys; for a Firebase web key that's a false-positive class.
  Real secrets (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are in Secret Manager +
  gitignored `.env.local`, never committed. Hardening applied: the browser key
  is API-restricted in GCP (Identity Toolkit, Token Service, Firebase
  Installations, Cloud Firestore) and access is gated by Firestore rules + the
  signed-challenge Auth. App Check is a future add (needs a small client SDK
  change).

## Deployment notes / gotchas (learned in Phase 1)

- **Service Account Token Creator role is required.** `createCustomToken()` on
  gen2 Functions signs via the IAM `signBlob` API; the runtime SA
  (`239756970799-compute@developer.gserviceaccount.com`) needs the
  **Service Account Token Creator** role or `/api/auth/verify` 500s *after*
  creating the user doc. Granted.
- **Nimiq Pay won't open `*.trycloudflare.com`** ("Could not open the Mini
  App"). Test auth/payments on the deployed site (othermeapp.com), not a tunnel.
- **Frontend deploy is separate:** `npm run build` then
  `firebase deploy --only hosting`. `--only functions` does not update the site.
- **`@nimiq/core` is ESM-only** → load via dynamic `import()` (functions runtime
  is CommonJS; same pattern as `@google/genai`).
- **gen2 logs:** `firebase functions:log` shows blank bodies; read errors in
  Cloud Logging (`run.googleapis.com/stderr`). The `wrap()` handler now
  `console.error`s failures.

---

## 1. Why

### Current model (MVP)

Credits live in the browser. The purchase path in
[`src/core/credits.ts`](../src/core/credits.ts) is:

1. Client asks the wallet to send a transaction (`payNim` / `payUsdt`).
2. The wallet returns a **transaction hash** the instant it is *submitted* —
   not confirmed.
3. `grant()` immediately adds credits to the `localStorage` ledger.

There is no authentication, no on-chain verification, and no idempotency. The
sequence is **submit → trust the hash → credit locally**.

### Threat model this design closes

| # | Attack | Current outcome | Target |
|---|--------|-----------------|--------|
| A | Edit `localStorage` balance | Free credits | Balance is server-side; client value is display-only |
| B | Replay one tx hash for many grants | No dedup | `txHash` unique → exactly one grant |
| C | Claim a large pack for a tiny/unrelated tx | Trusted blindly | Server matches amount + recipient + reference |
| D | Submit-then-drop (never mined) | Credited anyway | Grant waits for confirmations |
| E | Claim another user's tx to the treasury | Possible | Payer address bound to the authenticated session |
| F | Impersonate a wallet address (no key) | Address = identity, unproven | Signed-challenge login proves ownership |

---

## 2. Decisions locked

- **Persistence + host:** Firebase — **Firestore** for data, **Cloud Functions**
  for the short auth/order/credit handlers. Heavy AI routes
  (`/api/generate-*`) stay on a longer-timeout host (Cloud Run) because they
  hold requests for the length of an image/video generation.
- **Confirmation strategy:** **background reconciler queue**. The client claims
  and returns immediately; a scheduled worker advances orders to `granted`. The
  client watches its order/balance doc over Firestore realtime (`onSnapshot`),
  so neither side polls.

---

## 3. Architecture

Four server responsibilities layered onto the existing handler style (handlers
depend only on `fetch`/env, so they port from the Vite middleware in
[`server/api.ts`](../server/api.ts) to Cloud Functions with minimal change):

1. **Auth service** — challenge issue + signature verify → Firebase session.
2. **Order service** — issues a payment intent binding
   `{ user, pack, method, expectedAmount, reference nonce }`.
3. **Chain reconciler** — scheduled worker; verifies a claimed tx hash against
   its order via public RPC (Nimiq PoS RPC for NIM, Polygon RPC for USDT),
   including confirmation depth.
4. **Ledger** — authoritative balance + append-only entry log, per user.

```
 client (Nimiq Pay WebView)                Firebase
 ─────────────────────────                 ────────────────────────────────
  loginWithNimiq ── challenge ───────────▶ auth/challenge  (Function)
                 ◀── nonce ───────────────
  sign(nonce)   ── verify ───────────────▶ auth/verify     (Function) → session
  createOrder   ── POST /orders ─────────▶ orders          (Function) → orderId
  payNim/payUsdt (native wallet dialog)    ── on-chain ──▶ treasury
  claim         ── POST /orders/:id/claim ▶ orders         (Function) → 'submitted'
                                            reconciler      (scheduled) → 'granted'
  onSnapshot(order) ◀───── realtime ────── Firestore
```

---

## 4. Data model (Firestore)

```
users/{address}
  nimAddress, evmAddress?, createdAt, welcomeGranted: bool, balance: number

orders/{orderId}                     // orderId is the reference nonce
  userId, method: 'nim' | 'usdt', pack, credits,
  expectedAmount,                    // Luna (NIM) or 6-decimal units (USDT)
  expectedRecipient,                 // treasury for that rail
  reference: `${appId}:${orderId}`,  // NIM data tag / USDT match key
  status: 'pending' | 'submitted' | 'confirmed' | 'granted' | 'failed' | 'expired',
  txHash?, payerAddress?, attempts, lastCheckedAt, createdAt, expiresAt

ledger_entries/{address}/entries/{txHash}   // txHash as doc id ⇒ idempotency (B)
  delta, kind: 'welcome' | 'purchase' | 'spend', orderId?, at
```

`users.balance` is maintained inside the same Firestore transaction that appends
a ledger entry, so it never drifts from the sum of entries.

**Security rules:** a user may *read* only their own `users/{address}` and
`orders` where `userId == auth.uid`. No client may *write* ledger or balance
docs — all writes go through Functions with the Admin SDK.

---

## 5. Phase 1 — Authenticated sessions (closes E, F)

Replace "wallet address = identity, unproven" with a signed challenge. The
Nimiq provider exposes `sign(message)` returning `{ publicKey, signature }`.

**Routes**
- `POST /api/auth/challenge` → `{ nonce, expiresAt }`, stored server-side keyed
  by address. Message format:
  ```
  Other Me login
  address: <addr>
  nonce: <nonce>
  issued: <iso8601>
  ```
- `POST /api/auth/verify` → body `{ address, publicKey, signature }`. Server:
  1. Loads and consumes the stored challenge (single use, short TTL).
  2. Verifies the Ed25519 `signature` over the exact challenge with `publicKey`.
  3. Confirms `publicKey` derives to `address`.
  4. Mints a Firebase custom token (uid = address) → client session.

**Dependency:** server uses `@nimiq/core` v2 for `PublicKey` / `Signature` /
`Address` verification (installed; `viem` already covers the EVM side). The
signed-message scheme is **validated (2026-07-22)** against a real device
signature: `SHA-256( utf8( "\x16Nimiq Signed Message:\n" + byteLength + message ) )`,
Ed25519-verified, address derived from the public key — see
`firebase/functions/src/auth/nimiqSignature.ts`.

**Client** (`core-modules/src/modules/auth/nimiqAuth.ts`,
`otherme-app/src/core/auth.ts`): after `listAccounts()`, fetch a challenge,
`nimiq.sign(challenge)`, POST to `/verify`, store the session token, attach it
to every `/api/*` call. This realizes the "MVP note" already written in the
`loginWithNimiq` docstring.

---

## 6. Phase 2 — Server-side ledger (closes A)

- `GET /api/credits/balance` → authoritative `{ balance, history }`.
- `POST /api/credits/spend` → `{ amount, kind }`, atomic check-and-decrement.
  **Spends must be authoritative too** — the AI routes (`/api/generate-*`)
  debit server-side (or require a spend-receipt token) so a render cannot occur
  without a matching debit.
- Welcome grant (`WELCOME_CREDITS`) becomes first-session server-side, guarded
  by `users.welcomeGranted` (closes the "reset localStorage for more welcome
  credits" hole).

`credits.ts` keeps its `useSyncExternalStore` shape but becomes a cache of
server state; `localStorage` is at most an offline display cache, never
authoritative.

---

## 7. Phase 3 — Payment intents (closes C)

Before payment, client calls `POST /api/orders { pack, method }`. Server
computes `expectedAmount` **itself** (its own rate fetch for NIM — never trust a
client amount or rate) and returns `{ orderId, reference, expectedAmount, treasury }`.

- **NIM:** `payNim(amount, reference)` already tags the tx with
  `${appId}:${reference}`. Set `reference = orderId` so the on-chain data field
  carries the order nonce. Amount tolerance: freeze the rate into the order for
  its short TTL and require exact, or verify `onchainValue >= expectedAmount`
  with a small (~1%) drift tolerance.
- **USDT:** ERC-20 `transfer` has no memo. Bind by
  `(payerAddress from session, to == treasury, amount == expectedAmount, unclaimed)`.
  Make `expectedAmount` unique per order via sub-unit dust (e.g. vary the 6th
  decimal by `orderId % 1000`) to avoid collisions between concurrent orders.

---

## 8. Phase 4 — Background reconciler (closes C, D)

`POST /api/orders/:id/claim { txHash, payerAddress? }` marks the order
`submitted` and returns immediately. A **scheduled Cloud Function**
(Cloud Scheduler → Pub/Sub, ~30–60s cadence) scans `submitted` orders and
verifies:

**NIM (Nimiq Albatross PoS RPC):**
1. `getTransactionByHash(txHash)` exists.
2. `recipient == expectedRecipient` (treasury).
3. `value >= expectedAmount` (per tolerance).
4. decoded `data == reference`.
5. In a finalized/macro block, or `currentHeight − txHeight >= CONFIRMATIONS`.

**USDT (Polygon RPC, `eth_getTransactionReceipt`, decode with `viem`):**
1. Receipt exists and `status == 0x1`.
2. tx `to == USDT contract` (`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`).
3. `Transfer(from,to,value)` log: `to == treasury`, `value == expectedAmount`,
   `from == order.payerAddress`.
4. `currentBlock − receipt.blockNumber >= CONFIRMATIONS`.

Worker keeps `attempts` / `lastCheckedAt`; bounded retries with backoff; marks
`failed` after the confirmation window lapses without a matching confirmed tx.
Only grants past the confirmation depth (reorg-safe).

**Deploy note:** the reconciler needs treasury RPC access in its env. It runs on
a clean network, so the Avast CA workaround in `dev.mjs` does **not** follow it
to Firebase.

---

## 9. Phase 5 — Atomic grant (closes B, D)

On `confirmed`, in one Firestore `runTransaction`:
1. Re-read order; abort if already `granted` (idempotent).
2. Create `ledger_entries/{address}/entries/{txHash}` — txHash-as-doc-id makes a
   replay a no-op create conflict (closes B).
3. Increment `users/{address}.balance` by `order.credits`.
4. Set order `granted`.

Client’s `onSnapshot` on the order/balance doc flips the UI to "Credited"
the instant this commits.

---

## 10. Client changes

| File | Change |
|------|--------|
| `core-modules/src/modules/auth/nimiqAuth.ts` | challenge → `sign` → verify flow |
| `otherme-app/src/core/auth.ts` | session token store; attach to API calls |
| `otherme-app/src/core/credits.ts` | order → pay → claim → realtime refresh; server-authoritative `spend()`; remove local `grant()` |
| `core-modules/src/modules/credits/payUsdt.ts` | return payer `from` address for claim binding |
| new: confirming-state UI | see §12 waiting copy |

---

## 11. Rollout & migration

1. Stand up Firestore + Functions; provision RPC access (Nimiq PoS node/public
   RPC; a Polygon RPC key — Alchemy/Infura/public). Store as Function env
   alongside `GEMINI_API_KEY` / `OPENAI_API_KEY`.
2. Ship auth + read-only server balance behind a flag; **dual-write** (server +
   `localStorage`) for one release to migrate existing local balances (one-time
   import keyed by address, guarded so it cannot be farmed).
3. Flip spends and grants to server-authoritative; `localStorage` becomes
   display-only.
4. Set production treasuries + real prices (replace the ÷100 test values and
   team treasury addresses in [`src/core/config.ts`](../src/core/config.ts)).

---

## 12. Waiting-state UX copy (crypto newcomers)

With server verification, a purchase is no longer instant — there is a short
on-chain confirmation wait (typically **~1 minute**). Many OtherMe users are new
to crypto, so the copy must (a) reassure that their money is safe, (b) explain
*why* there is a wait, and (c) set a time expectation without over-promising.

Keys map to purchase-flow states and follow the app's `COPY = { en, es }`
convention. Placeholders: `{minutes}`, `{txId}`.

### English

```ts
const PAY_COPY_EN = {
  // 1. Native wallet dialog is open
  approve: {
    title: 'Approve the payment',
    body: 'Confirm the payment in your Nimiq Pay wallet to continue.',
  },
  // 2. Tx broadcast, waiting for the network
  submitted: {
    title: 'Payment sent 🎉',
    body: 'Your payment is on its way. The blockchain network is now confirming it — this usually takes about a minute. You can keep this screen open; your credits will appear automatically.',
  },
  // 3. Actively confirming (the main wait) — the "why" for first-timers
  confirming: {
    title: 'Confirming your payment…',
    body: 'Crypto payments are verified by the network instead of a bank, so there’s a short wait while it’s double-checked — usually around a minute. There’s no need to pay again. Just hang tight; your credits will be added the moment it clears.',
    hint: 'Estimated wait: ~1 minute',
  },
  // 4. Taking longer than usual
  slow: {
    title: 'Almost there…',
    body: 'The network is a little busy right now, so this is taking a bit longer than usual — occasionally a few minutes. Your payment is safe and your credits will be added as soon as it’s confirmed.',
  },
  // 5. Done
  granted: {
    title: 'All set! ✨',
    body: 'Your payment is confirmed and your credits have been added.',
  },
  // 6. Could not confirm
  failed: {
    title: 'We couldn’t confirm this payment',
    body: 'If funds left your wallet, they’re safe — you were not charged twice and no credits were lost. Contact support with your transaction ID and we’ll sort it out.',
    txLabel: 'Transaction ID',
  },
  // Optional "why does this take a moment?" explainer
  explainer: {
    title: 'Why the short wait?',
    body: 'When you pay with crypto, the payment is recorded on a public network and checked by many computers rather than a single bank. That check takes a moment — usually about a minute — and it’s what keeps the payment secure and final.',
  },
}
```

### Spanish

```ts
const PAY_COPY_ES = {
  approve: {
    title: 'Aprueba el pago',
    body: 'Confirma el pago en tu monedero Nimiq Pay para continuar.',
  },
  submitted: {
    title: 'Pago enviado 🎉',
    body: 'Tu pago está en camino. La red blockchain lo está confirmando — esto suele tardar alrededor de un minuto. Puedes dejar esta pantalla abierta; tus créditos aparecerán automáticamente.',
  },
  confirming: {
    title: 'Confirmando tu pago…',
    body: 'Los pagos con cripto los verifica la red en lugar de un banco, así que hay una breve espera mientras se comprueba — normalmente cerca de un minuto. No necesitas pagar de nuevo. Solo espera un momento; tus créditos se añadirán en cuanto se confirme.',
    hint: 'Espera estimada: ~1 minuto',
  },
  slow: {
    title: 'Ya casi…',
    body: 'La red está un poco ocupada ahora mismo, así que está tardando un poco más de lo normal — a veces unos minutos. Tu pago está seguro y tus créditos se añadirán en cuanto se confirme.',
  },
  granted: {
    title: '¡Listo! ✨',
    body: 'Tu pago está confirmado y tus créditos ya se añadieron.',
  },
  failed: {
    title: 'No pudimos confirmar este pago',
    body: 'Si salió dinero de tu monedero, está seguro — no se te cobró dos veces ni se perdieron créditos. Contacta con soporte con tu ID de transacción y lo resolvemos.',
    txLabel: 'ID de transacción',
  },
  explainer: {
    title: '¿Por qué esta breve espera?',
    body: 'Cuando pagas con cripto, el pago queda registrado en una red pública y lo verifican muchas computadoras en vez de un solo banco. Esa comprobación tarda un momento — normalmente cerca de un minuto — y es lo que mantiene el pago seguro y definitivo.',
  },
}
```

**UI behavior**
- Show `submitted` → `confirming` immediately after the wallet returns a hash.
- Escalate `confirming` → `slow` after ~90s without a grant.
- Drive transitions from the Firestore `onSnapshot` on the order doc, not a
  client timer (the timer only decides when to *show* `slow`).
- Never block the whole app: the user can navigate away and come back; the
  balance reconciles from the server.

---

## 13. Edge cases

- **Abandoned / expired order:** TTL orders, but a late tx that matches by
  reference/txHash should still reconcile (grace re-open) — expiry alone must
  not grant, and must not lose a user's funds.
- **Rate drift (NIM):** freeze rate into the order, or `>=` with tolerance (§7).
- **Reorgs:** confirmation depth is the mitigation; grant only past it.
- **Underpayment:** `failed`, surface to user. **Overpayment:** grant the pack,
  log the excess for manual credit.
- **One tx claimed across two orders:** `txHash` unique across the whole ledger,
  not per order.
- **Spam:** rate-limit `/challenge` and `/orders` per address.

---

## 14. Post-competition / future (out of scope for Phases 1–5)

Phases 1–5 are deliberately **wallet-anchored**: identity is proven by a Nimiq
signature and credits are bought with NIM/USDT inside Nimiq Pay. The items below
are a separate, post-competition workstream for a **browser-distributed** build
and are intentionally not part of the current plan.

- **Email/Google users are demo-only today** — client-side `localStorage`
  accounts with no backend, no server ledger, no verification
  (`emailAuth.ts` is marked "NOT PRODUCTION AUTH"; Google is decoded client-side
  only). They are not covered by the server-side security model.
- **Gmail (Google) login — production.** Move to server-side verification: send
  the Google ID token to the backend, verify its signature, mint a Firebase
  session, and give these users their own server ledger (same shape as wallet
  users). Also needs the external-browser redirect flow (Google blocks OAuth in
  WebViews).
- **PayPal payments.** Currently `paypalEnabled: false` and **prohibited inside
  Nimiq Pay** by the competition rules. For the browser-distributed version,
  enable PayPal as the credit-purchase rail for non-wallet (email/Google) users,
  with server-side capture verification (the PayPal analog of the on-chain
  reconciler) before granting credits.
- Net effect: two parallel secured cohorts — wallet users (NIM/USDT, on-chain
  verified) and browser users (Google login, PayPal verified) — sharing the same
  server ledger.
