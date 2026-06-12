import { act, renderHook } from "@testing-library/react";
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
