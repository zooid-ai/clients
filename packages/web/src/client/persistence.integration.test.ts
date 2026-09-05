import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClientEvent, IndexedDBStore, SyncState, createClient } from "matrix-js-sdk";
import { relaxUnhandled, stubStartClient, stubSyncWithRooms } from "../../test/setup";

const HS = "https://h.example";
const USER = "@alice:h.example";
const ROOM = "!durable:h.example";

const creds = {
  homeserverUrl: HS,
  accessToken: "tok",
  userId: USER,
  deviceId: "DEV1",
};

function newStore(dbName: string) {
  return new IndexedDBStore({
    indexedDB: globalThis.indexedDB,
    localStorage: globalThis.localStorage,
    dbName,
  });
}

/**
 * `IDBFactory#deleteDatabase` returns an `IDBOpenDBRequest`, not a Promise —
 * `await`ing it directly resolves immediately without waiting for the
 * deletion to actually complete, which leaks state into the next test.
 */
function deleteDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Mirrors the peg's ordering: createClient -> store.startup() -> startClient(). */
async function bootClient(store: IndexedDBStore) {
  const client = createClient({
    baseUrl: creds.homeserverUrl,
    accessToken: creds.accessToken,
    userId: creds.userId,
    deviceId: creds.deviceId,
    store,
    timelineSupport: true,
  });
  await store.startup();
  return client;
}

function syncedOnce(client: ReturnType<typeof createClient>) {
  return new Promise<void>((resolve) => {
    client.on(ClientEvent.Sync, (state) => {
      if (state === SyncState.Prepared || state === SyncState.Syncing) resolve();
    });
  });
}

describe("IndexedDB persistence round-trip", () => {
  beforeEach(() => {
    // MatrixClient caches the sync filter id in localStorage (not in the
    // data store — see MemoryStore#getFilterIdByName), keyed only by filter
    // name, not by user id or database. Without clearing it, a later test
    // reusing USER finds a stale cached filter id and GETs
    // /filter/:filterId instead of POSTing a new one — an endpoint this
    // suite doesn't stub.
    globalThis.localStorage.clear();
    relaxUnhandled();
    stubStartClient(HS);
    stubSyncWithRooms(HS, [
      {
        roomId: ROOM,
        myUserId: USER,
        timeline: [
          { type: "m.room.message", sender: USER, content: { msgtype: "m.text", body: "one" } },
          { type: "m.room.message", sender: USER, content: { msgtype: "m.text", body: "two" } },
        ],
      },
    ]);
  });

  afterEach(async () => {
    await deleteDatabase(`matrix-js-sdk:${USER}`);
  });

  it("a fresh store reads back the previous session's sync", async () => {
    // --- session 1: sync, force a write, shut down ---
    const storeA = newStore(USER);
    const clientA = await bootClient(storeA);
    const prepared = syncedOnce(clientA);
    await clientA.startClient({ initialSyncLimit: 10 });
    await prepared;
    // Writes are throttled to WRITE_DELAY_MS (5 min); force one.
    await storeA.save(true);
    clientA.stopClient();
    await storeA.destroy();

    // --- session 2: what a page reload looks like ---
    const storeB = newStore(USER);
    const clientB = await bootClient(storeB);

    const token = await storeB.getSavedSyncToken();
    expect(token).toBe("s1");

    // SyncAccumulator.getJSON() returns { nextBatch, roomsData: { join, ... },
    // accountData } — not a raw /sync response shape, and not flattened
    // either. Verified against matrix-js-sdk@34.13.0.
    const saved = (await storeB.getSavedSync()) as {
      roomsData: { join: Record<string, unknown> };
    } | null;
    expect(saved).not.toBeNull();
    expect(Object.keys(saved!.roomsData.join)).toContain(ROOM);

    clientB.stopClient();
    await storeB.destroy();
  });

  it("does not leak one account's data into another account's database", async () => {
    const storeA = newStore(USER);
    const clientA = await bootClient(storeA);
    const prepared = syncedOnce(clientA);
    await clientA.startClient({ initialSyncLimit: 10 });
    await prepared;
    await storeA.save(true);
    clientA.stopClient();
    await storeA.destroy();

    const other = "@bob:h.example";
    const storeB = newStore(other);
    const clientB = createClient({
      baseUrl: HS,
      accessToken: "tok2",
      userId: other,
      deviceId: "DEV2",
      store: storeB,
      timelineSupport: true,
    });
    await storeB.startup();
    // A store with nothing persisted yet accumulates an `init()` call with an
    // empty sync row, which sets next_batch to `undefined` rather than
    // `null` — verified against matrix-js-sdk@34.13.0's
    // LocalIndexedDBStoreBackend#init.
    expect(await storeB.getSavedSyncToken()).toBeUndefined();
    clientB.stopClient();
    await storeB.destroy();
    await deleteDatabase(`matrix-js-sdk:${other}`);
  });

  it("deleteAllData() clears the saved sync so a logged-out session leaves nothing behind", async () => {
    const storeA = newStore(USER);
    const clientA = await bootClient(storeA);
    const prepared = syncedOnce(clientA);
    await clientA.startClient({ initialSyncLimit: 10 });
    await prepared;
    await storeA.save(true);
    expect(await storeA.getSavedSyncToken()).toBe("s1");

    await storeA.deleteAllData();
    clientA.stopClient();
    await storeA.destroy();

    const storeB = newStore(USER);
    const clientB = await bootClient(storeB);
    expect(await storeB.getSavedSyncToken()).toBeUndefined();
    clientB.stopClient();
    await storeB.destroy();
  });
});
