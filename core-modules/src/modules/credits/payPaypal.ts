import { getConfig } from '../config'

/**
 * PayPal checkout — PLACEHOLDER ONLY, real wiring still pending PayPal
 * Business account credentials + the Smart Buttons snippet.
 *
 * ⚠️ Competition constraint: the Mini Apps Competition rules and the Nimiq
 * mini-app framework docs prohibit third-party payment providers (PayPal,
 * Stripe, …) inside Nimiq Pay — wallet payments must use the injected
 * providers. Keep `paypalEnabled: false` for any app/build that only targets
 * that context. otherme-app (full production, not just the competition
 * build) sets it `true` and instead gates visibility per signed-in identity
 * in Credits.tsx (hidden for wallet sign-ins, shown for email/Google) — see
 * that file's `showPaypal`.
 *
 * Production wiring, once the credentials/snippet are in hand:
 * 1. PayPal Business account → REST app → client ID into config.
 * 2. Load the PayPal JS SDK and render Smart Buttons (PayPal + Card).
 * 3. Cloud Function creates + captures the order server-side, then credits
 *    Firestore — same verify-then-grant seam as the crypto payments.
 */

export function isPaypalEnabled(): boolean {
  return getConfig().paypalEnabled
}

export async function payPaypal(_usdAmount: number): Promise<string> {
  throw new Error('PayPal checkout is not wired up yet — it needs the production backend (PayPal SDK + server-side order capture).')
}
