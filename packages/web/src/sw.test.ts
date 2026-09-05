import { beforeEach, describe, expect, it } from "vitest";
import { loadServiceWorker, makeSwClient, type SwScope } from "../test/sw-harness";

let sw: SwScope;

function pushEvent(data: Record<string, unknown>) {
  return { data: { json: () => data } };
}

const message = {
  room_id: "!r:example.org",
  room_name: "general",
  event_id: "$e",
  sender_display_name: "Alice",
  type: "m.room.message",
  body: "hello",
  unread: 2,
  sound: false,
};

beforeEach(() => {
  sw = loadServiceWorker();
});

describe("push", () => {
  it("shows a chat notification tagged by event id", async () => {
    sw.setClients([]);
    await sw.dispatch("push", pushEvent(message));
    expect(sw.showNotification).toHaveBeenCalledWith(
      "general",
      expect.objectContaining({ body: "Alice: hello", tag: "$e", silent: true }),
    );
  });

  it("renders an agent event differently from a chat message", async () => {
    sw.setClients([]);
    await sw.dispatch(
      "push",
      pushEvent({ ...message, type: "dev.zooid.approval_request", body: undefined, sender_display_name: "claude" }),
    );
    const [title, opts] = sw.showNotification.mock.calls[0]!;
    expect(title).toBe("general");
    expect((opts as { body: string }).body).toContain("claude");
    expect((opts as { body: string }).body).not.toContain("undefined");
  });

  it("suppresses when a visible client is already in that room", async () => {
    sw.setClients([
      makeSwClient({ url: "https://zooid.example/room/!r:example.org", visibilityState: "visible" }),
    ]);
    await sw.dispatch("push", pushEvent(message));
    expect(sw.showNotification).not.toHaveBeenCalled();
  });

  it("still notifies when a visible client is in a DIFFERENT room", async () => {
    sw.setClients([
      makeSwClient({ url: "https://zooid.example/room/!other:example.org", visibilityState: "visible" }),
    ]);
    await sw.dispatch("push", pushEvent(message));
    expect(sw.showNotification).toHaveBeenCalled();
  });

  it("still notifies when a client is in that room but hidden", async () => {
    sw.setClients([
      makeSwClient({ url: "https://zooid.example/room/!r:example.org", visibilityState: "hidden" }),
    ]);
    await sw.dispatch("push", pushEvent(message));
    expect(sw.showNotification).toHaveBeenCalled();
  });

  it("asks an open client to play the cue and keeps the notification silent", async () => {
    const client = makeSwClient();
    sw.setClients([client]);
    await sw.dispatch("push", pushEvent({ ...message, type: "dev.zooid.turn.end", body: undefined, sound: true }));
    expect(client.postMessage).toHaveBeenCalledWith({ type: "sound", roomId: "!r:example.org" });
    expect(sw.showNotification.mock.calls[0]![1]).toMatchObject({ silent: true });
  });

  it("falls back to the OS sound when no client can play the cue", async () => {
    sw.setClients([]);
    await sw.dispatch("push", pushEvent({ ...message, type: "dev.zooid.turn.end", body: undefined, sound: true }));
    expect(sw.showNotification.mock.calls[0]![1]).toMatchObject({ silent: false });
  });

  it("does not ask for a cue when the tweak is absent", async () => {
    const client = makeSwClient();
    sw.setClients([client]);
    await sw.dispatch("push", pushEvent(message));
    expect(client.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "sound" }));
  });

  it("shows a fallback notification rather than nothing on an unparseable payload", async () => {
    sw.setClients([]);
    await sw.dispatch("push", { data: { json: () => { throw new Error("bad"); } } });
    // userVisibleOnly is a contract: a push that shows nothing gets the origin penalised.
    expect(sw.showNotification).toHaveBeenCalled();
  });
});

describe("notificationclick", () => {
  it("focuses an existing client and asks it to navigate", async () => {
    const client = makeSwClient();
    sw.setClients([client]);
    await sw.dispatch("notificationclick", {
      notification: { data: { roomId: "!r:example.org" }, close: () => {} },
    });
    expect(client.focus).toHaveBeenCalled();
    expect(client.postMessage).toHaveBeenCalledWith({ type: "navigate", roomId: "!r:example.org" });
    expect(sw.openWindow).not.toHaveBeenCalled();
  });

  it("opens a window when nothing is running", async () => {
    sw.setClients([]);
    await sw.dispatch("notificationclick", {
      notification: { data: { roomId: "!r:example.org" }, close: () => {} },
    });
    expect(sw.openWindow).toHaveBeenCalledWith("/room/!r:example.org");
  });
});
