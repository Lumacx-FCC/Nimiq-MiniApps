# Other Me — Nimiq Pay Mini App

Create cinematic character sheets from a photo, then talk to your characters
as live voice avatars. Credits are purchased with **USDT (Polygon)** or
**NIM (+50% bonus)** through the Nimiq Pay wallet.

## Modules

| Route | Module | Access |
|---|---|---|
| `/` | Landing (mockup: `App - Other Me/Official/Other Me Landing.PNG`); logged-in users get a character gallery with Scene/Video/Talk actions | public |
| `/create` | Character Creator — cascade flow, AI analysis, render-style selector, gpt-image-2 sheet render | 5 free renders, then login |
| `/scenes` | Scene Creator — gpt-image-2 with character identity reference | login; 5 free, then 5 credits |
| `/videos` | Video Creator — gemini-omni-flash (Interactions API), 3 free conversational edits per clip | login; 100 credits |
| `/talk` | Avatar Studio — Gemini Live voice, lip-synced sprites | login; 1 credit/min, 3/sprite |
| `/login` | Nimiq wallet (primary) / email | — |
| `/credits` | Balance, USDT/NIM top-up, history | login required |

Scene and video galleries persist in IndexedDB; character sheets in
localStorage (`src/core/mediaStore.ts` / `src/character/library.ts` are the
Firebase migration seams).

Light/dark theme and EN/ES language toggles are available on every page.

Auth and payments come from the shared [`../core-modules`](../core-modules)
package (framework-agnostic providers imported via the `@core` alias; thin
React bridge in `src/core/`).

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your keys
npm run dev                  # binds --host on port 5174
```

`.env.local` (git-ignored, never commit keys):
- `GEMINI_API_KEY` — character analysis + Gemini Live voice tokens
- `OPENAI_API_KEY` — sheet images + talking sprites (gpt-image-2)

All AI calls go through Vite server middleware (`server/api.ts`); no key ever
reaches the browser.

## Phone testing (Nimiq Pay)

LAN is blocked on our machines — use a Cloudflare quick tunnel:

```bash
cloudflared tunnel --url http://localhost:5174
```

Open the tunnel URL in Nimiq Pay → Mini Apps. Testnet NIM: long-press the
Nimiq Pay settings button 10s → switch to Testnet → "Get free NIM".
Prices are at TEST levels (÷100) — see `src/core/config.ts`.

## Roadmap — from 1 Aug 2026 (after the competition)

Ordered by priority. Items 1–3 are the ones that cost users money or data today.

### 1. Link a wallet and an email into one account

**The problem.** Identity is `AuthUser.id` — the Nimiq address for wallet login,
the email for email login ([`core-modules/.../auth/types.ts`](../core-modules/src/modules/auth/types.ts)) —
and the credits key is `otherme:credits:<id>` (`src/core/credits.ts`). So a
balance bought in Nimiq Pay does **not** appear when the same person signs in by
email on desktop. Worse, email accounts aren't server accounts at all:
`emailAuth.ts` stores them in localStorage, so an email account created on a
phone doesn't exist on a desktop, and clearing site data destroys its balance.

**The fix**, exploiting the fact that a Firebase custom token can carry any uid —
so the ledger stays keyed by the wallet address and email login resolves to it:

1. Promote email/Google to real Firebase Auth identities (currently localStorage
   stubs). This is the bulk of the work.
2. Profile screen, wallet session: "Link a desktop login" → server issues a
   single-use, short-TTL code bound to the address.
3. Desktop: sign in by email, enter the code → server writes
   `users/{address}.linkedUids` plus a reverse `identity_links/{uid}` map.
4. Later email logins call `/api/account/resolve` → server mints a custom token
   with **uid = the wallet address** → same ledger, orders, and history.
5. Fold any local email-account balance in at link time via the existing one-time
   `/api/credits/migrate` path (respect `MAX_IMPORT`).

**Security:** linking grants access to a money balance. The code must be
single-use, short-lived, and rate-limited, and unlinking should require
re-authentication. Do item 2 first.

### 2. Rate limiting and abuse protection

There is none anywhere in `functions/` — a known gap
([`docs/server-side-credits.md`](docs/server-side-credits.md) §Spam).
`/api/auth/challenge` and `/api/orders` are unbounded per caller, and the
expensive AI routes (`/api/generate-video`, `/api/generate-avatar`) have no
`requireUid` at all, so they spend our OpenAI/Gemini quota anonymously. Welcome
credits can also be farmed by clearing storage, since `welcomeGranted` only
guards wallet accounts.

### 3. Don't lose a paid order on a failed claim

`claimServerOrder` is fire-and-forget (`src/core/credits.ts`) — HTTP status is
never checked, so if the claim call fails *after* the user's on-chain payment
succeeded, the order sits `pending` until the 30-minute TTL sweep and the credits
never arrive. Needs a retry with backoff and a recovery path keyed on the tx hash.

### 4. Move saved work off the device

Character sheets and avatars are in localStorage, scenes and videos in IndexedDB
— all lost when a user clears site data or switches device. The seams are
`src/character/library.ts` and `src/roleplay/avatarLibrary.ts`.

### 5. Gasless USDT via a meta-transaction relayer

So users don't need POL for gas. Mini apps don't get Nimiq Pay's own gas
abstraction; confirmed limitation and full design in
[docs/usdt-gas-abstraction.md](docs/usdt-gas-abstraction.md).

### 6. Live microphone inside Nimiq Pay

Blocked on the wallet: `getUserMedia` fails there with `NotReadableError`, so we
ship Web Speech dictation as a turn-based fallback (see the root README). Needs
Nimiq Pay to grant its WebView a working `RECORD_AUDIO`;
`public/audio-check.html` produces the exact on-device error report to send them.

### 7. Terms & conditions

[`docs/terms-and-conditions.md`](docs/terms-and-conditions.md) is drafted and
factually accurate but needs legal review of the `[…]` placeholders, a Spanish
translation, and wiring into the app as a `/terms` route plus footer link.

### 8. Housekeeping

- Pin `@nimiq/mini-app-sdk` — currently `"latest"` against a 0.x package.
- Real Node host for `server/api.ts` handlers (they only use fetch/env, so
  they're portable).

Done since the last revision of this list: on-chain tx verification before
granting credits, signed-challenge wallet login, production prices and
treasuries, and automatic deletion of share-link files.
