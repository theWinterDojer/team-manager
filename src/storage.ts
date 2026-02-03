import type { AppState } from './types'

const DB_NAME = 'team-manager'
const DB_VERSION = 1
const STORE_NAME = 'app_state'
const STATE_KEY = 'state'

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const loadFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as AppState
  } catch {
    return null
  }
}

const saveToLocalStorage = (state: AppState) => {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

const clearLocalStorage = () => {
  try {
    localStorage.removeItem(STATE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export const loadAppState = async (): Promise<AppState | null> => {
  if (!('indexedDB' in window)) {
    return loadFromLocalStorage()
  }

  try {
    const db = await openDb()
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)

    const request = store.get(STATE_KEY)
    const result = await new Promise<AppState | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as AppState) || null)
      request.onerror = () => reject(request.error)
    })

    return result || loadFromLocalStorage()
  } catch {
    return loadFromLocalStorage()
  }
}

export const saveAppState = async (state: AppState) => {
  if (!('indexedDB' in window)) {
    saveToLocalStorage(state)
    return
  }

  try {
    const db = await openDb()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.put(state, STATE_KEY)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch {
    saveToLocalStorage(state)
  }
}

export const clearAppState = async () => {
  if (!('indexedDB' in window)) {
    clearLocalStorage()
    return
  }

  try {
    const db = await openDb()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.delete(STATE_KEY)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    clearLocalStorage()
  } catch {
    clearLocalStorage()
  }
}
