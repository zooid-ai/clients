import { act, renderHook } from "@testing-library/react";
import type { Room } from "matrix-js-sdk";
import { afterEach, describe, expect, it } from "vitest";
import {
  makeFakeClient,
  makeRoom,
  mkMatrixEvent,
  pushTimelineEvent,
} from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useTimeline, useThreadPreview } from "./use-timeline";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useTimeline", () => {
  it("returns the room's current live timeline events", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        roomId,
        sender: "@a:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body: "hello" },
      }),
    );
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
      id === roomId ? room : null;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].getContent().body).toBe("hello");
  });

  it("appends new live events", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(0);

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@a:h.example",
          type: "m.room.message",
          content: { msgtype: "m.text", body: "first" },
        }),
      );
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@b:h.example",
          type: "m.room.message",
          content: { msgtype: "m.text", body: "second" },
        }),
      );
    });
    expect(result.current.events.map((e) => e.getContent().body)).toEqual(["first", "second"]);
  });

  it("returns empty when the room does not exist", () => {
    const client = makeFakeClient({ userId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => null;
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useTimeline("!missing:h.example"));
    expect(result.current.events).toEqual([]);
  });

  it("filters out m.replace edit events from the main timeline", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    const original = mkMatrixEvent({
      eventId: "$m1",
      roomId,
      sender: me,
      type: "m.room.message",
      content: { msgtype: "m.text", body: "original" },
    });
    const edit = mkMatrixEvent({
      eventId: "$e1",
      roomId,
      sender: me,
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: "* edited",
        "m.new_content": { msgtype: "m.text", body: "edited" },
        "m.relates_to": { rel_type: "m.replace", event_id: "$m1" },
      },
    });
    pushTimelineEvent(room, original);
    pushTimelineEvent(room, edit);
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].getId()).toBe("$m1");
  });

  it("keeps an edited threaded message in the thread after makeReplaced", () => {
    // Regression: after makeReplaced(), getContent() returns m.new_content which
    // has no m.relates_to, so the event leaked into the main timeline.
    // getRelation() reads getWireContent() and is immune to this.
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    const root = mkMatrixEvent({
      eventId: "$root",
      roomId,
      sender: "@a:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "root" },
    });
    const threaded = mkMatrixEvent({
      eventId: "$t1",
      roomId,
      sender: me,
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: "thread reply",
        "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
      },
    });
    const edit = mkMatrixEvent({
      eventId: "$e1",
      roomId,
      sender: me,
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: "* edited reply",
        "m.new_content": { msgtype: "m.text", body: "edited reply" },
        "m.relates_to": { rel_type: "m.replace", event_id: "$t1" },
      },
    });
    // Simulate what matrix-js-sdk does when it processes the edit event.
    threaded.makeReplaced(edit);

    pushTimelineEvent(room, root);
    pushTimelineEvent(room, threaded);
    pushTimelineEvent(room, edit);
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    // Root is in main timeline; threaded reply and edit event must not be.
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].getId()).toBe("$root");
  });

  it("filters out thread reply events from the main timeline", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    const rootEvt = mkMatrixEvent({
      roomId,
      sender: "@a:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "root" },
    });
    const replyEvt = mkMatrixEvent({
      roomId,
      sender: "@b:h.example",
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: "reply",
        "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
      },
    });
    pushTimelineEvent(room, rootEvt);
    pushTimelineEvent(room, replyEvt);
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].getContent().body).toBe("root");
  });
});

// A gappy ("limited: true") /sync makes matrix-js-sdk call
// Room.resetLiveTimeline. With timelineSupport off that discards every loaded
// event; with it on the old timeline is kept and linked. Either way the SDK
// emits Room.timelineReset and *no* Room.timeline, so a store that only
// listens to the latter renders stale history until an unrelated event
// happens to arrive. See zooid-ai/zooid#14.
describe("useTimeline across a gappy sync", () => {
  function seed(room: Room, bodies: string[]) {
    for (const body of bodies) {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@a:h.example",
          type: "m.room.message",
          content: { msgtype: "m.text", body },
        }),
      );
    }
  }

  it("re-reads the timeline when the SDK resets it", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    seed(room, ["one", "two"]);
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(2);

    act(() => {
      room.resetLiveTimeline("prev_batch_tok", null);
    });

    // The reset happened; whatever the hook now reports must match the room,
    // not a snapshot frozen from before the reset.
    expect(result.current.events.map((e) => e.getId())).toEqual(
      room
        .getUnfilteredTimelineSet()
        .getTimelines()
        .flatMap((tl) => tl.getEvents())
        .map((e) => e.getId()),
    );
  });

  it("keeps history across the reset when timelineSupport is enabled", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me, timelineSupport: true });
    seed(room, ["one", "two"]);
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(2);

    act(() => {
      // Second arg is the forward-pagination token sync passes for a gappy
      // room; it is what lets the SDK keep the old timeline around.
      room.resetLiveTimeline("prev_batch_tok", "old_sync_tok");
      seed(room, ["three"]);
    });

    expect(result.current.events.map((e) => e.getContent().body)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("drops history across the reset when timelineSupport is disabled", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me, timelineSupport: false });
    seed(room, ["one", "two"]);
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(2);

    act(() => {
      room.resetLiveTimeline("prev_batch_tok", "old_sync_tok");
      seed(room, ["three"]);
    });

    // Documents the SDK behaviour the fix exists to avoid: without
    // timelineSupport the earlier events are gone from the timeline set.
    expect(result.current.events.map((e) => e.getContent().body)).toEqual(["three"]);
  });
});

describe("useThreadPreview", () => {
  it("returns thread reply events and their count", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    const rootEvt = mkMatrixEvent({
      eventId: "$root",
      roomId,
      sender: "@a:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "root" },
    });
    const replyEvt = mkMatrixEvent({
      roomId,
      sender: "@agent:h.example",
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: "agent reply",
        "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
      },
    });
    pushTimelineEvent(room, rootEvt);
    pushTimelineEvent(room, replyEvt);
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useThreadPreview(roomId, "$root"));
    expect(result.current.totalCount).toBe(1);
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].getContent().body).toBe("agent reply");
  });

  it("updates when a new thread reply arrives", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useThreadPreview(roomId, "$root"));
    expect(result.current.totalCount).toBe(0);

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "m.room.message",
          content: {
            msgtype: "m.text",
            body: "new reply",
            "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
          },
        }),
      );
    });
    expect(result.current.totalCount).toBe(1);
    expect(result.current.events[0].getContent().body).toBe("new reply");
  });
});
