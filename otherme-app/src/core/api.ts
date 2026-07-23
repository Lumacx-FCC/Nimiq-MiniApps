/**
 * API base URL.
 *
 * Dev: empty string — relative /api/* hits the Vite middleware (server/api.ts).
 * Prod: the deployed Cloud Function's direct URL. We bypass the Firebase
 * Hosting /api rewrite on purpose — Hosting caps proxied calls at 60s, which is
 * too short for image/video generation. The function itself allows up to 540s.
 */
export const API_BASE = import.meta.env.DEV
  ? ''
  : 'https://us-central1-otherme-18f5b.cloudfunctions.net'

export const apiUrl = (path: string): string => `${API_BASE}${path}`

/**
 * Auth/credits endpoints (server-side login + on-chain verification) always hit
 * the deployed Cloud Function — even in dev — because they need Firestore and
 * Firebase Auth, which the Vite dev middleware (server/api.ts) does not run.
 * The function sets permissive CORS, so a dev tunnel origin can call it.
 */
export const SERVER_BASE = 'https://us-central1-otherme-18f5b.cloudfunctions.net'

export const serverUrl = (path: string): string => `${SERVER_BASE}${path}`
