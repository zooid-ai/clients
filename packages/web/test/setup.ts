import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

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
    http.get(`${homeserverUrl}/_matrix/client/v3/sync`, () =>
      HttpResponse.json({ next_batch: "s1", rooms: { join: {}, invite: {}, leave: {} } }),
    ),
  );
}
