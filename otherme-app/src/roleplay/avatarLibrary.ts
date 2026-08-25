/**
 * Custom talking avatars — localStorage as a read-through cache, Firestore +
 * Storage as the cloud source once a server session exists (Part C Stage 1).
 * listAvatars/persistAvatars stay synchronous, unchanged for every caller;
 * cloud sync happens in the background. There's no separate delete — callers
 * already do it by calling persistAvatars with a filtered array, so cloud
 * sync diffs the new array against what's in Firestore to add/update/remove.
 * Logged-out / no session = today's local-only behavior, unchanged.
 */
import type { AvatarProfile } from './types'
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage'
import { AVATAR_SLOTS_UNLOCK_KEY, DEFAULT_AVATAR_SLOTS, UNLOCKED_AVATAR_SLOTS } from '../core/config'
import { getFirebaseDb, getFirebaseStorage } from '../core/firebase'
import { getCurrentUid, hasServerSession } from '../core/session'

function unlockedSlotCount(): number {
  try {
    return localStorage.getItem(AVATAR_SLOTS_UNLOCK_KEY) === 'true' ? UNLOCKED_AVATAR_SLOTS : DEFAULT_AVATAR_SLOTS
  }
  catch {
    return DEFAULT_AVATAR_SLOTS
  }
}

const KEY = 'otherme:avatars'
const AVATARS_COLLECTION = 'avatars'

export function listAvatars(): AvatarProfile[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as AvatarProfile[]
  }
  catch {
    return []
  }
}

export function persistAvatars(avatars: AvatarProfile[]): boolean {
  let ok: boolean
  try {
    localStorage.setItem(KEY, JSON.stringify(avatars))
    ok = true
  }
  catch {
    // Quota exceeded — keep only the newest three avatars' sprites.
    try {
      const slim = avatars.slice(0, 3)
      localStorage.setItem(KEY, JSON.stringify(slim))
      ok = true
    }
    catch {
      ok = false
    }
  }
  if (ok)
    void syncAvatarsIfSignedIn(avatars)
  return ok
}

async function deleteAvatarFromCloud(uid: string, avatarId: string, outfitIds: string[]): Promise<void> {
  await Promise.allSettled([
    deleteDoc(doc(getFirebaseDb(), AVATARS_COLLECTION, avatarId)),
    ...outfitIds.map(outfitId => deleteObject(ref(getFirebaseStorage(), `users/${uid}/avatars/${avatarId}/${outfitId}.webp`))),
  ])
}

async function uploadAvatarToCloud(uid: string, avatar: AvatarProfile): Promise<void> {
  const outfits = await Promise.all(avatar.outfits.map(async (outfit) => {
    if (!outfit.spriteUrl.startsWith('data:'))
      return outfit // already synced
    const storageRef = ref(getFirebaseStorage(), `users/${uid}/avatars/${avatar.id}/${outfit.id}.webp`)
    await uploadString(storageRef, outfit.spriteUrl, 'data_url')
    const spriteUrl = await getDownloadURL(storageRef)
    return { ...outfit, spriteUrl }
  }))
  await setDoc(doc(getFirebaseDb(), AVATARS_COLLECTION, avatar.id), { uid, ...avatar, outfits })
}

async function syncAvatarsIfSignedIn(avatars: AvatarProfile[]): Promise<void> {
  const uid = hasServerSession() ? getCurrentUid() : null
  if (!uid)
    return
  try {
    const currentIds = new Set(avatars.map(a => a.id))
    const snap = await getDocs(query(collection(getFirebaseDb(), AVATARS_COLLECTION), where('uid', '==', uid)))
    const toDelete = snap.docs.filter(d => !currentIds.has(d.id))

    await Promise.allSettled([
      ...avatars.map(a => uploadAvatarToCloud(uid, a)),
      ...toDelete.map(d => deleteAvatarFromCloud(uid, d.id, ((d.data().outfits as { id: string }[]) || []).map(o => o.id))),
    ])
  }
  catch (e) {
    console.warn('[avatarLibrary] cloud sync failed:', e instanceof Error ? e.message : e)
  }
}

/**
 * Called once per login (core/auth.ts): pushes up any avatar that only exists
 * locally, pulls the rest of the cloud set into the local cache. Safe to call
 * repeatedly — every write here is an idempotent overwrite-by-id.
 */
export async function reconcileAvatarsWithCloud(uid: string): Promise<void> {
  try {
    const snap = await getDocs(query(collection(getFirebaseDb(), AVATARS_COLLECTION), where('uid', '==', uid)))
    const cloudAvatars: AvatarProfile[] = snap.docs.map((d) => {
      const { uid: _uid, ...rest } = d.data() as AvatarProfile & { uid: string }
      return rest
    })
    const cloudIds = new Set(cloudAvatars.map(a => a.id))
    const local = listAvatars()

    await Promise.allSettled(local.filter(a => !cloudIds.has(a.id)).map(a => uploadAvatarToCloud(uid, a)))

    const merged = new Map(local.map(a => [a.id, a]))
    for (const ca of cloudAvatars) merged.set(ca.id, ca)
    // Cap to the user's actual unlocked slot count (3, or 8 once paid for) —
    // a hardcoded 3 here would silently hide slots 4-8 on every login for
    // anyone who unlocked the extra tier, even though nothing was deleted.
    localStorage.setItem(KEY, JSON.stringify(Array.from(merged.values()).slice(0, unlockedSlotCount())))
  }
  catch (e) {
    console.warn('[avatarLibrary] cloud reconcile failed:', e instanceof Error ? e.message : e)
  }
}
