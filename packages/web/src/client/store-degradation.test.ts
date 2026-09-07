import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "matrix-js-sdk";
import { MatrixClientPeg } from "./peg";
import { resetStoreFactoryForTest, setStoreFactoryForTest } from "./store";

const creds = {
  homeserverUrl: "https://h.example",
  accessToken: "tok",
  userId: "@alice:h.example",
  deviceId: "DEV1",
};

/** MemoryStore + the TypedEventEmitter surface IndexedDBStore exposes. */
function makeEmittingStore() {
  const store = new MemoryStore({ localStorage: globalThis.localStorage });
  const handlers = new Map<string, Array<(...a: unknown[]) => void>>();
  (store as unknown as { on: (e: string, h: (...a: unknown[]) => void) => void }).on = (e, h) => {
    handlers.set(e, [...(handlers.get(e) ?? []), h]);
  };
  return {
    store,
    emit(event: string, ...args: unknown[]) {
      for (const h of handlers.get(event) ?? []) h(...args);
    },
  };
}

describe("IndexedDB degradation is visible", () => {
  afterEach(() => {
    MatrixClientPeg.reset();
    resetStoreFactoryForTest();
  });

  it("logs when the store emits 'degraded' mid-session", async () => {
    const { store, emit } = makeEmittingStore();
    setStoreFactoryForTest(() => store);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    MatrixClientPeg.set(creds);
    await MatrixClientPeg.whenStoreReady();
    emit("degraded", new Error("QuotaExceededError"));

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("degraded"),
      expect.anything(),
    );
    errSpy.mockRestore();
  });

  it("logs when the store emits 'closed' mid-session", async () => {
    const { store, emit } = makeEmittingStore();
    setStoreFactoryForTest(() => store);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    MatrixClientPeg.set(creds);
    await MatrixClientPeg.whenStoreReady();
    emit("closed");

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("closed"));
    errSpy.mockRestore();
  });
});
