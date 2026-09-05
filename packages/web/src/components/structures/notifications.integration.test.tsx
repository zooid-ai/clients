import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomEvent, type MatrixEvent, type Room } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { sessionStorage_ } from "@/client/storage";
import { makeFakeClient, makeMatrixEvent, makeRoom } from "../../../test/factories";
import { useNotifications } from "@/hooks/use-notifications";

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

function Probe({ hasPushSubscription = false }: { hasPushSubscription?: boolean }) {
  useNotifications(hasPushSubscription);
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function setupClient() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = () => room;
  cast.getPushActionsForEvent = vi.fn(() => ({ notify: true, tweaks: {} }));
  cast.isInitialSyncComplete = () => true;
  MatrixClientPeg.injectClientForTest(client);
  return { client, room };
}

function emitAliceMessage(client: ReturnType<typeof makeFakeClient>, room: Room) {
  act(() =>
    (client as unknown as { emit: (...args: unknown[]) => void }).emit(
      RoomEvent.Timeline,
      makeMatrixEvent({
        eventId: "$m1",
        roomId,
        sender: "@alice:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body: "ping" },
      }) as MatrixEvent,
      room as Room,
      false,
      false,
      { liveEvent: true },
    ),
  );
}

beforeEach(() => {
  FakeNotification.instances = [];
  vi.stubGlobal("Notification", FakeNotification);
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  if (!window.focus) (window as unknown as { focus: () => void }).focus = () => {};
  sessionStorage_.set("notifications-prompted", "1");
});

afterEach(() => {
  MatrixClientPeg.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("notification click-to-focus", () => {
  it("navigates to the originating room when the notification is clicked", () => {
    const { client, room } = setupClient();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("pathname").textContent).toBe("/");

    emitAliceMessage(client, room);

    const notification = FakeNotification.instances[0];
    expect(notification).toBeDefined();
    act(() => notification.onclick?.());

    expect(screen.getByTestId("pathname").textContent).toBe(`/room/${roomId}`);
    expect(notification.close).toHaveBeenCalled();
  });
});

describe("in-page fallback vs. push subscription", () => {
  it("does not double-notify: the timeline emitter is inert while a subscription exists", () => {
    // With an active push subscription, a live m.room.message must produce no
    // in-page Notification — the service worker is the sole renderer (§5).
    const { client, room } = setupClient();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<Probe hasPushSubscription />} />
        </Routes>
      </MemoryRouter>,
    );
    emitAliceMessage(client, room);
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("still notifies in-page when no subscription exists", () => {
    const { client, room } = setupClient();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<Probe hasPushSubscription={false} />} />
        </Routes>
      </MemoryRouter>,
    );
    emitAliceMessage(client, room);
    expect(FakeNotification.instances).toHaveLength(1);
  });
});
