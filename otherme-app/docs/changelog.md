# Other Me — change log (PR #8 → present)

Covers 2026-07-23 → 2026-07-27, the run-up to Nimiq Mini Apps Cycle I judging
(2026-07-30). Earlier history is in git. All merged PRs are deployed to
othermeapp.com (project `otherme-18f5b`) unless noted.

| PR | Date | Theme | Title |
|---|---|---|---|
| [#8](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/8) | 07-23 | Docs | Phases 1–3 complete + security notes |
| [#9](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/9) | 07-24 | Payments | Server-side credits Phase 4: on-chain reconciler + USDT cutover |
| [#10](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/10) | 07-24 | Payments | Reconciler: Firestore index + expire abandoned pending orders |
| [#11](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/11) | 07-24 | Payments | NIM verification via NimiqWatch RPC (interim) |
| [#12](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/12) | 07-24 | Mixed | NIM cutover, share buttons, overflow hardening |
| [#13](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/13) | 07-24 | Product | Unified `/gallery` + video pause-snapshot |
| [#14](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/14) | — | — | *Closed unmerged — marketing content stays out of the public repo* |
| [#15](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/15) | 07-24 | UX | Gallery shortcut, friendly share message, responsive header |
| [#16](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/16) | 07-25 | UX | Responsive subsections, header logo ratio, single language button |
| [#17](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/17) | 07-27 | UX + Pricing | Collapsible studio sections, gallery login target, socials, early-bird pricing |
| *pending* | 07-27 | Docs | USDT gas-abstraction finding + relayer design (uncommitted) |
| [#22](https://github.com/Lumacx-FCC/Nimiq-MiniApps/pull/22) | 08-18 | UX | Gallery share parity, creator responsiveness, error modal, listening cue, voice dictation on prompts |
| *pending* | 08-18 | UX + Fix | Talk stage down to one action row; error pop-up z-index fix; custom avatar slot bug |

## Arc 1 — Payments moved from client-trust to server-authoritative (#8–#12)

The largest body of work. Credits are no longer granted by the browser.

- **#8** — docs only. Marked Phases 1–3 done (server owns identity, the credits
  ledger, and payment intents) and documented the Firebase web-key posture:
  public by design; real secrets in Secret Manager; GCP API restrictions +
  Firestore rules + signed-challenge Auth are the actual protections.
- **#9** — *+930/−29, 14 files.* A scheduled `reconcile` Cloud Function (every
  1 min) verifies each claimed payment on-chain and grants credits itself,
  closing the "claim a big pack for a tiny tx" and "submit-then-drop" threats.
  USDT fully cut over: raw `eth_getTransactionReceipt` + ERC-20 `Transfer`-log
  decode, 5 confirmations, no new dependency. `grantOrder()` writes the ledger
  entry, increments the balance, and marks the order granted in one transaction,
  idempotent by `tx-<hash>`. NIM verification built but dormant pending RPC.
  Also introduced the `USDT_GAS_REQUIRED` gas-error UX.
- **#10** — two fixes found during the on-device deploy: the Firestore composite
  index the reconciler query requires (deploy-blocker — every pass was failing
  `FAILED_PRECONDITION`), and a sweep that expires abandoned `pending` orders
  left behind by gas-failed taps.
- **#11** — activated NIM on-chain verification against the public NimiqWatch
  RPC as an interim, swappable via one secret to a self-hosted node later.
  `verifyNim` locked to the confirmed Albatross RPC shape. Cost/risk comparison
  and VM setup steps documented in `server-side-credits.md` §A.
- **#12** — NIM full cutover (`NIM_SERVER_VERIFIED = true`), so NIM purchases
  also wait on the reconciler. Plus `failedReason` cleanup on grant, share
  buttons across images/scenes/videos (footer burned on via canvas, and
  MediaRecorder re-encode for video, preserving audio), and overflow hardening.

**Net effect:** both rails are server-verified end-to-end. The one path still
unproven in production is a USDT payment that actually lands — it needs a wallet
holding POL (see `usdt-gas-abstraction.md`).

## Arc 2 — Product surface (#13)

- **Unified `/gallery`** — one hub with Characters / Scenes / Videos tabs and
  live counts, sourced from localStorage (sheets) and IndexedDB (media).
  Tap-to-zoom via the shared `Lightbox`, now video-capable. Per-type
  cross-navigation reusing the existing handoffs: character → Scene / Video /
  Talk, scene → Video / Talk. Share + Delete per asset. Inline galleries kept.
- **Video pause-snapshot** — capture the current frame and save it as a Scene,
  turning a good still into a reusable reference.

## Arc 3 — On-device UX and production pricing (#15–#17)

Driven by testing inside Nimiq Pay on real phones.

- **#15** — Galleries shortcut on the Landing section header; the WebView share
  overlay now shows a ready-to-paste message instead of a bare
  `firebasestorage…` URL; header overflow fixed from 320px up.
- **#16** — CharacterStudio reference row stacks below 420px (its
  un-shrinkable width was pushing the sheet fields off-screen); Landing action
  buttons go icon-only below 430px; logo locked to a round 36×36; language
  toggle simplified to EN/ES.
- **#17** — new `CollapsibleCard` applied across the studios, with the flow
  driving them (analyze opens the sheet, generate closes it, save opens the
  video prompt). Login now lands on `/gallery`. Landing footer socials.
  **Production early-bird pricing went live:** $0.75 / 30, $3.75 / 200,
  $15 / 1000 — 25% off, struck-through regular prices, flipped manually in
  November. NIM keeps its +50% bonus. Prices live in *both* the client config
  and `functions/src/config.ts`; the server is authoritative, so they move
  together.

## Arc 4 — Creator-flow UX pass (#22)

Five fixes requested after a fresh round of on-device testing, plus one bug
found during that testing.

- **Gallery share parity** — the Characters tab in `/gallery` was missing the
  Share action that Scenes and Videos already had; added, reusing the existing
  `shareDataUrl` helper.
- **Creator responsiveness** — `CharacterStudio`, `Scenes`, `Videos` only went
  two-column at `lg` (1024px), so tablets (768–1023px) got a single stretched
  column. Dropped the breakpoint to `md` (768px). Separately, opening the
  Design Sheet's section-tab row (Identity/Face Design/…) could blow the whole
  left column wider than the viewport — a classic CSS Grid min-width:auto trap,
  since that row's non-wrapping content was several DOM levels below the grid
  item. Fixed by switching the row to `flex-wrap` (all tabs always visible, no
  scroll needed) and adding `min-width: 0` to every grid column on all three
  pages, plus `overflow-x: hidden` on `.page-shell` as a backstop.
- **Error visibility** — new `ErrorNotice.tsx` centered modal for actual
  failures (generation errors, insufficient credits, connection errors),
  replacing the easy-to-miss bottom-corner toast for those cases specifically;
  routine status (saved, voice mode on) keeps the lighter toast.
- **Listening indicator** (Talk with Avatar) — enlarged the top-left status
  badge and added an animated sound-wave pill next to the mic button, shown
  only while actively listening.
- **Voice dictation on every prompt box** — extracted the Web Speech recognizer
  RoleplayStudio already used into `src/core/speech.ts`, then built a reusable
  `MicButton` and dropped it onto every text field across Character (all
  design-sheet fields, custom style, video action), Scenes, and Videos.
  Pressing the mic clears that field only, via a functional `setState` update —
  an initial version used a plain closure and re-appended dictated text onto
  the pre-clear value, because the recognizer's result arrives well after the
  click, long after the click-time closure went stale.
- **USDT gas abstraction** — documented the confirmed platform limitation (mini
  apps don't get Nimiq Pay's gas abstraction, so USDT needs POL) and corrected
  our own stale claim that a relayer was infeasible. It *is* viable via
  `executeMetaTransaction` + `eth_signTypedData_v4`, and needs no reconciler
  changes. Deferred past Cycle I: needs a hot wallet, nonce-safe sends, spend
  quotas, and a paid RPC. Design: [usdt-gas-abstraction.md](usdt-gas-abstraction.md).
  Comment/docs only — no behavior change; NIM and USDT flows untouched.

## Arc 5 — Talk stage cleanup + two production bugs found by dogfooding (pending, uncommitted)

Follow-up after #22 shipped to production and got real on-device use.

- **Talk stage down to one action row.** Three independently-positioned
  elements (Change Avatar, the listening pill, Begin/End) used to stack and
  cover a third of the avatar once a session went live. `RoleplayStudio` now
  renders exactly two elements side by side in `.stage-action-row`: the left
  slot swaps between "Change Avatar" (idle) and the listening/speaking pill
  (live), the right slot is always Begin/End. Verified at mobile and desktop
  width in both languages — no label wraps or overflows.
- **Fixed: the error pop-up could render invisibly behind another modal.**
  `ErrorNotice` was `z-[95]`; `RoleplayStudio`'s upload modal is `z-index: 100`
  and the toast is `z-index: 120`. An error firing while either was open
  rendered correctly in the DOM but sat behind it, unseen. Confirmed live: the
  "blocked by content safety filter" avatar-generation error was fully
  invisible behind the still-open upload modal. Raised `ErrorNotice` to
  `z-[200]`, above every other layer in the app.
- **Fixed: creating a second custom avatar could silently overwrite the
  first.** The Character Creator → Talk handoff
  (`sessionStorage['otherme:avatar-reference']`) hardcoded `setUploadSlot(1)`
  regardless of what already occupied slot 1. Now it computes the first empty
  slot in `1..customSlotCount`, and flashes an error if every slot is full
  instead of guessing. Verified: created a custom avatar in slot 1, replayed
  the same handoff, and it correctly targeted slot 2.
- **Confirmed, not a bug:** OpenAI's `gpt-image-2` does reject some reference
  images as copyrighted characters (400 from `/api/generate-avatar`, e.g. a
  Pikachu-styled sheet) — expected content-safety behavior on the provider
  side. The gap was purely the invisible pop-up above; the server-side message
  was already specific and correct.

## Known gaps carried forward

This section stopped being updated after PR #22 while this changelog's PR
table did too — the live backlog (see `[[otherme-backlog-plan]]` memory, or
ask Claude "what's outstanding") has been the actual tracking mechanism since
mid-August. As of 2026-08-20:

1. ✅ **Rate limiting** — closed. `/api/auth/challenge`, `/api/orders`, the AI
   routes, new-account creation, and `/api/credits/record-purchase` are all
   rate-limited now (PR #28).
2. ✅ **`claimServerOrder` fire-and-forget** — closed. Now retries with
   backoff and persists an unclaimed claim for retry on session restore
   (PR #28).
3. ✅ **`@nimiq/mini-app-sdk` unpinned** — closed, pinned to `0.1.0` (PR #25).
4. ✅ **USDT grant path unproven in production** — closed, proven via two real
   purchases 2026-08-20 (backlog Tier 2.7).
5. **NIM verification runs on a third-party RPC** (NimiqWatch) — still true,
   explicitly accepted as a permanent dependency (backlog Tier 2.4,
   cancelled — no self-hosted VM will be built).
