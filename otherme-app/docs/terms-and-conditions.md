# Other Me — Terms & Conditions

**Not legal advice — and not yet reviewed by counsel.** The factual statements
below were written against the shipped code (2026-07-28) and are accurate to it.
All placeholders are now filled: operator is Other Me Labs (part of Studio Swai,
San José, Costa Rica), governing law and venue are Costa Rica, and the liability
cap is 3 months. **A Costa Rican legal review of the liability position and the
consumer-law carve-out is still outstanding.**

Last updated: 2026-07-28 · Operator: Other Me Labs — part of Studio Swai,
San José, Costa Rica · Contact: info@othermeapp.com

---

## 1. What Other Me is

Other Me is a creative tool that turns an image you provide into a character
sheet, and lets you place that character in scenes, generate short video clips,
and hold a spoken conversation with it. It runs as a web app at othermeapp.com
and as a mini app inside the Nimiq Pay wallet.

By uploading an image, buying credits, or starting a conversation you accept
these terms. If you don't accept them, don't use the app.

**Status.** Other Me is early software, built for the Nimiq Mini Apps
Competition. Features, prices, and limits may change without notice.

## 2. Your account depends on how you sign in

**Read this before buying credits.** Other Me currently keeps a separate account
for each sign-in method. Your identity is the Nimiq wallet address you connect
with, or the email address you register with — they are **not** the same account,
and they are **not** linked.

Consequences you should expect:

- Credits bought with a Nimiq wallet inside Nimiq Pay belong to **that wallet
  address**. Signing in later by email — in a desktop browser, for example —
  gives you a **different account with a different balance**, and your purchased
  credits will not appear there.
- Email registration is currently stored **on the device you registered on**. An
  email account created on your phone does not exist on your desktop; you would
  have to register again there, creating yet another separate account.
- Credits are not transferable between accounts, and we cannot merge accounts on
  request at this time.

If you want your credits available on desktop, use the same Nimiq wallet address
you purchased with. Account linking is planned but not available yet; until it
ships, treat each sign-in method as a separate account.

## 3. Credits and payments

- **Credits are a prepaid access balance, not money, not a deposit, and not a
  token.** They carry no monetary value, earn no interest, cannot be redeemed
  for cash, cannot be transferred, and are not a financial product.
- Purchases are **real blockchain transactions** you sign in your own wallet:
  NIM on the Nimiq network, or USDT on Polygon. We never take custody of your
  keys or your funds.
- **Blockchain payments are irreversible.** Once a transaction confirms it
  cannot be recalled by us or by you. Credits are granted only after the
  payment is verified on-chain, which normally takes under a minute but can take
  longer when a network is congested.
- **All purchases are final and non-refundable**, except where a refund is
  required by applicable consumer law.
- Paying with **USDT on Polygon requires you to hold POL** in the same wallet to
  cover the network's gas fee. This is a property of the Polygon network, not a
  charge by us. If you have no POL the transaction will fail; the credits are
  not deducted and no payment is taken. NIM payments do not have this
  requirement.
- If a payment succeeds on-chain but credits do not appear, contact us with the
  transaction hash and we will investigate.
- Generation is **charged per attempt, not per satisfactory result.** AI output
  is probabilistic; an image, clip, or reply you dislike still consumes the
  credits it cost. We do not refund credits for creative dissatisfaction.
- Prices are shown before purchase and may change at any time. Promotional
  pricing ends on the date stated at the time of the offer.

## 4. Images you upload

You are responsible for what you upload. By uploading an image you confirm that:

- you own it or have the rights to use it; and
- **every identifiable person in it has consented** to their likeness being used
  to generate an AI character, including scenes, video, and a synthetic voice; and
- it does not depict a **minor**; and
- you are not using it to impersonate a real person, to create sexual or
  intimate imagery of anyone, or to produce content that is deceptive,
  defamatory, harassing, or unlawful.

We do not verify consent and cannot do so. If you upload someone else's image
without permission, that is your responsibility, not ours.

We may refuse or stop processing any request, and may suspend access, where we
believe these terms are being broken. Our AI providers apply their own content
filters, which can reject a request independently of us.

## 5. Content the app generates

- **You own your creations** — the character sheets, scene images, video clips
  and transcripts you generate — to the extent they are capable of being owned.
  We claim no ownership of them.
- **AI output may not be copyrightable.** In several jurisdictions, work
  generated without sufficient human authorship cannot be protected. We make no
  representation that you hold enforceable rights in any generated asset.
- **Output is not exclusive.** Generative models can produce similar or
  identical results for different users from similar prompts. We cannot and do
  not guarantee uniqueness.
- You are responsible for how you use, publish, or commercialise what you
  generate, including complying with the terms of any platform you post it to.
- We do not use your images, characters, or conversations to train models, and we
  do not currently collect analytics of any kind. If that changes we will update
  these terms first.

## 6. Where your data actually lives

We keep as little as possible. Specifically:

| What | Where it is stored | Who can see it |
| --- | --- | --- |
| Character sheets, custom avatars | **Your device** (browser localStorage) | You |
| Scenes and video clips | **Your device** (browser IndexedDB) | You |
| Conversations with your character | **Nowhere.** Held in memory only, for the duration of the session | You, plus Google while the session is live (§7) |
| Credit balance and purchase history | Your device, **and** our server when you sign in with a Nimiq wallet | You, us |
| Wallet address, transaction hashes, amounts, credits granted | **Our server** (Firebase/Firestore) | You, us |
| Images sent for generation or analysis | **Not retained by us.** Passed through to the AI provider and discarded | Our AI providers (§10) |
| Files you create a share link for | **Our server** (Firebase Storage), at a public URL (§8) | Anyone with the link |

We do not sell your data. We do not run advertising. We do not store your
uploaded images or your generated assets on our servers except where you
explicitly create a share link.

## 7. Conversations and voice

- Conversations with your character are **not saved by us**. They exist only in
  your browser's memory while the conversation is open, and are lost when you
  reload the page, navigate away, or close the app. If you want to keep a
  transcript, copy it yourself before leaving.
- While a conversation is live, what you say or type — and your character's
  personality description — is sent **directly from your device to Google's
  Gemini API** in order to generate the reply and the voice. Our servers do not
  see or store this exchange. Google's handling of that data is governed by
  Google's terms, not ours.
- **Voice input inside Nimiq Pay uses your device's own speech recognition**,
  which on Android is provided by the operating system and may transmit audio to
  the vendor of that speech service (for example Google) for transcription. This
  is outside our control. If you would rather not use it, type instead — your
  character still replies aloud.
- Voices are **synthetic**. They are not recordings of, and are not intended to
  imitate, any real person.

## 8. Share links

When you share an image or clip from inside the Nimiq Pay wallet, the file is
uploaded to our storage and we give you a link. Please understand:

- **The link is public.** Anyone who has it can open the file. It is not
  password-protected and it is not indexed, but it is not private either.
- Do not create share links for anything you would not want a stranger to see.
- **Share links are temporary.** Shared files are deleted automatically once
  they are more than **24 hours** old, by a scheduled job that runs daily. A link
  may therefore stop working up to a day after the stated expiry, but it will
  stop working. Save anything you want to keep before then.
- You can ask us to delete a shared file sooner by contacting us with the link.

## 9. You are responsible for your own backups

This is the most important practical warning in this document.

Because your characters, scenes, and clips are stored **in your browser**, they
are permanently lost if you:

- clear your browser data, site data, or cache;
- use private/incognito browsing;
- uninstall or reset the wallet app or browser;
- run out of device storage while saving; or
- switch to a different device or browser.

The same applies to the credit balance of an **email-registered** account, which
exists only on that device. A credit balance attached to a **Nimiq wallet
address** is held on our server as well and survives losing the device, provided
you sign in with the same wallet.

**Export anything you want to keep.** We cannot recover lost local data — we
never had a copy of it.

Browser storage is also finite (roughly a few megabytes for characters). The app
warns you when a save fails. If you ignore that warning, the item is not saved.

## 10. Third parties we send data to

To generate anything, we must pass your content to AI providers:

- **OpenAI** — image generation and editing, and character personality text.
- **Google (Gemini)** — image analysis, video generation, and the live voice
  conversation, which your browser connects to directly.
- **Google Firebase** — authentication, the credits ledger, and share-link storage.
- **Public blockchain infrastructure** — Nimiq and Polygon nodes, to verify your
  payments. Note that blockchain transactions are **public and permanent by
  design**: the amount, the addresses, and the timing of your purchase are
  visible to anyone, forever, and cannot be deleted by us or by you.
- **CoinGecko** — the NIM/USD exchange rate shown on the credits screen.

Each provider processes data under its own terms. We do not control their
retention or their use of submitted content.

## 11. Prohibited use

Do not use Other Me to: create sexual content involving anyone, or any content
involving minors; impersonate a real person or organisation; produce
disinformation, fake evidence, or non-consensual intimate imagery; harass,
threaten, or defame; infringe copyright or trademarks; attempt to extract our
API keys, bypass the credits system, or attack the service; or break any
applicable law.

We may suspend or terminate access immediately for any of the above. Credits on
a terminated account are forfeited.

## 12. Availability, warranty, and liability

- The service is provided **"as is" and "as available"**, without warranties of
  any kind. We do not promise it will be uninterrupted, error-free, or that any
  particular output will be produced.
- We depend on third-party AI providers and public blockchains. Their outages,
  rate limits, content filters, and network congestion will affect the app and
  are outside our control.
- Features documented as limitations — no file downloads and no live microphone
  inside the Nimiq Pay wallet, USDT requiring POL for gas — are known
  constraints of the host platform, not defects.
- To the maximum extent permitted by law, our total liability to you for any
  claim is limited to the amount you paid us in the 3 months before the
  claim. We are not liable for lost data, lost profits, or indirect or
  consequential loss.
- Nothing in these terms limits liability that cannot be limited by law.

## 13. Changes, termination, and law

We may update these terms; material changes will be announced in the app or at
othermeapp.com, and continued use after that constitutes acceptance. You may
stop using the app at any time; you can delete your local data by clearing site
data for othermeapp.com. To have server-side records associated with your wallet
address deleted, contact us — note that on-chain transaction records cannot be
deleted by anyone.

These terms are governed by the laws of **Costa Rica**, and disputes are subject
to the competent courts of Costa Rica.

---

### Engineering notes

Resolved:

1. ✅ **§8 retention is now enforced.** The `cleanupShares` scheduled function
   (`functions/src/index.ts`) deletes `shares/**` objects older than
   `SHARE_TTL_HOURS` daily. Previously the client was told 24 hours while nothing
   ever deleted the file.
2. ✅ **§2 is disclosed in the UI**, not just here — on the Credits screen under
   the balance and on the Login screen before the user picks a method (EN + ES).
   The login subtitle no longer claims "one account", which was untrue.
3. ✅ **§5 analytics claim removed** — we collect none, so the permission is not
   reserved.

Still open before publishing:

4. **Legal review** by Costa Rican counsel: the liability cap (§12) and the
   consumer-law carve-out on refunds (§3) are still open (marked `[…]`).
   Jurisdiction and venue are now set to Costa Rica.
5. **Spanish translation**, once the English text is legally settled — the app is
   fully bilingual and a Spanish-speaking user should not have to accept English
   terms.
6. **Wire it into the app**: a `/terms` route plus a footer link, and a
   first-run acceptance checkpoint if legal advises one.
