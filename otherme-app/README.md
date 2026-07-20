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

## Post-hackathon TODO

1. Real backend for `server/api.ts` handlers (they only use fetch/env — portable).
2. Verify payment tx hashes on-chain before granting credits (`src/core/credits.ts`).
3. Migrate saved sheets/avatars from localStorage to Firebase
   (`src/character/library.ts`, `src/roleplay/avatarLibrary.ts` are the seams).
4. Signed-challenge wallet login for real sessions.
5. Production prices + treasury addresses in `src/core/config.ts`.
