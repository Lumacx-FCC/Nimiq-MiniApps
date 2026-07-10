# Nimiq Mini Apps Competition — Hackathon Reference

Master reference for our Mini App builds. Compiled 2026-07-10 from
[miniappscompetition.com/rules](https://miniappscompetition.com/rules),
[miniappscompetition.com/scoring](https://miniappscompetition.com/scoring),
[nimiq.dev/mini-apps](https://nimiq.dev/mini-apps/), and the
[Nimiq UI Kit](https://nimiqtoolbox.github.io/nimiq-ui-kit/).

---

## 1. Competition Overview

Builders create Mini Apps using the **Nimiq Pay Mini Apps Framework**. Each cycle runs 4 weeks. Winners are paid in USDT and featured in the Nimiq Pay ecosystem.

### Timeline

| Event | Dates |
|---|---|
| Registration opens | June 3, 2026 |
| **Cycle I** | **July 6 – July 30, 2026** (we are here) |
| Cycle I "Sip & Ship" community calls | July 7, 14, 21, 28 — 1:00–2:30 PM EST |
| Submissions go public | Start of Week 3 (early-access testing) |
| Cycle II | Aug 10 – Sep 7, 2026 |
| Cycle III | Sep 14 – Oct 11, 2026 |

### Prizes (per cycle: $17,000 USDT)

- 1st: **$10,000** · 2nd: **$5,000** · 3rd: **$2,000**
- Paid in USDT across three monthly milestones, to the Nimiq wallet given at submission.
- Prizes are per team; internal split is the team's responsibility. Taxes are on the builders.

---

## 2. Eligibility & Entry Rules

- 18+; individuals or teams of **up to 5** with 1 designated lead (handles comms + payout).
- **One submission per team per cycle.**
- Open worldwide except OFAC-sanctioned jurisdictions (proof of eligible citizenship required for winners).
- Public GitHub repo linked to the submission is mandatory.
- Must have/create a **Nimiq wallet** to receive payouts.
- Previous winners may enter new cycles only with **new** Mini Apps; non-winning apps may re-enter with significant improvements.

## 3. Submission Requirements (hard rules)

1. Built on the **Nimiq Pay Mini Apps Framework** and following its documentation/technical standards.
2. All code **open-source in a public GitHub repo under the MIT License** (builders retain IP but release code under MIT).
3. **No hardcoded private keys, API secrets, or credentials** in the repo.
4. **Must integrate Nimiq Pay** and support **USDT, NIM, or both**.
   - NIM support earns **bonus points**; supporting neither = **disqualified**.
   - Displaying a Nimiq logo does NOT count — wallets, transactions, or payments must be a **core part of the UX**.
5. **Fully functional on first try** — no prototypes or mockups.
6. Original code, or properly attributed open-source usage. Forks allowed only if significantly modified and license-compliant.
7. Written description (**max 250 words**): what it does, who it's for, how it uses Nimiq Pay. Demo video optional but boosts the storytelling score.
8. Submit via the portal on the Registration Dashboard; include lead's name/pseudonym, GitHub profile, and Nimiq wallet address.

## 4. What's Off-Limits

- Collecting/transmitting user data without disclosure, lawful basis, and consent.
- Porn/sexually explicit content; violence/hate/harassment content.
- Scams, phishing, misleading UX; malware/spyware/hidden functionality; anything illegal.
- Brand/person impersonation.
- **Gambling or games of chance driven primarily by randomness.** Skill-based games with clear rules and prizes ARE permitted.
- Plagiarism or substantially-similar copies of existing projects.
- Nimiq may disqualify rule violators at any time (even post-announcement) and may modify rules between cycles.

---

## 5. Scoring — 105 Points Max (Nimiq Community Council, 20 criteria + bonus)

> "Don't just build. Ship something polished, tell the story, get real people to use it, and show up in the community."

### Design & UX — 25 pts
- **First impression** — professional and trustworthy at a glance
- **Visual design** — clean, consistent colors/typography/layout
- **Navigation** — usable by a new user without instructions
- **Mobile experience** — feels native and responsive on a phone
- **Onboarding** — zero-to-using in under **60 seconds**

### Functionality — 25 pts
- **Core feature** — works reliably
- **Nimiq integration** — wallets/transactions/payments as core UX
- **Speed & performance** — fast load, no lag
- **Error handling** — fails gracefully
- **Completeness** — finished product, not half-built

### Usefulness & Originality — 25 pts
- **Problem solved** — real need or want
- **Target audience** — clear who it's for
- **Originality** — fresh idea or meaningful improvement
- **Repeat value** — would someone open it more than once?
- **Ecosystem value** — makes Nimiq Pay more attractive to new users

### Marketing & Distribution — 25 pts
- **Unique users** — distinct Nimiq wallets that interacted during the scoring period
- **User acquisition effort** — active promotion beyond submitting
- **Content & storytelling** — build docs, demo video, compelling story
- **Community engagement** — calls, progress sharing, helping others
- **Submission quality** — app-store-ready packaging, polished visuals, enticing demo

### Bonus — 5 pts
- **NIM usage** — does the app incentivize using NIM?

Rating scale per criterion: Outstanding → Strong → Competent → Developing → Insufficient → Not demonstrated.

**Strategic takeaways:** support NIM (bonus + integration points), ship mobile-first with <60s onboarding, drive real wallet-connected users during weeks 3–4, attend the weekly calls, and produce a demo video.

### Idea categories (non-limiting)
Games · Social · Earning · Marketplaces · Productivity · Creator & Media · Education · Health & Fitness · Food & Dining · Shop & Deals · Lifestyle. See also [nimiq.dev ideas list](https://nimiq.dev/raw/mini-apps/ideas.md).

---

## 6. Tech Stack — Nimiq Pay Mini Apps Framework

A Mini App is a **web app running in a mobile WebView inside Nimiq Pay**, talking to the wallet through injected providers. Sandboxed — no private-key access; every sensitive action triggers a native user-approval dialog.

### Two providers

**Nimiq provider** — via `@nimiq/mini-app-sdk` only:
```ts
import { init } from '@nimiq/mini-app-sdk'
const nimiq = await init()
```
Capabilities: `listAccounts()`, message signing, `isConsensusEstablished()`, `getBlockNumber()`, NIM payments (`sendBasicTransaction`, `sendBasicTransactionWithData` — amounts in Luna, 1 NIM = 100,000 Luna), and full staking methods.

**Ethereum provider** — standard EIP-1193 via `window.ethereum` (no SDK). EIP-6963 discovery means wagmi/RainbowKit detect it automatically. Covers account access, `eth_sendTransaction`, `eth_signTypedData_v4` / `personal_sign`, chain switching, read-only RPC. ERC-20 pattern: `wallet_switchEthereumChain` → `eth_call` (reads) / `eth_sendTransaction` (writes). **USDT lives here.**

Supported EVM chains: Polygon, Arbitrum One, Optimism, Base, BNB Smart Chain, Sepolia (dev/test only — never ship on Sepolia). Chain IDs and token addresses: [.claude/skills/mini-apps/references/chains-and-tokens.md](.claude/skills/mini-apps/references/chains-and-tokens.md).

Extras: `window.nimiqPay?.language` for localization; `requestDeviceIdentifier()` for pseudonymous device handles (leaderboards/anti-spam).

### Quick start (per official tutorial)
```bash
npm create vite@latest my-mini-app -- --template vue-ts   # or react / svelte
cd my-mini-app && npm install
npm install @nimiq/mini-app-sdk
# vite.config: server { host: true, port: 5173 }
npm run dev -- --host
# On phone (same Wi-Fi): Nimiq Pay → Mini Apps → enter the Network URL
```

### Key documentation
- Overview: https://nimiq.dev/mini-apps/ (raw markdown: `https://nimiq.dev/raw/mini-apps.md`)
- First-app tutorial: https://nimiq.dev/raw/mini-apps/tutorials/mini-app-tutorial.md
- Dual-chain (NIM + EVM) tutorial: https://nimiq.dev/raw/mini-apps/tutorials/dual-chain-mini-app-tutorial.md
- Local testing: https://nimiq.dev/raw/mini-apps/development/load-local-mini-app.md
- Provider API refs: `.../mini-apps/api-reference/nimiq-provider.md` and `ethereum-provider.md`
- Features: device-identifier, evm-tokens, localization under `.../mini-apps/features/`
- FAQ: https://nimiq.dev/raw/mini-apps/faq.md

---

## 7. Design System — Nimiq UI Kit

https://nimiqtoolbox.github.io/nimiq-ui-kit/ — consolidates `@nimiq/style`, `@nimiq/vue-components` (34 components incl. Identicon, Amount, QR), `@nimiq/identicons`, `@nimiq/utils`.

- **Typography:** Muli (400/600/700) for UI; Fira Mono for addresses/hex. `1rem = 8px` grid. Classes: `.nq-h1` (24px), `.nq-h2` (20px), `.nq-h3` (16px), `.nq-text` (16px), `.nq-text-s` (14px/600), `.nq-label` (14px/600 uppercase).
- **Colors:** 10 brand colors; text utilities `.nq-<color>`, backgrounds `.nq-<color>-bg`; grayscale ladder `--text-100`…`--text-6`.
- **Radii:** 4px inputs, 10px cards, 13.5px small/pill buttons, 500px primary buttons. Shadows: `.nq-shadow`, `.nq-shadow-l`.
- **Motion:** `cubic-bezier(0.25, 0, 0, 1)`; 0.2s attribute / 0.4s movement.
- **CSS components:** buttons (primary/small/pill), inputs, cards, notices (info/success/warning/error).
- Machine-readable copies downloaded locally (see below). Repos: [nimiq-style](https://github.com/nimiq/nimiq-style), [vue-components](https://github.com/nimiq/vue-components), [iqons](https://github.com/nimiq/iqons), [nimiq-utils](https://github.com/nimiq/nimiq-utils), [UI kit](https://github.com/NimiqToolbox/nimiq-ui-kit).

---

## 8. Local Resources in This Repo

| Path | What it is |
|---|---|
| `.claude/skills/mini-apps/` | **Official Nimiq AI skill** (from `nimiq/developer-center`) — auto-loads in Claude Code. Scaffold, convert, and pre-ship checklist flows + full provider API references, chain IDs, token addresses. |
| `reference/nimiq-mini-app-demo/` | Official demo mini app (Vite + TS) from the tutorial. |
| `reference/developer-center/` | Full Nimiq Developer Center repo (docs source under `content/`, skill source under `skills/`). |
| `reference/nimiq-ui-kit/llms-full.txt` | Complete UI kit reference for AI consumption. |
| `reference/nimiq-ui-kit/tokens.json` | Machine-readable design tokens. |
| `reference/nimiq-ui-kit/AGENTS.md` | UI kit agent integration guide. |

> The `mini-apps` skill triggers automatically when we build/convert/validate a mini app. When an app is "done", run its checklist (`.claude/skills/mini-apps/references/checklist.md`) before submitting.

## 9. Pre-Submission Checklist (ours)

- [ ] Public GitHub repo, MIT LICENSE file present
- [ ] No secrets/keys committed (scan before pushing)
- [ ] NIM and/or USDT integration is core UX (NIM = +bonus)
- [ ] Works first-try on a real phone inside Nimiq Pay
- [ ] Onboarding < 60 seconds; mobile-native feel
- [ ] Graceful error handling; no Sepolia in production
- [ ] Third-party code attributed
- [ ] 250-word description + demo video
- [ ] Team lead designated: name, GitHub link, Nimiq wallet address
- [ ] Run the official skill checklist: `.claude/skills/mini-apps/references/checklist.md`
