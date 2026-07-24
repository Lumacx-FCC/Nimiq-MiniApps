/**
 * Shared verification result type for the Phase 4 reconciler.
 *
 *   confirmed → the on-chain tx matches the order past the confirmation depth;
 *               grant credits.
 *   pending   → tx not mined yet, or mined but not deep enough; keep retrying.
 *   mismatch  → the tx exists but does NOT match (wrong amount/recipient/payer,
 *               reverted, wrong reference); fail the order now.
 */
export type VerifyState = "confirmed" | "pending" | "mismatch";

export interface VerifyResult {
  state: VerifyState;
  reason?: string;
}
