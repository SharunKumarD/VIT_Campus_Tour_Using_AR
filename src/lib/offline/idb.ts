/**
 * Minimal promise wrapper around IndexedDB (no library).
 * Database "vitiar": store "kv" (campus pack, settings blobs) and
 * store "sessions" (research session logs, auto-increment keys).
 *
 * IndexedDB is used instead of localStorage for anything substantial:
 * a campus pack can be hundreds of kilobytes.
 */

const DB_NAME = "vitiar";
const DB_VERSION = 1;
export const KV = "kv";
export const SESSIONS = "sessions";

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error("Offline storage is not available on this device"));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("Could not open offline storage"));
    };
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? req.error ?? new Error("Storage error"));
        tx.onabort = () => reject(tx.error ?? new Error("Storage aborted (device storage may be full)"));
      }),
  );
}

export const idbGet = <T>(store: string, key: IDBValidKey) => run<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbPut = (store: string, value: unknown, key?: IDBValidKey) =>
  run<IDBValidKey>(store, "readwrite", (s) => (key === undefined ? s.put(value) : s.put(value, key)));
export const idbAdd = (store: string, value: unknown) => run<IDBValidKey>(store, "readwrite", (s) => s.add(value));
export const idbDelete = (store: string, key: IDBValidKey) => run<undefined>(store, "readwrite", (s) => s.delete(key));
export const idbAll = <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll());
export const idbClear = (store: string) => run<undefined>(store, "readwrite", (s) => s.clear());
