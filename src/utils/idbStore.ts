/**
 * Lightweight IndexedDB wrapper for PIM offline-first storage.
 * Provides async get/set/del over a dedicated 'pim-store' object store.
 * Namespaces: 'pim:settings', 'pim:scores', 'pim:medals', 'pim:sfx:{filename}'
 * Falls back gracefully when IDB is unavailable (private browsing, sandboxed iframes).
 */

const DB_NAME = 'pim-vault';
const DB_VERSION = 1;
const STORE_NAME = 'pim-store';

let _db: IDBDatabase | null = null;
let _initPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (_db) return Promise.resolve(_db);
  if (_initPromise) return _initPromise;

  _initPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e) => {
        _db = (e.target as IDBOpenDBRequest).result;
        resolve(_db);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return _initPromise;
}

export async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Cache a decoded AudioBuffer ArrayBuffer for offline use */
export async function cacheAudioBuffer(filename: string, buffer: ArrayBuffer): Promise<void> {
  await idbSet(`pim:sfx:${filename}`, buffer);
}

/** Retrieve a cached AudioBuffer ArrayBuffer */
export async function getCachedAudioBuffer(filename: string): Promise<ArrayBuffer | undefined> {
  return idbGet<ArrayBuffer>(`pim:sfx:${filename}`);
}
