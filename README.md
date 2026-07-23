# Other Me — a Nimiq Pay Mini App

**Other Me** lets anyone turn a single image into a cinematic character — then
bring it to life with scene art, short video clips, and a live, talking avatar
you can actually converse with. It runs inside the **Nimiq Pay** wallet, with
NIM and USDT payments built into the experience through a shared credits
balance.

Built for the **Nimiq Mini Apps Competition**.

## 📺 Watch the 2‑minute intro

See how Other Me works — from uploading an image to talking with your character:

[![Other Me — app intro](https://img.youtube.com/vi/__MXZPHh1cc/hqdefault.jpg)](https://www.youtube.com/watch?v=__MXZPHh1cc)

▶️ **[Watch on YouTube](https://www.youtube.com/watch?v=__MXZPHh1cc)**

## What it does

1. **Character Studio** — upload any image; AI analyzes it into a detailed
   30‑field character sheet and renders a polished character design.
2. **Scenes** — place your character in new cinematic settings and styles.
3. **Videos** — generate short (8‑second) video clips of your character, with
   conversational edits.
4. **Talk** — a live, voice‑driven talking avatar you can roleplay and chat with
   in real time.

Everything is paid for with a single **credits** balance. New users get free
renders to try it, then top up with **NIM** (with a bonus) or **USDT** — real
wallet transactions, native to Nimiq Pay.

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

## License

MIT — see the competition rules for details.
