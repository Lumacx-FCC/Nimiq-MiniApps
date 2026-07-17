import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { doc, getFirestore, setDoc, type Firestore } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseIsConfigured() {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.storageBucket && config.appId);
}

export function getFirebaseServices(): FirebaseServices | null {
  if (!firebaseIsConfigured()) return null;
  const app = getApps().length ? getApp() : initializeApp(config);
  return { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
}

export async function persistAvatar(
  slot: number,
  reference: File,
  spriteBlob: Blob,
  profile: Record<string, unknown>,
) {
  const services = getFirebaseServices();
  if (!services) return null;

  const credential = services.auth.currentUser
    ? { user: services.auth.currentUser }
    : await signInAnonymously(services.auth);
  const uid = credential.user.uid;
  const base = `users/${uid}/avatars/slot-${slot}`;
  const referenceRef = ref(services.storage, `${base}/reference-${reference.name}`);
  const spriteRef = ref(services.storage, `${base}/sprite.png`);
  await Promise.all([uploadBytes(referenceRef, reference), uploadBytes(spriteRef, spriteBlob)]);
  const [referenceUrl, spriteUrl] = await Promise.all([
    getDownloadURL(referenceRef),
    getDownloadURL(spriteRef),
  ]);
  await setDoc(doc(services.db, "users", uid, "avatars", `slot-${slot}`), {
    slot,
    referenceUrl,
    spriteUrl,
    profile,
    updatedAt: new Date().toISOString(),
  });
  return { referenceUrl, spriteUrl };
}
