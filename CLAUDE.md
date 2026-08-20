# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Nimiq Mini Apps Competition entry (Cycle I: July 6–30, 2026). Mini apps must run inside the Nimiq Pay wallet WebView, integrate NIM and/or USDT payments as core UX, and live in a public MIT repo with no committed secrets. See `NIMIQ-HACKATHON-REFERENCE.md` for rules/scoring and `.claude/skills/mini-apps/` for the official Nimiq provider APIs.

Two codebases:

- **`otherme-app/`** — the competition app "Other Me" (Vite + React 18 + TS + Tailwind 3, port 5174). Character sheet creation, scene images, video clips, and live-voice talking avatars, paid with a shared credits balance.
- **`core-modules/`** — reusable FCC foundation (Vite + Vue 3, port 5173, demo app included). Auth (Nimiq wallet primary), credits purchasing (USDT on Polygon via viem / NIM with +50% bonus), Nimiq design tokens.

`App - Other Me/`, `Character Sheet v1/`, `reference/` (gitignored) hold design assets and source material, not running code.

## Commands

```bash
# otherme-app (needs Node 18; Vite 5 is pinned for that reason)
cd otherme-app
npm install            # .npmrc sets strict-ssl=false (Avast TLS interception on this machine)
npm run dev            # runs dev.mjs -> vite --host on 5174 (see TLS note below)
npm run build          # tsc --noEmit && vite build — use `npx tsc --noEmit` as the typecheck

# functions/ unit tests (money-critical ledger logic only — see below)
cd otherme-app/functions && npm test

# core-modules demo
cd core-modules && npm run dev   # 5173

# Phone testing inside Nimiq Pay (LAN blocked by GPO firewall — always tunnel)
cloudflared tunnel --url http://localhost:5174   # exe: C:\Program Files (x86)\cloudflared\
```

`functions/` has a minimal `vitest` harness (its own `vitest.config.ts`, deliberately not inheriting `otherme-app/vite.config.ts`) covering the money-critical ledger idempotency (`credits/store.test.ts`) and `resolveCanonicalUid` (`auth/store.test.ts`) against a small in-memory Firestore fake — no emulator needed. Test files are excluded from the production `tsc` build (`tsconfig.json`'s `exclude`). This is deliberately narrow, not broad coverage — everything else (the React client, end-to-end auth flows, most of `functions/`) is still verified manually (browser + phone in Nimiq Pay).

## Machine-specific TLS setup (do not remove)

Avast SSL scanning re-signs all HTTPS on this machine, breaking both npm and runtime `fetch` with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`:

- `otherme-app/.npmrc` (`strict-ssl=false`) fixes installs.
- `otherme-app/dev.mjs` sets `NODE_EXTRA_CA_CERTS=local-tls-ca.pem` (Avast root CA exported from the Windows cert store, git-ignored) before spawning Vite so server-side AI calls work. If `local-tls-ca.pem` is missing, re-export the "Avast Web/Mail Shield Root" cert from `Cert:\CurrentUser\Root` as base64 PEM.

Neither is needed on a clean network.

## otherme-app architecture

### Server side: Vite middleware, not a separate backend

`server/api.ts` is a Vite plugin (`configureServer`) exposing all AI proxy routes; API keys live in git-ignored `.env.local` (`GEMINI_API_KEY`, `OPENAI_API_KEY`) and never reach the browser. All request/response bodies are JSON with base64 media — no multipart. Routes:

- `POST /api/analyze-character` — Gemini vision → 30-field character sheet (structured JSON schema)
- `POST /api/generate-sheet` — OpenAI `gpt-image-2`; with `referenceImages` (max 3) it uses the edits endpoint (`image[]` array) for identity fidelity, else generations. Shared by the character studio AND the scenes module.
- `POST /api/generate-avatar` — 3×2 talking-sprite sheet (chroma-green matte, client removes it) + roleplay personality via OpenAI
- `POST /api/gemini-token` — ephemeral token so the browser can open Gemini Live directly (low latency voice)
- `POST /api/generate-video` — `gemini-omni-flash-preview` via the **Interactions API** (requires `@google/genai` >= 2.x; video comes back as base64 mp4 inside `interaction.steps[].content`). `previousInteractionId` enables conversational edits; the client caps them at 3.
- `POST /api/share` (raw bytes + `X-Filename` header) / `GET /api/share/:id` — temporary in-memory file share (30-min TTL) backing the WebView download fallback below.

**`server/api.ts` only covers the AI/media routes above.** Auth, credits, orders, and account-linking routes (`/api/auth/*`, `/api/credits/*`, `/api/orders/*`, `/api/account/*`) exist **only** in `functions/src/index.ts` — there is no local-dev equivalent. Any change to those routes can only be verified by deploying and testing against the live project (`othermeapp.com` or the Cloud Function URL directly); `npm run dev`'s local server will 404 on them. This is intentional, not a gap to fix — see "Backend changes" under Verification below.

### Server-side auth & account linking (`functions/src/auth/`, `functions/src/account/`)

- `functions/src/auth/store.ts` — `ensureUser`/`ensureAccountUser` create the `users/{uid}` profile (idempotent; also backfill a missing `provider` field — see the doc comment on `ensureUser`, it races with `credits/store.ts`'s `migrateBalance`, whichever runs first doesn't know the other's data). `mintSessionToken(uid, provider)` mints the custom token every login path exchanges via `signInWithCustomToken`; the `provider` custom claim is cosmetic only (nothing reads it) but kept accurate for humans reading Firestore.
- `POST /api/account/resolve` (`functions/src/auth/routes.ts`) — the email/Google login path's equivalent of the wallet's challenge/verify: client sends its native Firebase ID token, server resolves it to the canonical uid via `identity_links` (a no-op until that uid has been linked), ensures the profile exists, and mints a canonical session token. Called from `otherme-app/src/core/session.ts`'s `resolveServerSession()`, itself called from `otherme-app/src/core/authProviders.ts` after every real Firebase sign-in.
- **Every login path must resolve through `identity_links` before minting a session token, not just `/account/resolve`.** `handleAuthVerify` (the wallet's challenge/verify) does this too now — it didn't originally, a real bug found 19 Aug 2026: a wallet folded into another account via linking would sign back into its own now-empty account instead of the shared canonical one, since only the email/Google path resolved canonical on re-login. If a new login path is ever added, resolve canonical before `mintSessionToken`, and reconcile the client's local `AuthUser` identity to the *returned* uid afterward (`session.ts`'s `establishServerSession()`/`authProviders.ts`'s `finishLogin()` both do this — read the actual post-sign-in session, never the pre-resolve uid).
- `functions/src/account/` — pairing-code account linking. `POST /link/start` (rate-limited, generates a code) → `POST /link/redeem-preview` (the other account previews the merge math, commits nothing) → `POST /link/commit` (the actual balance-merge transaction, mirrors `credits/store.ts`'s `spend`/`recordPurchase` read-everything-then-write-together shape) → `POST /unlink` (requires `requireFreshUid` — Firebase's `auth_time` claim within the last 5 minutes, not just a valid token). **`unlinkAccount` revokes the canonical uid's own refresh tokens as part of unlinking** — the client (`accountLink.ts`) must force a token refresh (`getIdToken(true)`) right after, or its next API call spuriously 401s on the now-stale cached token; this cost real debugging time once, don't reintroduce it.
- `functions/src/shared/rateLimit.ts` — generic Firestore-backed fixed-window limiter, currently wired only into the link endpoints above. Retrofitting it onto `/api/auth/challenge`/`/api/orders`/the AI routes is a known separate gap (nothing calls it there yet).
- The merge transaction subtracts an already-granted welcome bonus from the folded-in account before adding balances (`account/store.ts`'s `previewLinkCode`/`commitLink`) — without that, linking is a repeatable free-credit farm. Don't remove it.

### Admin-only credit grants (`functions/src/admin/`)

- `grantPromo(address, credits, note, dedupeKey)` in `functions/src/credits/store.ts` writes a `"promo"` ledger entry through the same transaction shape as `recordPurchase()`/`grantOrder()` — idempotent by a caller-supplied `dedupeKey`, so retrying the same grant is a safe no-op instead of double-crediting. Built for contest-prize payouts (backlog Tier 0.1) but generically reusable for any one-off grant.
- Gated by `requireAdmin` (`functions/src/auth/requireAuth.ts`), which checks an `admin: true` custom claim — the **only** way to get it is running `functions/scripts/set-admin-claim.mjs <uid>` once by hand (needs Application Default Credentials for the project); nothing in the app grants it, and there's no UI for custom claims.
- `POST /api/admin/grant-credits` (`functions/src/admin/routes.ts`) is the only route this claim gates. Client side: `src/core/admin.ts` (`isAdmin()`, `grantCredits()`) and `src/pages/PromosManagement.tsx` (`/promos_management`) — a form gated on the claim, force-refreshing the ID token on load so a claim granted moments earlier shows up without a full re-login. `AppHeader.tsx` shows a shield-icon link to it only when `isAdmin()` (unforced/cached check) resolves true.

### Nimiq Pay WebView limitations (confirmed on-device)

The wallet's Android WebView supports **no file downloads** (no download listener, no Web Share API) and **no microphone** (`getUserMedia` permission is not forwarded). Consequences baked into the code — don't undo them:

- Every file export must go through `shareOrDownloadBlob` in `src/character/library.ts`: Web Share → WebView fallback (`POST /api/share` + copy-link overlay, opened in a real browser) → anchor download. WebView detection = `\bwv\b` in the user agent.
- Gemini Live sessions survive mic failure (user types, avatar speaks) instead of tearing down.
- localStorage is ~5 MB total: character sheet images are compressed to 1024px WebP before saving (`compressImageDataUrl`), avatar sprites are stored as WebP-with-alpha, and persist failures must be surfaced to the user (silent quota failure looks like "saved" but vanishes on reload).

### Client structure

- `src/core/` — React bridge over core-modules. `config.ts` calls `configure()` (must be imported first — `main.tsx` does) and defines all pricing constants. `auth.ts`/`credits.ts` re-implement only the thin Vue composables as `useSyncExternalStore` stores while importing the framework-agnostic provider logic from `@core/*` (alias to `../core-modules/src/modules`, wired in both `vite.config.ts` and `tsconfig.json`). Same localStorage keys as the Vue version.
  - `src/core/authProviders.ts` — real Firebase Auth for email/Google, **otherme-app-specific, not core-modules**: `core-modules` has zero Firebase dependency and is shared with the framework-agnostic Vue demo app, so `@core/auth/emailAuth.ts`/`googleAuth.ts` deliberately keep their original MVP localStorage/GIS implementations for that consumer. `auth.ts` imports the real ones from here instead. Every sign-in calls `resolveServerSession()` (`session.ts`) to swap onto the canonical session.
  - `src/core/accountLink.ts` — client side of account linking: `startLink`/`previewLink`/`commitLink`/`unlinkSecondary`, all authenticated calls to `functions/src/account/*`. See the `unlinkSecondary` doc comment for the mandatory post-unlink token refresh.
  - `src/core/firebase.ts` now also exports `getFirebaseStorage()` (Part C).
- `src/app/providers.tsx` — app-wide theme (default dark) and language (default EN, en/es) contexts; every page shows both toggles via `AppHeader`. Pages hold their own `COPY = { en: {...}, es: {...} }` dictionaries keyed by the global lang.
- `public/terms/index.html` — the static (non-React) Terms & Conditions page has its own EN/ES toggle: every translatable element is duplicated with `data-lang="en"`/`data-lang="es"` (the `es` copy starts `hidden`), and a small inline `<script>` toggles the `hidden` attribute and persists to the same `localStorage['otherme:lang']` key the React app uses — so a language choice made in either place is respected by the other on next load.
- Pages = modules: `Landing` (mockup-faithful; logged-in users get a character gallery with Scene/Video/Talk actions), `CharacterStudio` (cascade flow: upload → analyze → sheet → generate → save reveals sections progressively), `Scenes`, `Videos`, `RoleplayStudio` (Aeternum port), `Login`, `Credits`, `Profile` (`/profile` — balance, connected logins, link/unlink UI, and a UID-with-copy row for pasting into promotions; needs both `authProviders.ts` and `accountLink.ts`), `PromosManagement` (`/promos_management` — admin-only credit grants, see above; not linked from `AppHeader` unless `isAdmin()`).
- `src/components/WalletLinkNudge.tsx` — dismissible card on `Landing.tsx` nudging email/Google users with no linked wallet toward `/profile`'s existing pairing-code flow (no new linking mechanism, just visibility). Dismissal persists in `localStorage`.
- `src/components/ReferencePicker.tsx` — shared by Scenes/Videos: attach saved characters + uploaded images, max 3 total.
- `src/components/ErrorNotice.tsx` — centered error modal used for actual failures (generation errors, insufficient credits, connection errors); routine status stays on the existing bottom toast. Wired into CharacterStudio, Scenes, Videos, RoleplayStudio. Deliberately `z-[200]` — must outrank every other overlay (RoleplayStudio's upload modal is `z-index: 100`, its toast is `120`), confirmed by a real bug where a generation error rendered correctly but sat invisibly behind the still-open upload modal.
- `src/components/MicButton.tsx` + `src/core/speech.ts` — shared Web Speech dictation: `speech.ts` holds the `getSpeechRecognizer()`/`SpeechRecognizer` typing (also used by RoleplayStudio's turn-based voice fallback), `MicButton` drops a dictation button onto any text field. `onStart` must clear that field via a functional `setState` update (not a value closed over at render time) — the recognizer result arrives well after the click, so a plain closure re-appends onto stale pre-clear text.

### Cross-module conventions

- **Credits economy** (constants in `src/core/config.ts`): sheet renders 5 free anonymous, then login → 5 welcome credits (granted once per new ledger in `loadCreditsFor`) → 1 credit/render; scenes 5 free then 5 credits; sprites 3; talking 1/min; videos 100. Spends go through the single shared `credits.spend()`; purchases are real wallet transactions at live early-bird production prices. On the Credits page NIM is the primary rail (never disabled waiting on the CoinGecko quote — `buyWithNim` fetches its own rate), USDT second with a Polygon-network warning. Prices/treasuries/NIM bonus have one source of truth, `functions/src/sharedPricing.ts` (plain literal exports, no imports of its own) — both `src/core/config.ts` (via a relative import) and `functions/src/config.ts` (re-export) read from it; edit that one file, not two, when a pack or treasury changes.
- **Handoffs between modules** use `sessionStorage` (`otherme:pending-reference` landing→create, `otherme:avatar-reference` create→talk, `otherme:video-reference` scene→video) or router state (`characterId`, `seedPrompt` for scenes/videos). `ReferencePicker` also takes a `scenes` prop (video creator): max 1 saved scene, injected into the prompt as the *setting*, not an identity subject.
- **Voice defaults**: `/api/generate-avatar` returns `gender` (female/male/object) in the profile; the roleplay studio sets the default voice from it (Sulafat / Zubenelgenubi / Puck) on generation and on avatar selection.
- **Persistence**: character sheets (`src/character/library.ts`) and custom avatars (`src/roleplay/avatarLibrary.ts`) now sync to Firestore + Storage under `users/{uid}/...` whenever a server session exists (`hasServerSession()`), with localStorage kept as a read-through cache — `listSheets`/`saveSheet`/`deleteSheet`/`listAvatars`/`persistAvatars` all stay synchronous for every existing caller; the cloud read/write happens fire-and-forget in the background (failures are swallowed with a `console.warn`, never surfaced to the user — logged out or offline is still fully local-only, unchanged). `App.tsx`'s `useCloudMediaSync()` calls `reconcileSheetsWithCloud`/`reconcileAvatarsWithCloud` once per login (via `onSessionChange`, not on mount — avoids racing Firebase's own session restore) to push up local-only items and pull down the rest of the cloud set. Scene/video galleries are still IndexedDB-only (`src/core/mediaStore.ts`) — cloud sync for those (Stages 2/3) is intentionally deferred; don't extend the sheets/avatars pattern to them without re-reading the staging rationale (videos in particular tie a `SavedVideo.interactionId` to a live Gemini Interactions API session that isn't durable across devices/time).
- **Styling**: theme-aware CSS variables in `src/styles/global.css` (Nimiq tokens + OtherMe teal palette) consumed by Tailwind utility classes and `.om-*` classes; dark mode is `[data-theme='dark']` on `<html>` (Tailwind `darkMode: ['class', '[data-theme="dark"]']`). The roleplay studio keeps its own scoped stylesheet (`src/styles/roleplay.css`, `.rp-root` prefix) ported from Aeternum with a light-theme variable override.
- Prompt templates (character sheet, video, style directives) live in `src/character/fields.ts` — the exact prompt text is a product feature; don't rewrite it casually.
- **Login redirect notices**: pass a `noticeKey` through router state (`navigate('/login', { state: { redirectTo, noticeKey: 'unlockFeature' } })`), never a pre-localized string — `Login.tsx` resolves `NOTICE_COPY[noticeKey][lang]` against its own live `lang` at render time. Passing a baked-in string used to freeze the notice in whatever language was active on the *originating* page, so toggling language after landing on `/login` didn't retranslate it. Add new keys to `Login.tsx`'s `NOTICE_COPY`, not inline ternaries at the call site.

### core-modules notes

Provider logic (`nimiqAuth.ts`, `payUsdt.ts`, `payNim.ts`, `pricing.ts`, `rates.ts`, `emailAuth.ts`, `googleAuth.ts`) is plain TypeScript importable from any framework; only `use*.ts` composables are Vue. The newer `@nimiq/mini-app-sdk` returns `T | ErrorResponse` unions — always narrow (see `nimiqAuth.ts`/`payNim.ts`). USDT on Polygon has **6 decimals**. Treasury addresses and test pricing are in `core-modules/src/modules/config.ts` and overridden per app.

**`emailAuth.ts`/`googleAuth.ts` stay MVP-only on purpose** — otherme-app no longer uses them (see `src/core/authProviders.ts` above); they still back the Vue demo app, which has no Firebase project of its own. Don't "fix" them to call Firebase directly — that would give a framework-agnostic package a hard Firebase dependency the demo app can't satisfy.

## Before production (tracked in otherme-app/README.md)

**Shipped**: server-side credit granting with on-chain tx verification, signed-challenge wallet login, production prices, real Firebase Auth for email/Google, account linking (wallet ↔ email/Google, pairing-code based), cloud sync for character sheets + custom avatars, an admin-gated credit-grant endpoint + `/promos_management` page for contest/promo payouts (deployed and confirmed live-tested 19 Aug 2026). Production treasury addresses (rotated to real wallets in `functions/src/sharedPricing.ts`); rate limiting on `/api/auth/challenge`, `/api/orders`, the AI generation routes (uid-or-IP keyed via `app.set("trust proxy", true)`), new-account creation on `/api/account/resolve`, and `/api/credits/record-purchase`, alongside the pre-existing account-linking endpoints; welcome credits gated on email verification for the `email` provider (closes the free-account farming path); `recordPurchase` hardened to recompute credits server-side from a matching pack instead of trusting the client's number; the order-claim client call now retries with backoff and persists an unclaimed claim to `localStorage` for retry on session restore instead of silently losing it after a real on-chain payment (PR #28).

**Still open**: cloud sync for scenes/videos (Stages 2/3, deliberately deferred), real Node host for `server/api.ts` (handlers only use fetch/env — portable), Firestore TTL policies for `rate_limits`/`link_codes`/`link_tickets` (console-side config, not code). A few internal endpoints remain without rate limiting (`/api/credits/spend`, `/api/credits/migrate`, `/api/admin/grant-credits`) — lower risk since they already require an authenticated (or admin) session.
