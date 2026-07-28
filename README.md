# Other Me — a Nimiq Pay Mini App

**Other Me** lets anyone turn a single image into a cinematic character — then
bring it to life with scene art, short video clips, and a live, talking avatar
you can actually converse with. It runs inside the **Nimiq Pay** wallet, with
NIM and USDT payments built into the experience through a shared credits
balance.

Built for the **Nimiq Mini Apps Competition**.

## 📺 Watch the 2‑minute intro

See how Other Me works — from uploading an image to talking with your character:

[![Other Me — App Intro](https://img.youtube.com/vi/whnIsff4K80/hqdefault.jpg)](https://www.youtube.com/watch?v=whnIsff4K80)

▶️ **[Watch on YouTube](https://www.youtube.com/watch?v=whnIsff4K80)** — on our channel, [@OtherMeApp](https://www.youtube.com/@OtherMeApp)

## What it does

1. **Character Studio** — upload any image; AI analyzes it into a detailed
   30‑field character sheet and renders a polished character design.
2. **Scenes** — place your character in new cinematic settings and styles.
3. **Videos** — generate short (8‑second) video clips of your character, with
   conversational edits.
4. **Talk** — a voice‑driven talking avatar you can roleplay with. Your
   character always answers out loud; how you speak to it adapts to the host
   environment — see [how voice works](#talking-to-your-character-how-voice-works).

Everything is paid for with a single **credits** balance. New users get free
renders to try it, then top up with **NIM** (with a bonus) or **USDT** — real
wallet transactions, native to Nimiq Pay.

## Talking to your character: how voice works

The **Talk** module adapts to what the host environment actually allows, because
the Nimiq Pay WebView and a desktop browser have very different audio
capabilities. All three modes speak back out loud — only the input differs.

| Where | Voice input | Behaviour |
| --- | --- | --- |
| Desktop / mobile **browser** | Live microphone streaming | Full-duplex Gemini Live: talk naturally, interrupt mid-sentence. |
| Inside **Nimiq Pay** | Web Speech **dictation** | Turn-based: speak, then wait for the reply. |
| Anywhere voice is blocked | Typing | The character still answers aloud. |

### Why dictation inside the wallet

Measured on-device on 2026‑07‑28 (Samsung Fold 5 / Android 16, WebView Chrome
150) using [`otherme-app/public/audio-check.html`](otherme-app/public/audio-check.html),
a self-contained diagnostic you can open inside the wallet:

- `getUserMedia` fails with **`NotReadableError`** — "could not start audio
  source". Notably **not** a denied permission: `navigator.permissions.query`
  reports `prompt`, not `denied`, so the WebView does forward the request. The
  audio *device* is what fails to open, which points at the host app lacking a
  usable Android `RECORD_AUDIO` grant. Live PCM streaming is therefore impossible.
- **`SpeechRecognition` works**, and returns real transcripts — Android's system
  speech service captures audio in its own process rather than through the
  WebView, so it sidesteps the problem entirely.
- Audio **output** is unaffected (`AudioContext` at 48 kHz).
- A plain `<input type="file" accept="audio/*">` also works; the `capture` hint
  does not.

So the app degrades from live mic → dictation → typing, automatically and in
that order.

### What users are told

Dictation is turn-based, so the UI says so rather than leaving people guessing.
When it engages, the chat panel shows a live status line (**"Listening — speak
now"**, switching to **"Paused while your character speaks…"**) above a note
explaining, in EN and ES, that:

- it takes turns — speak, then wait for the reply;
- the mic pauses while the character is talking (otherwise the recognizer hears
  the phone's own speaker and transcribes the character back to itself);
- it needs an internet connection;
- you can type at any time instead.

Known limits of this mode: no barge-in (you can't interrupt mid-sentence,
because there's no audio stream to detect speech in), one utterance per turn,
and availability varies by device vendor. Getting true live voice inside the
wallet needs Nimiq Pay to grant the WebView a working `RECORD_AUDIO` — the
diagnostic page above produces the exact error report to send them.

## Repository structure

| Path | What it is |
| --- | --- |
| [`otherme-app/`](otherme-app/) | The competition app — Vite + React + TypeScript. See its [README](otherme-app/README.md) to run it. |
| [`core-modules/`](core-modules/) | Reusable FCC foundation — Nimiq wallet login, credits/payments (NIM + USDT), design tokens (Vue demo included). |

The full server-side credits + on-chain verification design lives in
[`otherme-app/docs/server-side-credits.md`](otherme-app/docs/server-side-credits.md).

## Getting started

```bash
cd otherme-app
npm install
npm run dev
```

Then open the app on `http://localhost:5174`. For phone testing inside Nimiq
Pay and full setup notes, see the [app README](otherme-app/README.md).

## Known limitations

Written for reviewers: what doesn't work yet, why, and what's planned. We'd
rather state these plainly than have them found.

### Platform constraints (the Nimiq Pay WebView)

These are properties of the host environment, confirmed on-device, not defects in
the app. Each one has a shipped workaround.

| Constraint | What we do about it |
| --- | --- |
| **No file downloads** — no download listener, no Web Share API | Every export goes through `shareOrDownloadBlob`: Web Share → upload + copy-link overlay → anchor download |
| **No live microphone** — `getUserMedia` fails with `NotReadableError` | Web Speech dictation, turn-based (see [how voice works](#talking-to-your-character-how-voice-works)); typing always available |
| **USDT needs POL for gas** — mini apps don't get the wallet's gas abstraction | NIM is the primary rail (gasless, +50% credits); USDT carries a clear warning. Relayer designed in [`docs/usdt-gas-abstraction.md`](otherme-app/docs/usdt-gas-abstraction.md) |
| **localStorage ≈ 5 MB** | Images compressed to 1024px WebP before saving; quota failures surfaced to the user rather than failing silently |

### Product limitations in this build

- **Credits are tied to how you sign in.** A balance bought with a Nimiq wallet
  does not appear under an email login, because identity is the wallet address or
  the email and the two aren't linked yet. Disclosed in-app on the login and
  credits screens. Account linking is the top roadmap item — design in the
  [app README](otherme-app/README.md#1-link-a-wallet-and-an-email-into-one-account).
- **Email accounts are device-local.** Email registration is stored in the
  browser, so an email account made on a phone doesn't exist on a desktop.
- **Saved work lives on the device.** Character sheets and avatars in
  localStorage, scenes and clips in IndexedDB. Clearing site data loses them;
  moving them server-side is planned.
- **Conversations aren't saved at all** — they're in memory for the length of the
  session, by design. Copy anything you want to keep.
- **No rate limiting on the backend yet.** Known gap, tracked.
- **Voice dictation caveats:** no barge-in, one utterance per turn, vendor-dependent.
- **Generation is charged per attempt**, not per satisfactory result — AI output
  is probabilistic.

### Where data goes

Deliberately minimal. Character sheets, avatars, scenes, clips and conversations
stay on your device or in memory; our server holds only the credit balance,
wallet address, and payment metadata needed to verify purchases on-chain. Images
are passed through to OpenAI and Google Gemini for generation and discarded, and
live voice connects from the browser straight to Gemini so our servers never see
it. Full detail, including a storage table, is in
[`docs/terms-and-conditions.md`](otherme-app/docs/terms-and-conditions.md)
(drafted, pending legal review and a Spanish translation).

## Coming soon

In priority order, from 1 Aug 2026. Full detail in the
[app roadmap](otherme-app/README.md#roadmap--from-1-aug-2026-after-the-competition).

1. **Account linking** — one balance across wallet and email logins, via a
   short-lived link code and a Firebase custom token that resolves an email login
   to the wallet's uid.
2. **Rate limiting and abuse protection** across the backend.
3. **Order-claim resilience** so a paid transaction can never fail to grant credits.
4. **Cloud-synced characters and galleries**, so saved work survives a device.
5. **Gasless USDT** via a meta-transaction relayer (`executeMetaTransaction`).
6. **True live microphone** inside Nimiq Pay — needs the wallet to grant its
   WebView `RECORD_AUDIO`; `otherme-app/public/audio-check.html` is the
   on-device diagnostic that produces the report for the Nimiq team.
7. **Terms & conditions** finalised, translated, and linked in-app.

## License

MIT — see the competition rules for details.
