// IndexedDB wrapper for local storage
import type { WordCard } from "./types"

const DB_NAME = "context-vocab-db"
const DB_VERSION = 1
const STORE_NAME = "word-cards"

let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("next_review_at", "next_review_at", { unique: false })
        store.createIndex("word", "word", { unique: false })
        store.createIndex("created_at", "created_at", { unique: false })
      }
    }
  })
}

export async function getAllCards(): Promise<WordCard[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getCard(id: string): Promise<WordCard | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveCard(card: WordCard): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(card)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteCard(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getDueCards(): Promise<WordCard[]> {
  const db = await openDB()
  const now = Date.now()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index("next_review_at")
    const range = IDBKeyRange.upperBound(now)
    const request = index.getAll(range)

    request.onsuccess = () => {
      const results = request.result.sort((a: WordCard, b: WordCard) => a.next_review_at - b.next_review_at)
      resolve(results)
    }
    request.onerror = () => reject(request.error)
  })
}

export function generateId(): string {
  return crypto.randomUUID()
}
