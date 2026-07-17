/**
 * Scene + video galleries — IndexedDB (videos are megabytes of base64, far
 * beyond the localStorage quota the character library uses). All local for
 * the hackathon; post-hackathon these four functions swap to Firebase Storage.
 */

export interface SavedScene {
  id: string
  name: string
  characterName: string | null
  prompt: string
  imageDataUrl: string
  savedAt: string
}

export interface SavedVideo {
  id: string
  name: string
  characterName: string | null
  prompt: string
  videoDataUrl: string
  interactionId: string | null
  editsUsed: number
  savedAt: string
}

const DB_NAME = 'otherme-media'
const DB_VERSION = 1
const STORES = ['scenes', 'videos'] as const
type StoreName = typeof STORES[number]

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

export function saveMedia(store: StoreName, item: SavedScene | SavedVideo): Promise<IDBValidKey> {
  return withStore(store, 'readwrite', s => s.put(item))
}

export function deleteMedia(store: StoreName, id: string): Promise<undefined> {
  return withStore(store, 'readwrite', s => s.delete(id) as IDBRequest<undefined>)
}
