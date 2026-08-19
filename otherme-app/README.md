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
| `/login` | Nimiq wallet (primary) / real email+password / Google | — |
| `/credits` | Balance, USDT/NIM top-up, history | login required |
| `/profile` | Linked identities, account linking (pairing code), unlink, UID + copy button (for promotions) | login required |
| `/promos_management` | Grant credits to an arbitrary address (contest prizes, support credits) | admin only (custom claim) |

Character sheets and custom avatars sync to Firestore + Storage once signed
in, with localStorage as a read-through cache (`src/character/library.ts`,
`src/roleplay/avatarLibrary.ts`). Scene and video galleries are still
IndexedDB-only (`src/core/mediaStore.ts`) — cloud sync for those is staged
for later (see item 4 below).

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
Prices are live early-bird production prices — see `src/core/config.ts`.
Treasury addresses are still the shared team test pair, not yet swapped for
production ones.

## Roadmap — from 1 Aug 2026 (after the competition)

Ordered by priority. Items 1–3 are the ones that cost users money or data today.

### 1. Link a wallet and an email into one account — ✅ shipped

Email/Google are now real Firebase Auth identities (`src/core/authProviders.ts`),
not localStorage stubs. `/profile` lets a signed-in user generate a short-lived
pairing code (`functions/src/account/link/start`) and redeem it from a second
account (`link/redeem-preview` → `link/commit`) — preview-before-commit, so the
user sees the merge math before it's irreversible. The merge transaction
(`functions/src/account/store.ts`) subtracts an already-granted welcome bonus
before folding balances, so linking can't be used to farm welcome credits
across throwaway accounts. Unlink requires a fresh re-authentication
(`requireFreshUid`, Firebase's `auth_time` within 5 minutes) and revokes both
sides' refresh tokens.

**Bug fixed 19 Aug 2026, confirmed working:** linking merged balances
server-side, but re-logging in with the wallet that got folded away didn't
actually land you back on the shared account — only the email/Google re-login
path resolved through `identity_links`, the wallet's challenge/verify didn't.
Fixed in all three places that needed it (server + both client login paths);
balances and cloud-synced character sheets are now correctly shared across
linked accounts either way you sign in.

Deferred by design, not forgotten: reversing a balance merge (one-way,
support-assisted if it ever comes up), and self-service recovery when the
canonical factor is lost and nothing was ever linked.

### 2. Rate limiting and abuse protection

`functions/src/shared/rateLimit.ts` exists now (generic, Firestore-backed) but
is only wired into the account-linking endpoints so far. `/api/auth/challenge`
and `/api/orders` are still unbounded per caller, and the expensive AI routes
(`/api/generate-video`, `/api/generate-avatar`) still have no `requireUid` at
all, so they spend our OpenAI/Gemini quota anonymously. Welcome credits can
also still be farmed by clearing storage on first signup (before any linking),
since `welcomeGranted` only guards wallet accounts.

### 3. Don't lose a paid order on a failed claim

`claimServerOrder` is fire-and-forget (`src/core/credits.ts`) — HTTP status is
never checked, so if the claim call fails *after* the user's on-chain payment
succeeded, the order sits `pending` until the 30-minute TTL sweep and the credits
never arrive. Needs a retry with backoff and a recovery path keyed on the tx hash.

### 4. Move saved work off the device — ✅ Stage 1 shipped, Stage 2/3 open

Character sheets and custom avatars now sync to Firestore + Storage
(`src/character/library.ts`, `src/roleplay/avatarLibrary.ts`) whenever a
server session exists, with localStorage kept as a read-through cache — no
UI changes needed, and fully local-only behavior is unchanged when logged
out. Reconciliation runs once per login (`App.tsx`'s `useCloudMediaSync`).

**Still open, staged deliberately**: scenes (Stage 2) and videos (Stage 3) are
still IndexedDB-only. Videos are last on purpose — highest storage cost, and a
`SavedVideo.interactionId` ties a saved video to a live Gemini Interactions
API session that isn't durable across devices or time, so a synced-then-
reloaded video needs a "start fresh" fallback rather than assuming it's always
editable.

### 5. Gasless USDT via a meta-transaction relayer

So users don't need POL for gas. Mini apps don't get Nimiq Pay's own gas
abstraction; confirmed limitation and full design in
[docs/usdt-gas-abstraction.md](docs/usdt-gas-abstraction.md).

### 6. Live microphone inside Nimiq Pay — ✅ closed, no further action

Blocked on the wallet: `getUserMedia` fails there with `NotReadableError`, so we
ship Web Speech dictation as a turn-based fallback (see the root README).

**Reproduced twice on-device** (2026-07-28, two separate runs, Samsung Fold 5 /
Android 16, WebView Chrome 150) via `public/audio-check.html`. Both runs:
`NotReadableError` with `permissions.query` reporting **`prompt`, not `denied`**,
one audio input with an empty label — and `SpeechRecognition` succeeding in the
same session. Since the system speech service can capture while the WebView
cannot, the gap is Nimiq Pay's own Android mic grant, not the WebView bridge.

The two reports, the `WebChromeClient.onPermissionRequest` snippet, and the
iOS/WKWebView equivalent were the only outstanding work here — closed 19 Aug
2026, no code change needed.

### 7. Terms & conditions — ✅ shipped, one optional item left

Live at `/terms` (`public/terms/index.html`, static — no SPA rewrite involved)
and linked from the Landing footer. Now bilingual: a pill toggle (matching the
app's `.icon-chip` styling) switches every section between English and
Spanish, persisting to the same `localStorage['otherme:lang']` key the React
app uses. Legal review of the content is accepted as-is (Lucas's call, not
blocking).

Still optional, not scheduled: a first-purchase acceptance checkpoint recorded
server-side, if ever needed.

**Known content drift, flagged not fixed**: a few sections (account linking,
where character data lives) still describe the state *before* item 1 and item
4 shipped — worth a content pass before the next `/terms` update, since it's a
legal-accuracy call, not a translation one.

### 8. Smaller items found along the way

- **Verify `cleanupShares` actually deletes.** It has a silent failure mode: if
  the runtime service account lacks `storage.objects.delete`, the job logs an
  error and reports `deleted: 0` while appearing healthy. Force one run from
  Cloud Scheduler and read `[cleanupShares]` in `run.googleapis.com/stderr`.
- **Don't build "record audio in-app" on the `capture` attribute.** On-device,
  the Nimiq Pay WebView **ignores** `<input type="file" accept="audio/*" capture>`
  and opens the ordinary file chooser, so the realistic flow is "pick an existing
  audio file", not "record now". Dictation is the better path.
- Real Node host for `server/api.ts` handlers (they only use fetch/env, so
  they're portable).
- Single-source the pricing/treasury constants duplicated in `src/core/config.ts`
  and `functions/src/config.ts` (each has its own "KEEP IN SYNC" comment today).
  Real build-tooling work — the client is Vite-bundled, the server a separately
  deployed Functions package — not a quick fix.

Done since the last revision of this list: on-chain tx verification before
granting credits, signed-challenge wallet login, production prices, automatic
deletion of share-link files, Web Speech dictation as the in-wallet voice
fallback, the credits-per-sign-in-method disclosure, real Firebase Auth for
email/Google, account linking (item 1), cloud sync for character sheets +
avatars (item 4, Stage 1), a Spanish translation + EN/ES toggle for `/terms`
(item 7), an admin-gated credit-grant endpoint + `/promos_management` page for
contest/promo payouts, a UID-with-copy row on `/profile`, pinning
`@nimiq/mini-app-sdk`, fixing the language-frozen login redirect notices,
persisting the mic error to `sessionStorage` so `audio-check.html` can read
it, and fixing linked accounts not actually sharing a session on wallet
re-login (item 1's real-world completion).
