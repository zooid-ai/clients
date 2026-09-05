import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedDBStore, MemoryStore } from "matrix-js-sdk";
import { MatrixClientPeg } from "./peg";
import {
  resetStoreFactoryForTest,
  setStoreFactoryForTest,
} from "./store";

const creds = {
  homeserverUrl: "https://h.example",
  accessToken: "tok",
  userId: "@alice:h.example",
  deviceId: "DEV1",
};

describe("MatrixClientPeg", () => {
  afterEach(() => {
    MatrixClientPeg.reset();
    resetStoreFactoryForTest();
  });

  it("returns null before set()", () => {
    expect(MatrixClientPeg.safeGet()).toBeNull();
  });

  it("creates a client and emits change on set()", () => {
    const onChange = vi.fn();
    MatrixClientPeg.subscribe(onChange);
    MatrixClientPeg.set(creds);
    expect(MatrixClientPeg.safeGet()).not.toBeNull();
    expect(MatrixClientPeg.safeGet()!.getUserId()).toBe(creds.userId);
    expect(onChange).toHaveBeenCalledOnce();
  });

  // Without timelineSupport, EventTimelineSet.resetLiveTimeline() throws away
  // every loaded event on any gappy sync, so a backgrounded tab comes back to
  // a timeline with a silent hole in it (zooid-ai/zooid#14).
  it("enables timelineSupport so a gappy sync doesn't discard loaded history", () => {
    MatrixClientPeg.set(creds);
    const c = MatrixClientPeg.safeGet()! as unknown as { timelineSupport: boolean };
    expect(c.timelineSupport).toBe(true);
  });

  it("reset() stops the client and clears the peg", () => {
    MatrixClientPeg.set(creds);
    const c = MatrixClientPeg.safeGet()!;
    const stopSpy = vi.spyOn(c, "stopClient");
    MatrixClientPeg.reset();
    expect(MatrixClientPeg.safeGet()).toBeNull();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("subscribe returns an unsubscribe fn", () => {
    const onChange = vi.fn();
    const unsub = MatrixClientPeg.subscribe(onChange);
    unsub();
    MatrixClientPeg.set(creds);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("gives the client an IndexedDBStore by default", () => {
    MatrixClientPeg.set(creds);
    const store = (MatrixClientPeg.safeGet() as unknown as { store: unknown }).store;
    expect(store).toBeInstanceOf(IndexedDBStore);
  });

  it("resolves whenStoreReady({ persistent: true }) once startup succeeds", async () => {
    MatrixClientPeg.set(creds);
    await expect(MatrixClientPeg.whenStoreReady()).resolves.toEqual({ persistent: true });
  });

  it("degrades to MemoryStore, loudly, when store startup rejects", async () => {
    const boom = new Error("IDB blocked");
    const bad = new MemoryStore({ localStorage: globalThis.localStorage });
    (bad as unknown as { startup: () => Promise<void> }).startup = () => Promise.reject(boom);
    setStoreFactoryForTest(() => bad);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    MatrixClientPeg.set(creds);
    const readiness = await MatrixClientPeg.whenStoreReady();

    expect(readiness.persistent).toBe(false);
    expect(readiness.reason).toContain("IDB blocked");
    // Boots anyway — a cold sync is a degraded experience, not a broken one.
    expect(MatrixClientPeg.safeGet()).not.toBeNull();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("reset() stays synchronous and does NOT delete persisted data", () => {
    const store = new MemoryStore({ localStorage: globalThis.localStorage });
    const del = vi.fn(() => Promise.resolve());
    (store as unknown as { deleteAllData: () => Promise<void> }).deleteAllData = del;
    setStoreFactoryForTest(() => store);

    MatrixClientPeg.set(creds);
    const out = MatrixClientPeg.reset();

    expect(out).toBeUndefined(); // sync signature — ~90 afterEach blocks depend on this
    expect(MatrixClientPeg.safeGet()).toBeNull();
    expect(del).not.toHaveBeenCalled();
  });

  it("logout() deletes persisted data before clearing the peg", async () => {
    const store = new MemoryStore({ localStorage: globalThis.localStorage });
    const del = vi.fn(() => Promise.resolve());
    (store as unknown as { deleteAllData: () => Promise<void> }).deleteAllData = del;
    setStoreFactoryForTest(() => store);

    MatrixClientPeg.set(creds);
    await MatrixClientPeg.logout();

    expect(del).toHaveBeenCalled();
    expect(MatrixClientPeg.safeGet()).toBeNull();
  });

  it("logout() still clears the peg when deleteAllData rejects", async () => {
    const store = new MemoryStore({ localStorage: globalThis.localStorage });
    (store as unknown as { deleteAllData: () => Promise<void> }).deleteAllData = () =>
      Promise.reject(new Error("quota"));
    setStoreFactoryForTest(() => store);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    MatrixClientPeg.set(creds);
    await MatrixClientPeg.logout();

    // A failed cache wipe must never strand the user in a logged-in shell.
    expect(MatrixClientPeg.safeGet()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
