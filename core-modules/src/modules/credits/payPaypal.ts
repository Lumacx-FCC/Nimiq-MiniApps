import { getConfig } from '../config'

/**
 * PayPal checkout via Hosted Buttons — one fixed-price button per credit
 * pack, configured in the PayPal Business dashboard (not created here).
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
 * Server-side crediting (backlog 4.7 Part B) is a separate, not-yet-built
 * piece: a webhook verifies the payment and matches it to an account by
 * payer email, with a manual-grant fallback via /promos_management for
 * anything that can't be confidently matched. Hosted Buttons don't expose a
 * way to pass our own order reference at render time, so this file only
 * renders PayPal's own checkout UI — it never sees or reports payment
 * completion itself.
 */

declare global {
  interface Window {
    paypal?: {
      HostedButtons: (opts: { hostedButtonId: string }) => { render: (selector: string) => void }
    }
  }
}

export function isPaypalEnabled(): boolean {
  return getConfig().paypalEnabled
}

/**
 * Placeholder kept for the Vue demo app's MVP `buyWithPaypal` (client-trust
 * grant model, `paypalEnabled` stays false there so this is unreachable) —
 * otherme-app uses `renderHostedButton` below instead, which fits Hosted
 * Buttons' actual checkout shape (an embedded UI, not an awaitable pay call).
 */
export async function payPaypal(_usdAmount: number): Promise<string> {
  throw new Error('PayPal checkout is not wired up yet for this app.')
}

let sdkLoaded: Promise<void> | null = null

/** Injects the PayPal JS SDK once, memoized (mirrors auth/googleAuth.ts's loadGis()). */
function loadPaypalSdk(): Promise<void> {
  const clientId = getConfig().paypalClientId
  if (!clientId)
    return Promise.reject(new Error('PayPal is not configured (missing client ID)'))
  sdkLoaded ??= new Promise((resolve, reject) => {
    if (window.paypal)
      return resolve()
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=hosted-buttons&disable-funding=venmo&currency=USD`
    script.crossOrigin = 'anonymous'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load the PayPal SDK'))
    document.head.appendChild(script)
  })
  return sdkLoaded
}

/**
 * Renders a PayPal Hosted Button into `#containerId`, clearing any previous
 * render first (switching packages re-renders into the same container).
 */
export async function renderHostedButton(hostedButtonId: string, containerId: string): Promise<void> {
  await loadPaypalSdk()
  const container = document.getElementById(containerId)
  if (container)
    container.innerHTML = ''
  window.paypal!.HostedButtons({ hostedButtonId }).render(`#${containerId}`)
}
