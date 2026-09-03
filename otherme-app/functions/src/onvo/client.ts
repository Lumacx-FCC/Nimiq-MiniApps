/**
 * ONVO Pay REST API client (SINPE Móvil rail). Auth is a single Bearer secret
 * key (onvo_test_secret_key_.../onvo_live_secret_key_...) sent directly —
 * unlike PayPal, there's no separate OAuth exchange, and unlike TiloPay,
 * sandbox vs. production is a different key rather than a different account
 * flag on the same credentials, so there's no "same host, wrong creds" risk
 * to guard against here.
 *
 * Field names below (`mobileNumber.number`, the `/confirm` path, `metadata`)
 * come from ONVO's OpenAPI spec (docs.onvopay.com/openapi.yaml) — the rendered
 * docs pages were thin specifically on the SINPE Móvil path, so a first
 * sandbox call (2 Sep 2026) 400'd on missing `mobileNumber.identification`/
 * `identificationType`, confirming those two are required alongside `number`.
 * The sandbox has fixed test numbers that simulate outcomes deterministically
 * (see docs.onvopay.com/en/payments/testing): +50688888888 succeeds after
 * ~15s, +50688889521 never resolves (stays pending), +50688884444 succeeds
 * after ~6 minutes.
 */
import { ONVO_API_BASE } from "../config.js";

/**
 * `mobileNumber.identificationType` enum, per ONVO's OpenAPI spec — the
 * Costa Rican national-ID category tied to the SINPE Móvil registration:
 *   0 Persona física nacional (national ID / cédula)
 *   1 Persona física residente (DIMEX)
 *   2 Entidad estatal
 *   3 Persona jurídica (company)
 *   4 Institución autónoma
 *   5 Diplomático
 *   9 Extranjero
 * (Note: 6/7/8 are not valid — this is ONVO's own enum, not a sequential list.)
 */
export type OnvoIdentificationType = 0 | 1 | 2 | 3 | 4 | 5 | 9;

async function onvoFetch<T>(path: string, secretKey: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ONVO_API_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`ONVO API ${path} failed (${res.status}): ${details.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface OnvoPaymentIntent {
  id: string;
  status: string;
}

/**
 * SINPE Móvil is a `mobile_number` payment method keyed to the PAYER's own
 * phone (their bank uses it to route the transfer request) — not our
 * merchant's receiving line, which ONVO already has on file for the account.
 */
export async function createSinpeMovilPaymentMethod(
  phoneE164: string,
  identification: string,
  identificationType: OnvoIdentificationType,
  secretKey: string,
): Promise<{ id: string }> {
  return onvoFetch("/payment-methods", secretKey, {
    type: "mobile_number",
    mobileNumber: { number: phoneE164, identification, identificationType },
  });
}

/** amountCentavos is the smallest currency unit — e.g. 250000 = CRC 2,500.00. */
export async function createPaymentIntent(
  amountCentavos: number,
  currency: string,
  metadata: Record<string, string>,
  secretKey: string,
): Promise<OnvoPaymentIntent> {
  return onvoFetch("/payment-intents", secretKey, { amount: amountCentavos, currency, metadata });
}

export async function confirmPaymentIntent(intentId: string, paymentMethodId: string, secretKey: string): Promise<OnvoPaymentIntent> {
  return onvoFetch(`/payment-intents/${intentId}/confirm`, secretKey, { paymentMethodId });
}

/** Polled by the reconciler as a safety net if the webhook is ever missed. */
export async function getPaymentIntent(intentId: string, secretKey: string): Promise<OnvoPaymentIntent> {
  return onvoFetch(`/payment-intents/${intentId}`, secretKey);
}
