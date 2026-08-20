/**
 * Read (and optionally recover) a single orders/{id} doc directly against
 * Firestore — for debugging a stuck/failed purchase without opening the
 * Firebase console. Needs Application Default Credentials for the project
 * (same as set-admin-claim.mjs): `gcloud auth application-default login`,
 * or GOOGLE_APPLICATION_CREDENTIALS pointed at a service account key.
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *   cd otherme-app/functions
 *   node scripts/inspect-order.mjs <orderId>              # read-only
 *   node scripts/inspect-order.mjs <orderId> --resubmit   # reset to
 *     "submitted" (attempts:0, failedReason cleared) so the NEXT scheduled
 *     reconciler pass re-verifies it on-chain from scratch and grants it if
 *     the payment is real. Use this to recover an order that only failed
 *     because the RPC provider was down (a genuine mismatch would just fail
 *     again, safely) — never use it to force-grant a suspicious order.
 */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const orderId = process.argv[2];
const resubmit = process.argv.includes("--resubmit");
if (!orderId) {
  console.error("Usage: node scripts/inspect-order.mjs <orderId> [--resubmit]");
  process.exit(1);
}

// Explicit projectId — ADC's auto-detection can fail ("Unable to detect a
// Project Id") for a bare script outside the Functions runtime, depending on
// how `gcloud auth application-default login` was set up on this machine.
const { projects } = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url)));
initializeApp({ projectId: projects.default });
const ref = getFirestore().collection("orders").doc(orderId);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`No order ${orderId}`);
  process.exit(1);
}

console.log(JSON.stringify(snap.data(), null, 2));

if (resubmit) {
  const order = snap.data();
  if (!order.txHash) {
    console.error("Refusing to resubmit — order has no txHash to re-verify.");
    process.exit(1);
  }
  await ref.update({
    status: "submitted",
    attempts: 0,
    lastCheckedAt: Date.now(),
    failedReason: null,
  });
  console.log(`\nReset ${orderId} to "submitted" (attempts:0). The next scheduled reconcile pass (every 1 min) will re-verify txHash ${order.txHash} on-chain and grant it if it's genuinely confirmed — it will fail again safely if it isn't.`);
}
