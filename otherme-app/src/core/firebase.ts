/**
 * Firebase client init for server-side auth (Phase 1 of the credits migration).
 *
 * This config is public and safe to commit — it only identifies the project.
 * Security comes from Firestore rules, the signed-challenge verification, and
 * on-chain payment checks (see otherme-app/docs/server-side-credits.md), not
 * from hiding these values. The secret AI keys live in Cloud Functions.
 *
 * We deliberately do NOT init Analytics: it needs consent handling and behaves
 * poorly in the Nimiq Pay WebView. Only App + Auth are used.
 */
import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBt2IHPk7eom8KOTcyH8kE65_HgnoQabug',
  authDomain: 'otherme-18f5b.firebaseapp.com',
  projectId: 'otherme-18f5b',
  storageBucket: 'otherme-18f5b.firebasestorage.app',
  messagingSenderId: '239756970799',
  appId: '1:239756970799:web:cbdcec378a4a87a04f2fda',
  measurementId: 'G-EDJ1HE44V7',
}

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

export function getFirebaseApp(): FirebaseApp {
  app ??= getApps().length ? getApp() : initializeApp(firebaseConfig)
  return app
}

export function getFirebaseAuth(): Auth {
  authInstance ??= getAuth(getFirebaseApp())
  return authInstance
}

/**
 * Firestore client, used by the Phase 4 confirming-payment UI to watch an
 * order doc via onSnapshot (the owner-read is permitted by firestore.rules).
 */
export function getFirebaseDb(): Firestore {
  dbInstance ??= getFirestore(getFirebaseApp())
  return dbInstance
}
