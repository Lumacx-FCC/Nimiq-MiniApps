import { getConfig } from '../config'

/**
 * PayPal checkout — PLACEHOLDER ONLY.
 *
 * ⚠️ Competition constraint: the Mini Apps Competition rules and the Nimiq
 * mini-app framework docs prohibit third-party payment providers (PayPal,
 * Stripe, …) inside Nimiq Pay — wallet payments must use the injected
 * providers. Keep `paypalEnabled: false` for the competition build.
 *
 * Intended for a future browser-only distribution. Production wiring:
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
