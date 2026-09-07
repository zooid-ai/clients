import { IndexedDBStore, MemoryStore } from "matrix-js-sdk";
import type { IStore } from "matrix-js-sdk/lib/store";
import type { Credentials } from "./login";

export type StoreFactory = (creds: Credentials) => IStore;

/**
 * Build the matrix-js-sdk data store for a session.
 *
 * IndexedDB when the environment has it, MemoryStore otherwise. The database
 * is named after the Matrix user id (the SDK prefixes it with
 * "matrix-js-sdk:") so two accounts on one browser profile never share a
 * cache.
 *
 * Note the store is deliberately built here rather than left to the SDK's
 * default: an implicit store choice is what [[ZNC001]] rejected. The choice is
 * explicit, the fallback is explicit, and the failure is reported.
 */
function defaultFactory(creds: Credentials): IStore {
  if (!globalThis.indexedDB) {
    console.warn(
      "[store] No IndexedDB in this environment — falling back to MemoryStore. " +
        "History will not survive a reload.",
    );
    return new MemoryStore({ localStorage: globalThis.localStorage });
  }
  return new IndexedDBStore({
    indexedDB: globalThis.indexedDB,
    localStorage: globalThis.localStorage,
    dbName: creds.userId,
    // No workerFactory: the local backend runs on the main thread. Moving the
    // backend into a web worker (RemoteIndexedDBStoreBackend) is a latency
    // optimization for very large accounts and needs a bundled worker entry
    // point in the Vite build — out of scope here. Revisit if sync writes show
    // up as long tasks in a profile.
  });
}

let factory: StoreFactory = defaultFactory;

export function createMatrixStore(creds: Credentials): IStore {
  return factory(creds);
}

/** TEST ONLY. Swap the store implementation (e.g. to a plain MemoryStore). */
export function setStoreFactoryForTest(fn: StoreFactory): void {
  factory = fn;
}

/** TEST ONLY. Restore the default IndexedDB-backed factory. */
export function resetStoreFactoryForTest(): void {
  factory = defaultFactory;
}

/** A MemoryStore built the same way the fallback path builds one. */
export function createMemoryStore(): IStore {
  return new MemoryStore({ localStorage: globalThis.localStorage });
}
