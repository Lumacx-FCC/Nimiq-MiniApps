/**
 * Scene + video galleries — IndexedDB as a read-through cache, Firestore +
 * Storage as the cloud source of truth once a server session exists (Part C
 * Stage 2/3, mirrors character/library.ts's Stage 1 pattern exactly).
 * listMedia/saveMedia/deleteMedia stay the same signatures every caller
 * already uses — cloud reads/writes happen in the background (fire-and-forget
 * on save/delete; reconcileScenesWithCloud()/reconcileVideosWithCloud() pull
 * cloud state into the local cache and push up any local-only items, called
 * once per login from App.tsx's useCloudMediaSync). Logged-out / no session =
 * today's local-only behavior, unchanged.
 */
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, where } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage'
import { compressImageDataUrl } from '../character/library'
import { getFirebaseDb, getFirebaseStorage } from './firebase'
import { getCurrentUid, hasServerSession } from './session'

export interface SavedScene {
  id: string
  name: string
  characterName: string | null
  prompt: string
  /** A local data: URL, or (once synced) a Storage download URL — both are
   * valid <img src> values, so callers never need to branch on which. */
  imageDataUrl: string
  savedAt: string
}

export interface SavedVideo {
  id: string
  name: string
  characterName: string | null
  prompt: string
  /** A local data: URL, or (once synced) a Storage download URL. */
  videoDataUrl: string
  interactionId: string | null
  editsUsed: number
  savedAt: string
}

const DB_NAME = 'otherme-media'
const DB_VERSION = 1
const STORES = ['scenes', 'videos'] as const
type StoreName = typeof STORES[number]

const SCENES_COLLECTION = 'scenes'
const VIDEOS_COLLECTION = 'videos'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store))
          request.result.createObjectStore(store, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open the local media store'))
  })
}

async function withStore<T>(name: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(name, mode).objectStore(name))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('Local media store operation failed'))
    })
  }
  finally {
    db.close()
  }
}

export async function listMedia<T>(store: StoreName): Promise<T[]> {
  const items = await withStore<any[]>(store, 'readonly', s => s.getAll())
  return (items as T[]).sort((a: any, b: any) => (b.savedAt || '').localeCompare(a.savedAt || ''))
}

export async function saveMedia(store: StoreName, item: SavedScene | SavedVideo): Promise<IDBValidKey> {
  const key = await withStore(store, 'readwrite', s => s.put(item))
  void uploadMediaIfSignedIn(store, item)
  return key
}

export async function deleteMedia(store: StoreName, id: string): Promise<undefined> {
  const result = await withStore(store, 'readwrite', s => s.delete(id) as IDBRequest<undefined>)
  const uid = hasServerSession() ? getCurrentUid() : null
  if (uid) {
    void (store === 'scenes' ? deleteSceneFromCloud(uid, id) : deleteVideoFromCloud(uid, id)).catch(() => {})
  }
  return result
}

async function uploadMediaIfSignedIn(store: StoreName, item: SavedScene | SavedVideo): Promise<void> {
  const uid = hasServerSession() ? getCurrentUid() : null
  if (!uid)
    return
  try {
    if (store === 'scenes')
      await uploadSceneToCloud(uid, item as SavedScene)
    else
      await uploadVideoToCloud(uid, item as SavedVideo)
  }
  catch (e) {
    console.warn(`[mediaStore] cloud ${store} upload failed:`, e instanceof Error ? e.message : e)
  }
}

async function uploadSceneToCloud(uid: string, scene: SavedScene): Promise<void> {
  let imageUrl = scene.imageDataUrl
  if (imageUrl.startsWith('data:')) {
    // Scene images come back from gpt-image-2 uncompressed (unlike character
    // sheets) — compress only the cloud copy, local IndexedDB keeps the original.
    const compressed = await compressImageDataUrl(imageUrl)
    const storageRef = ref(getFirebaseStorage(), `users/${uid}/scenes/${scene.id}.webp`)
    await uploadString(storageRef, compressed, 'data_url')
    imageUrl = await getDownloadURL(storageRef)
  }
  await setDoc(doc(getFirebaseDb(), SCENES_COLLECTION, scene.id), {
    uid,
    name: scene.name,
    characterName: scene.characterName,
    prompt: scene.prompt,
    imageUrl,
    savedAt: scene.savedAt,
  })
}

async function deleteSceneFromCloud(uid: string, id: string): Promise<void> {
  await Promise.allSettled([
    deleteDoc(doc(getFirebaseDb(), SCENES_COLLECTION, id)),
    deleteObject(ref(getFirebaseStorage(), `users/${uid}/scenes/${id}.webp`)),
  ])
}

async function uploadVideoToCloud(uid: string, video: SavedVideo): Promise<void> {
  let videoUrl = video.videoDataUrl
  if (videoUrl.startsWith('data:')) {
    const storageRef = ref(getFirebaseStorage(), `users/${uid}/videos/${video.id}.mp4`)
    await uploadString(storageRef, videoUrl, 'data_url')
    videoUrl = await getDownloadURL(storageRef)
  }
  await setDoc(doc(getFirebaseDb(), VIDEOS_COLLECTION, video.id), {
    uid,
    name: video.name,
    characterName: video.characterName,
    prompt: video.prompt,
    videoUrl,
    interactionId: video.interactionId,
    editsUsed: video.editsUsed,
    savedAt: video.savedAt,
  })
}

async function deleteVideoFromCloud(uid: string, id: string): Promise<void> {
  await Promise.allSettled([
    deleteDoc(doc(getFirebaseDb(), VIDEOS_COLLECTION, id)),
    deleteObject(ref(getFirebaseStorage(), `users/${uid}/videos/${id}.mp4`)),
  ])
}

/**
 * Called once per login (App.tsx's useCloudMediaSync): pushes up any scene
 * that only exists locally, pulls the rest of the cloud set into the local
 * cache. Safe to call repeatedly — every write here is an idempotent
 * upsert-by-id, and unlike the sheets/avatars cache there's no size cap to
 * enforce, so nothing local ever gets dropped.
 */
export async function reconcileScenesWithCloud(uid: string): Promise<void> {
  try {
    const snap = await getDocs(query(collection(getFirebaseDb(), SCENES_COLLECTION), where('uid', '==', uid), orderBy('savedAt', 'desc')))
    const cloudScenes: SavedScene[] = snap.docs.map((d) => {
      const data = d.data() as any
      return { id: d.id, name: data.name, characterName: data.characterName ?? null, prompt: data.prompt, imageDataUrl: data.imageUrl, savedAt: data.savedAt }
    })
    const cloudIds = new Set(cloudScenes.map(s => s.id))
    const local = await listMedia<SavedScene>('scenes')

    await Promise.allSettled(local.filter(s => !cloudIds.has(s.id)).map(s => uploadSceneToCloud(uid, s)))

    const merged = new Map(local.map(s => [s.id, s]))
    for (const cs of cloudScenes) merged.set(cs.id, cs)
    await Promise.allSettled(Array.from(merged.values()).map(s => withStore('scenes', 'readwrite', store => store.put(s))))
  }
  catch (e) {
    console.warn('[mediaStore] cloud scene reconcile failed:', e instanceof Error ? e.message : e)
  }
}

/** Same shape as reconcileScenesWithCloud — see its doc comment. */
export async function reconcileVideosWithCloud(uid: string): Promise<void> {
  try {
    const snap = await getDocs(query(collection(getFirebaseDb(), VIDEOS_COLLECTION), where('uid', '==', uid), orderBy('savedAt', 'desc')))
    const cloudVideos: SavedVideo[] = snap.docs.map((d) => {
      const data = d.data() as any
      return { id: d.id, name: data.name, characterName: data.characterName ?? null, prompt: data.prompt, videoDataUrl: data.videoUrl, interactionId: data.interactionId ?? null, editsUsed: data.editsUsed ?? 0, savedAt: data.savedAt }
    })
    const cloudIds = new Set(cloudVideos.map(v => v.id))
    const local = await listMedia<SavedVideo>('videos')

    await Promise.allSettled(local.filter(v => !cloudIds.has(v.id)).map(v => uploadVideoToCloud(uid, v)))

    const merged = new Map(local.map(v => [v.id, v]))
    for (const cv of cloudVideos) merged.set(cv.id, cv)
    await Promise.allSettled(Array.from(merged.values()).map(v => withStore('videos', 'readwrite', store => store.put(v))))
  }
  catch (e) {
    console.warn('[mediaStore] cloud video reconcile failed:', e instanceof Error ? e.message : e)
  }
}
