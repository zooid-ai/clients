import { type MatrixClient, createClient } from "matrix-js-sdk";
import type { IStore } from "matrix-js-sdk/lib/store";
import { sessionStorage_ } from "./storage";
import { createMatrixStore, createMemoryStore } from "./store";
import type { Credentials } from "./login";

type Listener = () => void;

export interface StoreReadiness {
  /** True when the session is backed by IndexedDB and survives a reload. */
  persistent: boolean;
  /** Why persistence is unavailable, when it is. */
  reason?: string;
}

class MatrixClientPegImpl {
  private client: MatrixClient | null = null;
  private store: IStore | null = null;
  private storeReady: Promise<StoreReadiness> = Promise.resolve({
    persistent: false,
    reason: "no session",
  });
  private listeners = new Set<Listener>();

  safeGet(): MatrixClient | null {
    return this.client;
  }

  get(): MatrixClient {
    if (!this.client) throw new Error("MatrixClientPeg: not logged in");
    return this.client;
  }

  set(creds: Credentials): MatrixClient {
    if (this.client) this.client.stopClient();

    // The store is built explicitly (see ./store). IndexedDB gives us a saved
    // sync so a reload resumes from a token instead of running a cold initial
    // sync at initialSyncLimit — MemoryStore.getSavedSync() returns null
    // unconditionally, which is why every refresh used to lose history.
    const store = createMatrixStore(creds);
    this.store = store;

    this.client = createClient({
      baseUrl: creds.homeserverUrl,
      accessToken: creds.accessToken,
      userId: creds.userId,
      deviceId: creds.deviceId,
      store,
      // Required for history to survive a gappy ("limited: true") sync. The
      // SDK resets the live timeline whenever sync reports a gap, and
      // EventTimelineSet.resetLiveTimeline() discards *every* loaded event
      // unless timelineSupport is on — so a backgrounded tab would come back
      // to a timeline with a silent hole where the middle of the
      // conversation used to be. With it on, the old timeline is kept and
      // linked, which is what allRoomEvents() in use-timeline.ts assumes.
      timelineSupport: true,
    });

    this.watchForDegradation(store);

    // IndexedDBStore.startup() must run AFTER createClient (it needs the
    // client's createUser wired up) and BEFORE startClient (the sync loop
    // reads the saved token on its first pass). Nothing in the SDK calls it
    // for us — MatrixClient.startClient only awaits the *crypto* store.
    // startup() is also the one backend method the SDK does NOT wrap in its
    // degradable() helper, so it can reject and we must handle that.
    this.storeReady = this.startStore(store);

    sessionStorage_.setJSON("session", creds);
    this.emit();
    return this.client;
  }

  private async startStore(store: IStore): Promise<StoreReadiness> {
    const startup = (store as unknown as { startup?: () => Promise<void> }).startup;
    if (typeof startup !== "function") return { persistent: false, reason: "store has no startup" };
    try {
      await startup.call(store);
      return { persistent: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // Loud on purpose. A blocked or evicted IndexedDB (private browsing,
      // quota, a sibling tab holding an upgrade) silently costs the user their
      // history on every reload; it should not also be invisible to us.
      console.error(
        `[peg] IndexedDB store startup failed — falling back to MemoryStore. ` +
          `History will not survive a reload. Reason: ${reason}`,
        err,
      );
      const fallback = createMemoryStore();
      this.store = fallback;
      if (this.client) {
        (this.client as unknown as { store: IStore }).store = fallback;
      }
      return { persistent: false, reason };
    }
  }

  private watchForDegradation(store: IStore): void {
    const on = (store as unknown as { on?: (e: string, h: (...a: unknown[]) => void) => void }).on;
    if (typeof on !== "function") return;
    // IndexedDBStore wraps every backend call in degradable(), which swallows
    // the error, becomes a MemoryStore in place, and emits "degraded". Without
    // this listener that transition is completely invisible.
    on.call(store, "degraded", (err: unknown) => {
      console.error("[peg] IndexedDB store degraded to memory mid-session", err);
    });
    on.call(store, "closed", () => {
      console.error("[peg] IndexedDB store connection closed unexpectedly");
    });
  }

  /**
   * Resolves once the store has finished loading from disk. `startClient()`
   * must not run before this — otherwise the first sync goes out without the
   * saved token and we take a cold initial sync anyway.
   */
  whenStoreReady(): Promise<StoreReadiness> {
    return this.storeReady;
  }

  /**
   * Synchronous teardown: stop the client, drop the peg, clear credentials.
   *
   * Deliberately does NOT touch persisted data, and deliberately stays sync —
   * it is the token-revoked path in app.tsx and the teardown in ~90 test
   * afterEach blocks. Wiping the cache belongs to logout(), below.
   */
  reset(): void {
    if (this.client) {
      try {
        this.client.stopClient();
      } catch {
        // tolerated — stopClient is best-effort during teardown
      }
    }
    this.client = null;
    this.store = null;
    this.storeReady = Promise.resolve({ persistent: false, reason: "no session" });
    sessionStorage_.remove("session");
    this.emit();
  }

  /**
   * Deliberate sign-out. Deletes the persisted store first: without this the
   * previous user's rooms and messages stay in IndexedDB for whoever logs in
   * next on this browser profile.
   */
  async logout(): Promise<void> {
    const store = this.store as unknown as { deleteAllData?: () => Promise<void> } | null;
    try {
      await store?.deleteAllData?.();
    } catch (err) {
      // A cache we couldn't wipe must never strand the user in a logged-in
      // shell — log it and sign out regardless.
      console.warn("[peg] failed to delete persisted store data on logout", err);
    }
    this.reset();
  }

  /** TEST ONLY. Inject a pre-built client without going through createClient(). */
  injectClientForTest(client: MatrixClient): void {
    if (this.client) {
      try {
        this.client.stopClient();
      } catch {
        // tolerated
      }
    }
    this.client = client;
    this.emit();
  }

  restoreFromStorage(): Credentials | null {
    const creds = sessionStorage_.getJSON<Credentials>("session");
    if (!creds) return null;
    this.set(creds);
    return creds;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const MatrixClientPeg = new MatrixClientPegImpl();
