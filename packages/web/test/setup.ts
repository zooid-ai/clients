// happy-dom implements no IndexedDB. `fake-indexeddb/auto` installs an
// in-memory implementation on globalThis so matrix-js-sdk's real
// LocalIndexedDBStoreBackend runs unmodified in tests — object stores,
// transactions, SyncAccumulator serialization and all. Tests that don't care
// about persistence still inject a MemoryStore via setStoreFactoryForTest().
import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// jsdom does not implement matchMedia; sonner's <Toaster /> and the
// ThemeProvider read it on mount.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom does not implement ResizeObserver; radix ScrollArea constructs one.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver =
    ResizeObserverPolyfill;
}

// happy-dom reports 0 for layout dimensions, so @tanstack/react-virtual's
// scroll container measures as a zero-height viewport and windows out every
// row. Give elements a non-zero offset size so virtualized lists render their
// (small) test datasets. Only offsetWidth/offsetHeight are shimmed — the
// timeline auto-scroll reads scrollHeight/clientHeight, which we leave alone.
for (const prop of ["offsetWidth", "offsetHeight"] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get() {
      return 1000;
    },
  });
}

// jsdom does not implement scrollIntoView; cmdk's <Command> calls it on
// each mount of CommandItem to keep the active item visible.
if (
  typeof globalThis.Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Give every test a clean IndexedDB, mirroring the ephemeral guarantee a
// fresh MemoryStore used to provide. Without this, a real IndexedDBStore
// created via MatrixClientPeg.set()/restoreFromStorage() (rather than
// injected via setStoreFactoryForTest()) persists its first sync to disk —
// the store's own write-throttle guard (WRITE_DELAY_MS) is bypassed on the
// very first save — and a later test reusing the same synthetic user id
// would resume from a stale `since` token that this suite's MSW stubs never
// answer (stubStartClient/stubSyncWithRooms hang any `since` request
// forever), hanging the test instead of failing it.
function deleteIndexedDbDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

afterEach(async () => {
  const dbs = await globalThis.indexedDB.databases();
  await Promise.all(dbs.map((db) => (db.name ? deleteIndexedDbDatabase(db.name) : null)));
});

export const mswServer = setupServer();

// Default to "error" for strict tests (catches typos in handler URLs). Tests
// that boot matrix-js-sdk's startClient() should call relaxUnhandled() in a
// beforeEach — startClient hits a long tail of endpoints (versions, sync,
// pushrules, capabilities, voip, thirdparty, …) and stubbing each by hand is
// noise that hides the actual assertion.
beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

export function relaxUnhandled() {
  mswServer.close();
  mswServer.listen({ onUnhandledRequest: "bypass" });
}

// Convenience: minimum stubs every startClient() needs. Use in tests that
// mount <LoggedInView> or otherwise trigger a sync.
export function stubStartClient(homeserverUrl: string) {
  mswServer.use(
    http.get(`${homeserverUrl}/_matrix/client/versions`, () =>
      HttpResponse.json({ versions: ["v1.11"], unstable_features: {} }),
    ),
    http.get(`${homeserverUrl}/_matrix/client/v3/capabilities`, () =>
      HttpResponse.json({ capabilities: {} }),
    ),
    http.get(`${homeserverUrl}/_matrix/client/v3/pushrules/`, () =>
      HttpResponse.json({ global: { override: [], content: [], room: [], sender: [], underride: [] } }),
    ),
    http.post(`${homeserverUrl}/_matrix/client/v3/user/:userId/filter`, () =>
      HttpResponse.json({ filter_id: "f1" }),
    ),
    http.get(`${homeserverUrl}/_matrix/client/v3/sync`, ({ request }) => {
      const url = new URL(request.url);
      // First sync request has no `since` token; subsequent long-polls do.
      // Hold long-polls open indefinitely in tests so we don't churn the
      // event loop forever — they are aborted by stopClient() in afterEach.
      if (url.searchParams.get("since")) return new Promise(() => {});
      return HttpResponse.json({ next_batch: "s1", rooms: { join: {}, invite: {}, leave: {} } });
    }),
  );
}

export interface StubRoom {
  roomId: string;
  name?: string;
  myUserId: string;
  timeline?: Array<{
    type: string;
    sender: string;
    content: Record<string, unknown>;
    eventId?: string;
  }>;
  state?: Array<{
    type: string;
    sender: string;
    stateKey: string;
    content: Record<string, unknown>;
  }>;
}

export function stubSyncWithRooms(homeserverUrl: string, rooms: StubRoom[]): void {
  const join: Record<string, unknown> = {};
  for (const r of rooms) {
    const stateEvents = (r.state ?? []).map((s, i) => ({
      type: s.type,
      sender: s.sender,
      state_key: s.stateKey,
      content: s.content,
      event_id: `$state${i}_${r.roomId}`,
      origin_server_ts: 1,
    }));
    const timelineEvents = (r.timeline ?? []).map((t, i) => ({
      type: t.type,
      sender: t.sender,
      content: t.content,
      event_id: t.eventId ?? `$tl${i}_${r.roomId}`,
      origin_server_ts: 1000 + i,
    }));
    join[r.roomId] = {
      state: { events: stateEvents },
      timeline: { events: timelineEvents, prev_batch: "p1", limited: false },
      ephemeral: { events: [] },
      account_data: { events: [] },
    };
  }
  mswServer.use(
    http.get(`${homeserverUrl}/_matrix/client/v3/sync`, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("since")) return new Promise(() => {});
      return HttpResponse.json({ next_batch: "s1", rooms: { join, invite: {}, leave: {} } });
    }),
  );
}

export interface StubInvite {
  roomId: string;
  name?: string;
  /** The user being invited (state_key on the m.room.member event). */
  myUserId: string;
  /** Who sent the invite (sender of the m.room.member event). */
  inviter: string;
  /** origin_server_ts of the invite member event. Defaults to a stable value. */
  ts?: number;
}

// Sibling of stubSyncWithRooms for the invite path: places each room under
// `rooms.invite` with stripped invite_state — an `m.room.name` and the
// `m.room.member` (membership: "invite") for the invited user. matrix-js-sdk
// surfaces these as rooms with getMyMembership() === "invite".
export function stubSyncWithInvites(homeserverUrl: string, invites: StubInvite[]): void {
  const invite: Record<string, unknown> = {};
  for (const i of invites) {
    const events: Array<Record<string, unknown>> = [
      {
        type: "m.room.member",
        sender: i.inviter,
        state_key: i.myUserId,
        content: { membership: "invite" },
        origin_server_ts: i.ts ?? 1,
        event_id: `$inv_${i.roomId}`,
      },
    ];
    if (i.name !== undefined) {
      events.push({
        type: "m.room.name",
        sender: i.inviter,
        state_key: "",
        content: { name: i.name },
        origin_server_ts: i.ts ?? 1,
        event_id: `$invname_${i.roomId}`,
      });
    }
    invite[i.roomId] = { invite_state: { events } };
  }
  mswServer.use(
    http.get(`${homeserverUrl}/_matrix/client/v3/sync`, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("since")) return new Promise(() => {});
      return HttpResponse.json({ next_batch: "s1", rooms: { join: {}, invite, leave: {} } });
    }),
  );
}
