# Lean Firebase Deploy — Other Me (othermeapp.com)

Goal: get **othermeapp.com** permanently online for the hackathon (no laptop, no tunnel,
no Bad Gateway) with the **least work**. We deploy the frontend to Firebase Hosting and the
API to Firebase Functions, and **keep the current client-side storage** (localStorage +
IndexedDB) as-is.

**Deferred to after the hackathon** (not needed to be live): Firestore data model,
cross-device sync, and server-side credit verification. Those are the "full migration".
**Update:** all three have since shipped — see `docs/server-side-credits.md` (server-side
credit verification, Phases 1-5) and the account-linking/cloud-sync work in
`CLAUDE.md`'s "Before production" section (Firestore users model, cross-device sync for
character sheets + avatars). This doc is kept as a historical record of the initial lean
deploy; treat the rest of it as "how we got live," not current state.

Legend: 🧑 = you do it (account/billing/DNS) · 🤖 = Claude does it in the repo (on "go")

Estimated time: ~1–2 days, most of it the backend port + DNS propagation wait.

---

## Part A — Firebase project & CLI  🧑
1. Create a project at https://console.firebase.google.com (e.g. `othermeapp`).
2. Upgrade to the **Blaze** (pay-as-you-go) plan. Required — Functions can't call
   OpenAI/Gemini on the free Spark plan. Hackathon traffic will likely cost ~$0 for Firebase
   itself; your only real spend stays the AI APIs you already pay.
3. Enable **Functions** and **Storage** (Storage is used only for the file-share workaround —
   not the full data migration). Firestore/Auth can stay off for the lean deploy.
4. Install the CLI and log in:
   ```bash
   npm i -g firebase-tools
   firebase login
   ```
5. From `otherme-app/`, initialise (select **Hosting** + **Functions**; TypeScript functions;
   don't overwrite `dist`):
   ```bash
   firebase init hosting functions
   ```

## Part B — Port the backend to Cloud Functions  🤖
`server/api.ts` is Vite dev middleware and does **not** run in a production build, so its
routes move to a Function. On "go" Claude will:
1. Create a `functions/` codebase (2nd-gen, **Node 20**) with an Express app exposing the same
   routes: `analyze-character`, `generate-sheet`, `generate-avatar`, `gemini-token`,
   `generate-video`, `share`. Handlers already use only `fetch`/env/`FormData`/`Blob`/`Buffer`,
   so the port is mostly mechanical.
2. Set function sizing: **2nd gen, memory 1 GiB, timeout 540 s** — the video route polls up to
   5 minutes, which exceeds the 60 s cap of 1st-gen HTTP functions. (Optionally split the video
   route into its own function so the fast routes stay cheap; one function is simpler.)
3. Store keys as **Secret Manager** secrets (not in the repo — keeps the "no committed secrets"
   rule intact):
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   firebase functions:secrets:set OPENAI_API_KEY
   ```
4. **Move the share endpoint to Storage.** The current in-memory `Map` won't work across
   Function instances (each has its own memory). `POST /api/share` will upload the file to
   `shares/{id}` in Storage and return its download URL; add a Storage **lifecycle rule** to
   auto-delete `shares/` after 1 day. This is a small client tweak too (`shareViaBrowserLink`
   in `src/character/library.ts` will use the returned URL directly instead of prefixing the
   origin).

## Part C — Hosting config  🤖
1. `firebase.json` — serve the build and route the API same-origin (so the frontend keeps
   calling relative `/api/*` with **no change**):
   ```json
   {
     "hosting": {
       "public": "dist",
       "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
       "rewrites": [
         { "source": "/api/**", "function": "api" },
         { "source": "**", "destination": "/index.html" }
       ]
     }
   }
   ```
2. No `base`/router changes — the app is at the domain root. The dev workflow is unchanged
   (`npm run dev` still uses the Vite middleware locally).

## Part D — Build & deploy  🤖/🧑
```bash
cd otherme-app
npm run build          # produces dist/ (tsc --noEmit && vite build)
firebase deploy        # deploys hosting + functions
```
This yields a live `*.web.app` URL to smoke-test before wiring the domain.

## Part E — Connect othermeapp.com (the Hostinger part)  🧑
1. Firebase Console → Hosting → **Add custom domain** → `othermeapp.com`. The wizard shows a
   **TXT** record (verification) and, because this is an apex/root domain, **two A records**
   (CNAME can't be used at the apex).
2. In **Hostinger hPanel → Domains → DNS Zone**:
   - Add the **TXT** record (host `@`).
   - Replace any parked A records with Firebase's **two A records** (host `@`).
   - Add `www.othermeapp.com` as a second domain in Firebase set to **redirect to apex**, then
     add the record it gives you (usually a CNAME/A for `www`).
   - Keep nameservers at Hostinger — you're only editing records, so the domain stays managed
     in your hPanel.
3. Wait for DNS propagation (minutes up to ~24 h). Firebase auto-provisions the SSL cert once
   it verifies — no cert work on your side.

## Part F — Verify & submit  🧑
- Open `https://othermeapp.com` **directly inside the Nimiq Pay WebView** (no tunnel).
- Check: wallet login, a character render, a talking session, the share/download overlay, and a
  real NIM and USDT purchase crediting the balance.
- Confirm the public GitHub repo is MIT with no secrets committed, then submit the URL.

---

## Config decisions before deploy  🧑 (tell Claude)
- **Prices:** ~~`src/core/config.ts` currently uses TEST prices (÷100, e.g. $0.01/60 credits)~~
  — **done**: `src/core/config.ts` now holds real early-bird production prices (live since
  2026-07-27), not the ÷100 test values described here.
- **Treasuries:** the NIM + EVM treasury addresses in `config.ts` are shared TEST accounts.
  Swap to **your own** addresses if you want to keep the funds from real purchases. **Still
  open** — this one hasn't shipped yet (see backlog Tier 1.4).

## Known limitations of the lean deploy (accepted for now)
- ~~**Data stays on-device**~~ — **done**: character sheets and custom avatars now sync to
  Firestore + Storage for logged-in users (localStorage/IndexedDB kept as a read-through
  cache). Scenes/videos are still on-device only, deliberately deferred (backlog Tier 2.2).
- ~~**Credits are still granted client-side**~~ — **done** for the reconciled path: a
  server-side reconciler is now the sole granter for USDT orders, verified on-chain before
  crediting. NIM still uses the temporary client-trusting grant path pending the RPC secrets
  (see `docs/server-side-credits.md` and backlog Tier 1.5) — that specific gap is real and
  still open, the rest of this bullet is not.
- **Cold starts:** first API call after idle may take a few seconds (2nd-gen Functions,
  min-instances 0). Set min-instances 1 only if you want to pay to avoid it.

## What Claude changes in the repo on "go" (no app-logic rewrites)
- New: `functions/` (ported API + secrets wiring), `firebase.json`, `.firebaserc`,
  `storage.rules`, `.gitignore` additions.
- Tiny edit: `src/character/library.ts` share helper to use the Storage URL.
- Untouched: all pages, the credits/auth/media logic, and the local dev workflow.
