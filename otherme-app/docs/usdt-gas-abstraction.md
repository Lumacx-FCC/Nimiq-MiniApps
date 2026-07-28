# Gasless USDT in a Nimiq Pay mini app

Status: **Finding confirmed · fix designed, not built** (deferred past Cycle I)
Owner: OtherMe / FCC core-modules
Last updated: 2026-07-27

Why USDT payments in this app require the user to hold POL, why that is not
fixable by "using the native Nimiq Pay flow," and the meta-transaction relayer
design that would fix it. Companion to `server-side-credits.md`, whose reconciler
this design reuses unchanged.

## 1. The finding

We asked the Nimiq team whether a mini app can accept USDT without users holding
POL for gas. Their answer: native Nimiq Pay USDT has automatic gas abstraction,
POL is only needed on the `window.ethereum` EVM path, and if we use that path we
must "handle gas abstraction separately in your Mini App."

The second half is the operative part. **There is no native stablecoin rail to
switch to.**

### 1.1 The SDK is NIM-only

`@nimiq/mini-app-sdk@0.1.0` (latest; published 2026-05-19) exposes exactly ten
wallet methods, hard-coded in a `WALLET_METHODS` whitelist in `dist/provider.js`:

```
listAccounts, sign, sendBasicTransaction, sendBasicTransactionWithData,
sendNewStakerTransaction, sendStakeTransaction, sendSetActiveStakeTransaction,
sendUpdateStakerTransaction, sendRetireStakeTransaction, sendRemoveStakeTransaction
```

All amounts are `number` in Luna. No method takes a currency, asset, token, or
chain parameter. `nimiq.request()` is not a back door — methods outside the
whitelist are proxied to a Nimiq JSON-RPC node, not to the wallet UI, and throw
without a configured RPC URL.

So `window.ethereum` is the only stablecoin path that exists for a mini app, and
`payUsdt.ts` is already on it. The `USDT_GAS_REQUIRED` handling and the POL
warning on the Credits page are correct behavior, not a bug.

### 1.2 Nimiq's own docs confirm the gap

`mini-apps/features/evm-tokens.md`:

> When sending ERC-20 tokens through a mini app, the transaction goes through the
> EVM provider `window.ethereum`. This is different from sending USDT natively
> through Nimiq Pay, which uses gas abstraction. In a mini app, standard EVM gas
> rules apply.

and, as a callout:

> The user must hold the native token of the chain to cover gas fees. On Polygon,
> this is POL (formerly MATIC). On Ethereum and Arbitrum, ETH. If the user has no
> native token balance, the transaction will fail.

Worth noting the mini-apps skill bundled in this repo never mentions gas at all —
this limitation is only findable in the upstream feature doc.

### 1.3 What the wallet actually does, and why we can't reach it

Nimiq's own abstraction is OpenGSN v2: the wallet builds an EIP-712
meta-transaction, hands it to a relay server (it scouts several and picks the
cheapest), and a transfer contract's `transferWithApproval` swaps enough
stablecoin to POL via Uniswap V3 to repay the relayer, quoted with a 10% buffer
and refunded if unused. The user pays the fee in the stablecoin itself.

All of that lives inside the wallet's send flow. None of it is surfaced to a
WebView mini app — no provider method, no RPC, no contract we're authorized to
call. Reaching it would mean reimplementing it.

## 2. The designed fix: our own meta-transaction relayer

Polygon USDT (`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`) has no EIP-2612
`permit`, but it is a `UChildERC20` and inherits `NativeMetaTransaction`, so it
implements:

```solidity
executeMetaTransaction(address userAddress, bytes functionSignature,
                       bytes32 sigR, bytes32 sigS, uint8 sigV)
```

Nimiq Pay's EVM provider exposes `eth_signTypedData_v4`. That is the whole
unlock: the user signs off-chain (no gas, no POL), and we submit and pay the POL.

### 2.1 Flow

1. **Client** creates the order as it does today (`POST /api/orders` → server
   fixes `expectedAmount` / `expectedBaseUnits` / `credits`).
2. **Client** reads the meta-tx nonce: `eth_call` → `getNonce(user)` on the USDT
   contract. This is the token's own meta-tx nonce, *not* the account nonce.
3. **Client** ABI-encodes `transfer(treasury, expectedBaseUnits)` as
   `functionSignature` (viem is already a client dependency, used by `payUsdt.ts`).
4. **Client** calls `eth_signTypedData_v4`. Note Polygon's domain is
   **non-standard** — it uses `salt` (the 32-byte chain id) instead of `chainId`,
   and getting this wrong yields a signature the contract rejects with no useful
   revert reason:

   ```
   domain: { name: "(USDT)", version: "1",
             verifyingContract: <USDT>, salt: hex32(137) }
   MetaTransaction: [ nonce: uint256, from: address, functionSignature: bytes ]
   ```

   `name` must match the contract's actual EIP-712 domain name exactly — read it
   on-chain rather than assuming, since Polygon's child tokens are inconsistent here.
5. **Client** POSTs `{ orderId, userAddress, functionSignature, r, s, v }` to a
   new relayer function.
6. **Relayer** validates (see §3), submits `executeMetaTransaction` paying POL
   from a hot wallet, returns the tx hash.
7. **Client** claims the order with that hash and its own address as
   `payerAddress` — the address that signed, which is what the Transfer log will
   carry.
8. **Reconciler grants, unchanged.**

### 2.2 Why step 8 needs no changes

`reconciler/verifyUsdt.ts` never calls `eth_getTransactionByHash`. It asserts
only on the receipt and the ERC-20 `Transfer` log: receipt status `0x1`, a log
from the USDT contract with the `Transfer` topic, `topics[2] == treasury`,
`topics[1] == payerAddress`, `data == expectedBaseUnits`, and 5 confirmations.

Under `executeMetaTransaction` the Transfer log's `from` is `msgSender` — the
user — while `tx.from` is our relayer and is never read. `log.address` is still
the USDT contract, because `executeMetaTransaction` is a method *on* the token.
Every assertion holds.

This is load-bearing and easy to break, so it is now commented in place in
`verifyUsdt.ts`. In particular §8 of `server-side-credits.md` specifies a
stricter check than what shipped ("tx `to == USDT contract`", decode with viem);
a `tx.to` check would still be safe, a `tx.from == payerAddress` check would not.

**One tx hash per order is a hard constraint.** `receipt.logs.find` takes the
first matching Transfer, so batching multiple users into one relayed tx would
fail every order but the first with "payer mismatch."

### 2.3 A rejected alternative: POL gas drip

Send the user a few cents of POL, then let the normal `eth_sendTransaction`
proceed. It avoids the EIP-712 work, but needs the *same* hot wallet, nonce
safety, quotas, and paid RPC — identical infrastructure cost — while adding a
second on-chain wait to the purchase and leaving a directly drainable faucet
exposed. Same cost, worse UX, worse abuse profile. Not worth it.

## 3. Prerequisites that do not exist today

Each is new work, and the last three are the reason this is deferred.

1. **A private key in Secret Manager** — the first in this codebase. Nothing in
   `functions/` holds key material today; custom-token signing goes through IAM
   `signBlob` with the runtime service account. Create the secret *before*
   adding `defineSecret`, or the deploy fails — that is exactly why
   `RECONCILE_SECRETS` ships empty at `functions/src/index.ts:37`. The runtime SA
   also needs `roles/secretmanager.secretAccessor` on it.
2. **A dedicated Cloud Function, not a route on `api`.** `api` is one
   1 GiB / 540 s Express process that also serves unauthenticated AI routes
   (`/api/generate-video` and friends have no `requireUid`). A spending key must
   not share a process with the largest attack surface in the app.
3. **Nonce safety.** `setGlobalOptions({ maxInstances: 10 })` means up to ten
   concurrent instances signing from one hot wallet. Either `maxInstances: 1` on
   the relayer, or a Cloud Tasks queue at concurrency 1, or a Firestore nonce
   lease.
4. **Per-uid quota and a global daily spend ceiling.** There is **no rate
   limiting anywhere in `functions/`** — a known gap (`server-side-credits.md`
   §Spam) that becomes a direct spend liability here. Minimum: gate sponsorship
   on the caller owning a `pending` order for the amount being signed, and
   check + increment a counter in the same transaction as the send. Note the uid
   is an NQ address; nothing binds a user to a `0x` address server-side today
   (`payerAddress` is unvalidated client input), so the quota must key on uid.
5. **A paid `POLYGON_RPC_URL`.** Production reads from the free public
   `https://polygon-rpc.com`; a relayer needs reliable `eth_sendRawTransaction`.
   `reconciler/rpc.ts` supports HTTP Basic only, so a URL-embedded key
   (Alchemy/Infura style) works as-is while a header-key provider needs a small
   change.
6. **A kill switch** read from env, so sponsorship can be disabled without a
   redeploy.
7. **`viem` in `functions/`** for ABI encoding and raw-tx signing. It is already
   a vetted repo dependency but not a functions one; expect the same dynamic
   `import()` treatment as `@nimiq/core` under `NodeNext` + `target: es2017`.

## 4. Testing constraint

Nimiq Pay will not open `*.trycloudflare.com`, so this flow cannot be tested
locally at all — device testing means deploying to production, against a
live-money treasury. That argues for, in order:

1. Validate the EIP-712 domain and `executeMetaTransaction` on **Amoy** first,
   added via `wallet_addEthereumChain` (handle error `4902`).
2. Extend `functions/scripts/validate-usdt.mjs` to decode a relayed receipt
   offline and confirm the Transfer log's `from` is the user, before any mainnet
   attempt.
3. Ship behind the §3.6 kill switch, defaulted off, with a minimal POL float.

## 5. USDC

Recorded so it isn't re-litigated. Adding USDC to the EVM path is trivial —
another 6-decimal ERC-20 contract address — but it **inherits the identical POL
problem**, so on its own it solves nothing.

- Bridged Polygon USDC (PoS) is **not** EIP-3009 compatible, so the clean
  `transferWithAuthorization` single-call relay is unavailable there.
- Native Polygon USDC (Circle) does implement `permit`, which would work with a
  two-step `permit` + `transferFrom` relay — but that is more moving parts than
  USDT's single `executeMetaTransaction`.
- Hackathon eligibility names **USDT, not USDC**
  (`NIMIQ-HACKATHON-REFERENCE.md`: "Must integrate Nimiq Pay and support USDT,
  NIM, or both").

USDT stays the rail. Revisit only if users actually ask for USDC.

## 6. Draft reply to the Nimiq team

> Thanks — that clarifies things, and the OpenGSN write-up was useful.
>
> To confirm our read: we're on the `window.ethereum` path by necessity rather
> than choice. `@nimiq/mini-app-sdk@0.1.0` whitelists ten wallet methods, all
> NIM/Luna, with no currency or token parameter, so there's no native USDT flow a
> mini app can call — which matches your `mini-apps/features/evm-tokens.md`:
> "This is different from sending USDT natively through Nimiq Pay, which uses gas
> abstraction. In a mini app, standard EVM gas rules apply," plus the callout that
> the user must hold POL. If we've missed a method, we'd be glad to be wrong.
>
> So we're taking your second suggestion and handling abstraction ourselves:
> Polygon USDT implements `executeMetaTransaction`, and since Nimiq Pay exposes
> `eth_signTypedData_v4`, the user can sign gaslessly while we relay and pay the
> POL. That works, but it means every mini app wanting stablecoin payments has to
> run a funded relayer — which is a real barrier for hackathon-scale teams, and
> the likely reason most entries go NIM-only.
>
> Two questions:
>
> 1. Is exposing the wallet's existing gas abstraction to mini apps on the
>    roadmap — e.g. a sponsored-transaction or stablecoin-payment method on the
>    Nimiq provider?
> 2. Short of that, would Nimiq consider documenting a reference relayer pattern,
>    or operating a shared relay mini apps can point at?
>
> One small note for the docs: the mini-app SDK's `send*`/`listAccounts`/`sign`
> methods return `T | ErrorResponse` and resolve rather than reject on failure,
> but the API reference documents them as plain values and describes
> rejection-style errors. It's an easy footgun — a naive
> `const hash = await sendBasicTransaction(...)` silently yields an object.
