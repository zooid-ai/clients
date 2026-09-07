import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedDBStore, MemoryStore } from "matrix-js-sdk";
import {
  createMatrixStore,
  resetStoreFactoryForTest,
  setStoreFactoryForTest,
} from "./store";

const creds = {
  homeserverUrl: "https://h.example",
  accessToken: "tok",
  userId: "@alice:h.example",
  deviceId: "DEV1",
};

describe("createMatrixStore", () => {
  afterEach(() => resetStoreFactoryForTest());

  it("returns an IndexedDBStore when indexedDB is available", () => {
    const store = createMatrixStore(creds);
    expect(store).toBeInstanceOf(IndexedDBStore);
  });

  it("scopes the database name to the user id so accounts don't collide", () => {
    const store = createMatrixStore(creds) as IndexedDBStore;
    // LocalIndexedDBStoreBackend prefixes with "matrix-js-sdk:".
    const backend = (store as unknown as { backend: { dbName: string } }).backend;
    expect(backend.dbName).toBe(`matrix-js-sdk:${creds.userId}`);

    const other = createMatrixStore({ ...creds, userId: "@bob:h.example" }) as IndexedDBStore;
    const otherBackend = (other as unknown as { backend: { dbName: string } }).backend;
    expect(otherBackend.dbName).not.toBe(backend.dbName);
  });

  it("falls back to MemoryStore when indexedDB is missing", () => {
    const saved = globalThis.indexedDB;
    // @ts-expect-error deliberately removing the global for this assertion
    delete globalThis.indexedDB;
    try {
      const store = createMatrixStore(creds);
      expect(store).toBeInstanceOf(MemoryStore);
      expect(store).not.toBeInstanceOf(IndexedDBStore);
    } finally {
      globalThis.indexedDB = saved;
    }
  });

  it("honours a factory override so tests can opt out of IndexedDB", () => {
    const stub = new MemoryStore({ localStorage: globalThis.localStorage });
    const factory = vi.fn(() => stub);
    setStoreFactoryForTest(factory);
    expect(createMatrixStore(creds)).toBe(stub);
    expect(factory).toHaveBeenCalledWith(creds);
  });
});
