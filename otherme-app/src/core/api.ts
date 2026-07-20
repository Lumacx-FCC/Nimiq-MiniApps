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
