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

Character sheets, custom avatars, scenes, and videos all sync to Firestore +
Storage once signed in, with localStorage/IndexedDB kept as a read-through
cache (`src/character/library.ts`, `src/roleplay/avatarLibrary.ts`,
`src/core/mediaStore.ts` — see item 4 below).

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

### 2. Rate limiting and abuse protection — ✅ shipped

`functions/src/shared/rateLimit.ts` (generic, Firestore-backed) is now wired
into `/api/auth/challenge` (per address), `/api/orders` create + claim (per
uid), the AI generation routes (`/api/analyze-character`, `/api/generate-sheet`,
`/api/generate-avatar`, `/api/generate-video`, `/api/gemini-token`, `/api/share`
— keyed on uid when logged in, else IP via `app.set("trust proxy", true)`, one
shared scope across all six so a script can't dodge the cap by spreading calls
across routes), new-account creation on `/api/account/resolve` (per IP, only
when a brand-new `users/{uid}` doc is about to be created — an existing user
logging back in is never rate-limited), and `/api/credits/record-purchase`
(per uid). The AI routes deliberately stay `requireUid`-free — that would
remove the anonymous 5-free-renders flow, a product decision, not a gap.

Welcome credits are no longer farmable on the email/Google path either: the
grant is now gated on Firebase's `email_verified` claim for the `email`
provider (`nimiq`/`google` are unaffected — Google sign-in is pre-verified,
and a wallet is already hard to mass-produce) — see
`functions/src/credits/store.ts`'s `migrateBalance`.

### 3. Don't lose a paid order on a failed claim — ✅ shipped

`claimServerOrder` (`src/core/credits.ts`) now checks the response and throws
instead of silently swallowing a failure. `runServerPurchase` retries the claim
up to 4 times with backoff (1s/2s/4s); if every attempt still fails, the claim
(`orderId`/`txHash`/`payerAddress`) is persisted to `localStorage`
(`otherme:pending-claims`) and automatically retried on the next session
restore, instead of being lost until the 30-minute TTL sweep silently expires
the order.

`recordPurchase` (the Phase-2 client-trusting purchase grant) is also hardened:
it no longer trusts the client's `credits` number outright — a USDT amount is
matched against a real pack via `findPack`, and a NIM credits value must equal
one of the known bonus-adjusted pack tiers. Kept alive (not retired) for the
`NIM_SERVER_VERIFIED` rollback path, but no longer an arbitrary-value grant.

### 4. Move saved work off the device — ✅ Stage 1/2/3 all shipped

Character sheets and custom avatars (Stage 1, 18 Aug), then scenes and videos
(Stage 2/3, 20 Aug) all sync to Firestore + Storage
(`src/character/library.ts`, `src/roleplay/avatarLibrary.ts`,
`src/core/mediaStore.ts`) whenever a server session exists, with
localStorage/IndexedDB kept as a read-through cache — no UI changes needed for
any caller, and fully local-only behavior is unchanged when logged out.
Reconciliation runs once per login (`App.tsx`'s `useCloudMediaSync`).

`SavedVideo.interactionId` (the live Gemini Interactions API session backing
conversational edits) turned out to need no special cross-device handling —
confirmed by reading the actual code: saved gallery items never expose an edit
affordance at all (editing only ever happens on the just-generated clip,
before it's saved), so a synced video's `interactionId` is already purely
inert metadata once saved.

**Real bug found shipping this, fixed same day**: a synced item's image/video
field becomes a Storage download URL once pulled from the cloud (instead of
the local `data:` URL it started as) — `Scenes.tsx`/`Videos.tsx`/
`RoleplayStudio.tsx` all built AI-generation reference payloads by splitting a
`data:` URL directly, which silently produced `base64: undefined` for a
Storage URL. Fixed with a new `ensureDataUrl()` helper
(`src/core/referenceUtils.ts`) that fetches + re-encodes a remote URL back to
`data:` before use. That fetch then surfaced a **second**, infra-level gap:
Cloud Storage buckets have no CORS policy by default, so the browser blocked
the fetch with a generic "Failed to fetch" — fixed by setting a CORS policy
on the `otherme-18f5b.firebasestorage.app` bucket (GET only, scoped to
`othermeapp.com` + the Firebase default hosting domains + localhost dev; no
code, a one-time Cloud Console / `gsutil cors set` config step, not tied to
this repo's deploy pipeline).

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

### 9. PayPal for non-wallet users — ✅ SHIPPED & CONFIRMED (Parts A + B)

Scope resolved directly by Lucas (20 Aug): PayPal checkout should be
**hidden for wallet sign-ins and shown for any non-wallet sign-in (email or
Google)** — a runtime gate on `user.provider`, not a separate build, since
this targets full production rather than the (already-closed) competition.

**Part A — real checkout.** The Credits page (`Credits.tsx`) is a nav-driven
toggle: nothing shows below the balance card until "Buy Credits with NIM" /
"Buy Credits with Card" / "Credits History" is clicked, with nudge banners
letting a user swap between NIM and Card modes. Selecting one of 3 package
images renders that pack's real PayPal Hosted Button
(`core-modules/.../payPaypal.ts`'s `renderHostedButton`, a script-loader
mirroring `googleAuth.ts`'s `loadGis()`) only after an audit-trail server
order is confirmed created (`OrderMethod` recognizes `"paypal"`, priced off a
`REGULAR_PACKS` since Card packages don't get the early-bird discount) —
rendering it unconditionally was the first cut, until a real test proved a
payment could go through with nothing server-side to match it against.
Navigation guards: no linked wallet → guided to `/profile` instead of Top
Up; unverified email (or a wallet-signed-in user with no active email
identity) → guided via a popup instead of entering Card mode.

**Part B — server-side crediting, via `functions/src/paypal/`**: an OAuth2
token helper, webhook signature verification, and a payer-email-match grant
reusing the same atomic `claimOrder`/`grantOrder` path NIM/USDT use. A real
webhook-routing surprise: Hosted Buttons transactions report through a
separate, auto-provisioned **"NVP SOAP Webhooks"** app in the PayPal
dashboard, not either visible REST app under "Apps & Credentials" — found
after two dead-end registrations showed zero events. Unmatched payments log
to `paypal_unmatched_events` for a manual grant via `/promos_management`
rather than being guessed.

**Confirmed live**: multiple real PayPal test purchases auto-granted the
correct credits end to end, visible immediately in Credits History (which
itself went through a real fix — see item 10 below).

### 10. "Purchases" showed nothing for server-verified buys — ✅ fixed

Found while confirming a PayPal grant: `getBalance`
(`functions/src/credits/store.ts`) has always returned the last 25 ledger
entries on every `/api/credits/balance`/`/api/credits/migrate` response —
this was true for NIM/USDT too, just never read client-side. `adoptServerBalance`
(`src/core/credits.ts`) now maps that `history` field into local state, which
retroactively surfaced every past purchase (including 3 real PayPal ones)
with zero backfill needed — the ledger entries were already correct, only
the read was missing. Renamed "Purchases" → "Credits History" and broadened
it to show every ledger kind (welcome/migrate/promo/spend/link-merge), not
just purchases, sorted newest-first.

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
it, fixing linked accounts not actually sharing a session on wallet
re-login (item 1's real-world completion), single-sourcing the pricing/
treasury constants into `functions/src/sharedPricing.ts`, rotating the
production treasury addresses off the pair that had been publicly labeled
"test" in the repo's history, rate limiting across the previously-unbounded
routes (item 2), the order-claim retry/persistence fix (item 3), cloud sync
for scenes and videos (item 4, Stage 2/3), the cross-device reference-image
fix + Storage bucket CORS config that shipping Stage 2/3 surfaced, the
Credits page's nav-driven toggle redesign with real PayPal checkout and
server-side webhook crediting (item 9, Parts A + B — 4.7 fully closed), and
the server-side purchase history the client was never reading (item 10).
