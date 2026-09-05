import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomEvent, type MatrixEvent, type Room } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { sessionStorage_ } from "@/client/storage";
import { makeFakeClient, makeMatrixEvent, makeRoom } from "../../test/factories";
import { useNotifications } from "./use-notifications";

const roomId = "!r:h.example";
const me = "@me:h.example";

class FakeNotification {
  static permission: NotificationPermission = "granted";
  static requestPermission = vi.fn(async () => "granted" as NotificationPermission);
  static instances: FakeNotification[] = [];
  onclick: (() => void) | null = null;
  close = vi.fn();
  constructor(
    public title: string,
    public options?: NotificationOptions,
  ) {
    FakeNotification.instances.push(this);
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

beforeEach(() => {
  FakeNotification.permission = "granted";
  FakeNotification.instances = [];
  FakeNotification.requestPermission.mockClear();
  vi.stubGlobal("Notification", FakeNotification);
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  sessionStorage_.remove("notifications-prompted");
  sessionStorage_.remove("notifications-enabled");
});

afterEach(() => {
  MatrixClientPeg.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(opts: { notify?: boolean; initialSyncComplete?: boolean } = {}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = () => room;
  cast.getPushActionsForEvent = vi.fn(() => ({ notify: opts.notify ?? true, tweaks: {} }));
  cast.isInitialSyncComplete = () => opts.initialSyncComplete ?? true;
  MatrixClientPeg.injectClientForTest(client);
  return { client, room };
}

function emitLive(
  client: ReturnType<typeof makeFakeClient>,
  room: Room,
  event: MatrixEvent,
) {
  (client as unknown as { emit: (...args: unknown[]) => void }).emit(
    RoomEvent.Timeline,
    event,
    room,
    false,
    false,
    { liveEvent: true },
  );
}

function aliceMessage(eventId = "$m1") {
  return makeMatrixEvent({
    eventId,
    roomId,
    sender: "@alice:h.example",
    type: "m.room.message",
    content: { msgtype: "m.text", body: "ping" },
  });
}

describe("useNotifications", () => {
  it("fires a browser notification for a live notifying event while unfocused", () => {
    const { client, room } = setup();
    renderHook(() => useNotifications(false), { wrapper });
    act(() => emitLive(client, room, aliceMessage()));
    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0].title).toBe(room.name);
    expect(FakeNotification.instances[0].options?.tag).toBe("$m1");
  });

  it("does not notify while the tab is focused", () => {
    const { client, room } = setup();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    renderHook(() => useNotifications(false), { wrapper });
    act(() => emitLive(client, room, aliceMessage()));
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("does not notify without granted permission", () => {
    const { client, room } = setup();
    FakeNotification.permission = "denied";
    renderHook(() => useNotifications(false), { wrapper });
    act(() => emitLive(client, room, aliceMessage()));
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("does not notify when disabled locally in settings", () => {
    const { client, room } = setup();
    sessionStorage_.set("notifications-enabled", "0");
    renderHook(() => useNotifications(false), { wrapper });
    act(() => emitLive(client, room, aliceMessage()));
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("does not notify before initial sync completes", () => {
    const { client, room } = setup({ initialSyncComplete: false });
    renderHook(() => useNotifications(false), { wrapper });
    act(() => emitLive(client, room, aliceMessage()));
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("does not notify for non-live (backfill) events", () => {
    const { client, room } = setup();
    renderHook(() => useNotifications(false), { wrapper });
    act(() =>
      (client as unknown as { emit: (...args: unknown[]) => void }).emit(
        RoomEvent.Timeline,
        aliceMessage(),
        room,
        true,
        false,
        { liveEvent: false },
      ),
    );
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("does not notify when push rules decline (muted room/user)", () => {
    const { client, room } = setup({ notify: false });
    renderHook(() => useNotifications(false), { wrapper });
    act(() => emitLive(client, room, aliceMessage()));
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("NEVER requests permission — enabling notifications is the settings button's job now", () => {
    setup();
    FakeNotification.permission = "default";
    renderHook(() => useNotifications(false), { wrapper });
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it("clears the stale prompt-once flag from the old auto-prompt bug", () => {
    sessionStorage_.set("notifications-prompted", "1");
    setup();
    renderHook(() => useNotifications(false), { wrapper });
    expect(sessionStorage_.get("notifications-prompted")).toBeNull();
  });

  it("registers no timeline listener when a push subscription is active — the service worker is the sole renderer", () => {
    const { client, room } = setup();
    renderHook(() => useNotifications(true), { wrapper });
    act(() => emitLive(client, room, aliceMessage()));
    expect(FakeNotification.instances).toHaveLength(0);
  });
});
