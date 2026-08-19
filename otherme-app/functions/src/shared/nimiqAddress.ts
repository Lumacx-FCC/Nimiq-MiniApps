/**
 * Pure Nimiq address helpers, split out of auth/routes.ts so they're directly
 * unit-testable without Express req/res plumbing.
 */

export function normalizeAddress(addr: string): string {
  return addr.replace(/\s+/g, "").toUpperCase();
}

export function isNimiqAddress(addr: string): boolean {
  return /^NQ[0-9A-Z]{34}$/.test(addr);
}
