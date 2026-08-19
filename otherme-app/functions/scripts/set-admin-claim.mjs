/**
 * One-time grant of the `admin: true` custom claim, checked by
 * src/auth/requireAuth.ts's requireAdmin() to gate POST /api/admin/grant-credits.
 *
 * There is no UI for custom claims — this has to be a script, run once per
 * uid that should be able to grant contest/promo credits. Needs Application
 * Default Credentials for the target Firebase project (run `gcloud auth
 * application-default login` first, or set GOOGLE_APPLICATION_CREDENTIALS to
 * a service account key with the Firebase Admin role).
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *   cd otherme-app/functions
 *   node scripts/set-admin-claim.mjs <uid>
 *
 * <uid> is the Firebase uid to grant — for a Nimiq wallet login this is the
 * NQ address; for email/Google it's the Firebase uid shown in the console.
 * The custom claim only takes effect on that uid's NEXT sign-in (or after it
 * force-refreshes its ID token) — Firebase doesn't retroactively invalidate
 * already-issued tokens.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/set-admin-claim.mjs <uid>");
  process.exit(1);
}

initializeApp();

const auth = getAuth();
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
console.log(`Granted admin:true to ${uid} (${user.email || user.providerData[0]?.uid || "no email"}).`);
console.log("Takes effect on that account's next sign-in / token refresh.");
