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

# core-modules demo
cd core-modules && npm run dev   # 5173

# Phone testing inside Nimiq Pay (LAN blocked by GPO firewall — always tunnel)
cloudflared tunnel --url http://localhost:5174   # exe: C:\Program Files (x86)\cloudflared\
```

There are no automated tests; verification is manual (browser + phone in Nimiq Pay).

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

### Nimiq Pay WebView limitations (confirmed on-device)

The wallet's Android WebView supports **no file downloads** (no download listener, no Web Share API) and **no microphone** (`getUserMedia` permission is not forwarded). Consequences baked into the code — don't undo them:

- Every file export must go through `shareOrDownloadBlob` in `src/character/library.ts`: Web Share → WebView fallback (`POST /api/share` + copy-link overlay, opened in a real browser) → anchor download. WebView detection = `\bwv\b` in the user agent.
- Gemini Live sessions survive mic failure (user types, avatar speaks) instead of tearing down.
- localStorage is ~5 MB total: character sheet images are compressed to 1024px WebP before saving (`compressImageDataUrl`), avatar sprites are stored as WebP-with-alpha, and persist failures must be surfaced to the user (silent quota failure looks like "saved" but vanishes on reload).

### Client structure

- `src/core/` — React bridge over core-modules. `config.ts` calls `configure()` (must be imported first — `main.tsx` does) and defines all pricing constants. `auth.ts`/`credits.ts` re-implement only the thin Vue composables as `useSyncExternalStore` stores while importing the framework-agnostic provider logic from `@core/*` (alias to `../core-modules/src/modules`, wired in both `vite.config.ts` and `tsconfig.json`). Same localStorage keys as the Vue version.
- `src/app/providers.tsx` — app-wide theme (default dark) and language (default EN, en/es) contexts; every page shows both toggles via `AppHeader`. Pages hold their own `COPY = { en: {...}, es: {...} }` dictionaries keyed by the global lang.
- Pages = modules: `Landing` (mockup-faithful; logged-in users get a character gallery with Scene/Video/Talk actions), `CharacterStudio` (cascade flow: upload → analyze → sheet → generate → save reveals sections progressively), `Scenes`, `Videos`, `RoleplayStudio` (Aeternum port), `Login`, `Credits`.
- `src/components/ReferencePicker.tsx` — shared by Scenes/Videos: attach saved characters + uploaded images, max 3 total.
- `src/components/ErrorNotice.tsx` — centered error modal used for actual failures (generation errors, insufficient credits, connection errors); routine status stays on the existing bottom toast. Wired into CharacterStudio, Scenes, Videos, RoleplayStudio. Deliberately `z-[200]` — must outrank every other overlay (RoleplayStudio's upload modal is `z-index: 100`, its toast is `120`), confirmed by a real bug where a generation error rendered correctly but sat invisibly behind the still-open upload modal.
- `src/components/MicButton.tsx` + `src/core/speech.ts` — shared Web Speech dictation: `speech.ts` holds the `getSpeechRecognizer()`/`SpeechRecognizer` typing (also used by RoleplayStudio's turn-based voice fallback), `MicButton` drops a dictation button onto any text field. `onStart` must clear that field via a functional `setState` update (not a value closed over at render time) — the recognizer result arrives well after the click, so a plain closure re-appends onto stale pre-clear text.

### Cross-module conventions

- **Credits economy** (constants in `src/core/config.ts`): sheet renders 5 free anonymous, then login → 5 welcome credits (granted once per new ledger in `loadCreditsFor`) → 1 credit/render; scenes 5 free then 5 credits; sprites 3; talking 1/min; videos 100. Spends go through the single shared `credits.spend()`; purchases are real wallet transactions (test prices ÷100 of production). On the Credits page NIM is the primary rail (never disabled waiting on the CoinGecko quote — `buyWithNim` fetches its own rate), USDT second with a Polygon-network warning.
- **Handoffs between modules** use `sessionStorage` (`otherme:pending-reference` landing→create, `otherme:avatar-reference` create→talk, `otherme:video-reference` scene→video) or router state (`characterId`, `seedPrompt` for scenes/videos). `ReferencePicker` also takes a `scenes` prop (video creator): max 1 saved scene, injected into the prompt as the *setting*, not an identity subject.
- **Voice defaults**: `/api/generate-avatar` returns `gender` (female/male/object) in the profile; the roleplay studio sets the default voice from it (Sulafat / Zubenelgenubi / Puck) on generation and on avatar selection.
- **Persistence** is local with explicit Firebase migration seams: character sheets in localStorage (`src/character/library.ts`, images compressed to 1024px WebP on save), scene/video galleries in IndexedDB (`src/core/mediaStore.ts` — videos are too big for localStorage), custom avatars in localStorage (`src/roleplay/avatarLibrary.ts`, sprites stored as WebP-with-alpha; persist failures are shown to the user).
- **Styling**: theme-aware CSS variables in `src/styles/global.css` (Nimiq tokens + OtherMe teal palette) consumed by Tailwind utility classes and `.om-*` classes; dark mode is `[data-theme='dark']` on `<html>` (Tailwind `darkMode: ['class', '[data-theme="dark"]']`). The roleplay studio keeps its own scoped stylesheet (`src/styles/roleplay.css`, `.rp-root` prefix) ported from Aeternum with a light-theme variable override.
- Prompt templates (character sheet, video, style directives) live in `src/character/fields.ts` — the exact prompt text is a product feature; don't rewrite it casually.

### core-modules notes

Provider logic (`nimiqAuth.ts`, `payUsdt.ts`, `payNim.ts`, `pricing.ts`, `rates.ts`, `emailAuth.ts`, `googleAuth.ts`) is plain TypeScript importable from any framework; only `use*.ts` composables are Vue. The newer `@nimiq/mini-app-sdk` returns `T | ErrorResponse` unions — always narrow (see `nimiqAuth.ts`/`payNim.ts`). USDT on Polygon has **6 decimals**. Treasury addresses and test pricing are in `core-modules/src/modules/config.ts` and overridden per app.

## Before production (tracked in otherme-app/README.md)

Server-side credit granting with on-chain tx verification, signed-challenge wallet login, Firebase migration, production prices/treasuries, real Node host for `server/api.ts` (handlers only use fetch/env — portable).
