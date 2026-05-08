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

// jsdom does not implement scrollIntoView; cmdk's <Command> calls it on
// each mount of CommandItem to keep the active item visible.
if (
  typeof globalThis.Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

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
