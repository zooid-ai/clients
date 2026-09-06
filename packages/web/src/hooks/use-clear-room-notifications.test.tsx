import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClearRoomNotifications } from "./use-clear-room-notifications";

const roomId = "!r:example.org";

let notifications: { data: { roomId: string }; close: ReturnType<typeof vi.fn> }[];
let getNotifications: ReturnType<typeof vi.fn>;
let listeners: Record<string, () => void>;

function makeNotification(id: string) {
  return { data: { roomId: id }, close: vi.fn() };
}

beforeEach(() => {
  notifications = [];
  getNotifications = vi.fn(async () => notifications);
  listeners = {};

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({ getNotifications }),
    },
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  vi.spyOn(document, "addEventListener").mockImplementation((type: string, fn: unknown) => {
    listeners[type] = fn as () => void;
  });
  vi.spyOn(window, "addEventListener").mockImplementation((type: string, fn: unknown) => {
    listeners[type] = fn as () => void;
  });
  vi.spyOn(document, "removeEventListener").mockImplementation(() => {});
  vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("useClearRoomNotifications", () => {
  it("closes the notifications for the room being viewed", async () => {
    const mine = makeNotification(roomId);
    notifications = [mine];
    renderHook(() => useClearRoomNotifications(roomId));
    await waitFor(() => expect(mine.close).toHaveBeenCalled());
  });

  it("leaves other rooms' notifications alone — they are still unread", async () => {
    const mine = makeNotification(roomId);
    const other = makeNotification("!other:example.org");
    notifications = [mine, other];
    renderHook(() => useClearRoomNotifications(roomId));
    await waitFor(() => expect(mine.close).toHaveBeenCalled());
    expect(other.close).not.toHaveBeenCalled();
  });

  it("does nothing while the tab is hidden — being routed to a room is not reading it", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    const mine = makeNotification(roomId);
    notifications = [mine];
    renderHook(() => useClearRoomNotifications(roomId));
    await waitFor(() => expect(navigator.serviceWorker.getRegistration).not.toHaveBeenCalled());
    expect(mine.close).not.toHaveBeenCalled();
  });

  it("clears on regaining visibility — the push landed while the room was already open", async () => {
    const mine = makeNotification(roomId);
    notifications = [mine];
    renderHook(() => useClearRoomNotifications(roomId));
    await waitFor(() => expect(mine.close).toHaveBeenCalled());

    // The case the mount-time pass cannot cover: same room, tab comes back.
    const later = makeNotification(roomId);
    notifications = [later];
    listeners.visibilitychange?.();
    await waitFor(() => expect(later.close).toHaveBeenCalled());
  });

  it("does nothing without a room", async () => {
    renderHook(() => useClearRoomNotifications(null));
    await waitFor(() => expect(navigator.serviceWorker.getRegistration).not.toHaveBeenCalled());
  });
});
