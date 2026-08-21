/**
 * PayPal REST API client (backlog 4.7 Part B) — OAuth2 token (cached in
 * memory for the life of the instance) + thin fetch wrappers. Used by
 * webhook.ts to verify an incoming webhook's signature and to look up the
 * payer's email on the underlying order.
 */
import { PAYPAL_API_BASE, PAYPAL_APP_CLIENT_ID } from "../config.js";

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Cached ~60s short of PayPal's stated expiry so a near-expiry token is never reused. */
export async function getAccessToken(clientSecret: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now)
    return cachedToken.token;

  const basic = Buffer.from(`${PAYPAL_APP_CLIENT_ID}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok)
    throw new Error(`PayPal OAuth token request failed (${res.status})`);
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

export async function paypalGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok)
    throw new Error(`PayPal API GET ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

export async function paypalPost<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const res = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`PayPal API POST ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}
