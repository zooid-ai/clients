import { act, renderHook, waitFor } from "@testing-library/react";
import { Direction, type EventTimeline, RoomEvent, type Room } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useThread } from "./use-timeline";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

// Every test uses its own root id: fetched roots and thread snapshots are
// cached at module level, keyed by room and root.
function setup() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, timelineSupport: true });
  (client as unknown as Record<string, unknown>).getRoom = () => room;
  MatrixClientPeg.injectClientForTest(client);

  const msg = (eventId: string, ts: number) =>
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        eventId,
        roomId,
        sender: "@a:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body: eventId },
        ts,
      }),
    );
  const reply = (eventId: string, rootId: string, ts: number) =>
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        eventId,
        roomId,
        sender: "@a:h.example",
        type: "m.room.message",
        content: {
          msgtype: "m.text",
          body: eventId,
          "m.relates_to": { rel_type: "m.thread", event_id: rootId },
        },
        ts,
      }),
    );
  // What sync does for a room that came back `limited: true`: fork a new
  // timeline carrying a prev_batch, leaving the old one unjoined.
  const gappySync = () => room.resetLiveTimeline("hole_tok", "old_sync_tok");
  const timelines = () => room.getUnfilteredTimelineSet().getTimelines();
  return { client, room, msg, reply, gappySync, timelines };
}

// What paginating across a hole does once it reaches events already loaded.
function join(room: Room, older: EventTimeline, newer: EventTimeline) {
  newer.setNeighbouringTimeline(older, Direction.Backward);
  older.setNeighbouringTimeline(newer, Direction.Forward);
  room.emit(RoomEvent.TimelineReset, room, room.getUnfilteredTimelineSet(), true);
}

describe("useThread gap anchors", () => {
  // ZNC103 D6: the repro. If the first expectation fails, the thread is NOT
  // spanning both timelines and the spec's analysis is wrong. Stop and take it
  // back to Lead rather than rewriting useThread.
  it("spans both stretches of a gappy room and marks the hole after the root", () => {
    const { msg, reply, gappySync } = setup();
    msg("$t1-root", 1000);
    reply("$t1-r1", "$t1-root", 1100);
    gappySync();
    reply("$t1-r2", "$t1-root", 3000);

    const { result } = renderHook(() => useThread(roomId, "$t1-root"));
    expect(result.current.events.map((e) => e.getId())).toEqual(["$t1-r1", "$t1-r2"]);
    expect(result.current.gapBeforeEventIds).toEqual(["$t1-r2"]);
  });

  it("reports no gaps for a thread with one contiguous history", () => {
    const { msg, reply } = setup();
    msg("$t2-root", 1000);
    reply("$t2-r1", "$t2-root", 1100);
    reply("$t2-r2", "$t2-root", 1200);

    const { result } = renderHook(() => useThread(roomId, "$t2-root"));
    expect(result.current.gapBeforeEventIds).toEqual([]);
  });

  // The later stretch's own first event is not a reply of this thread, so it
  // never renders here. Anchoring to it would drop the marker.
  it("anchors to the first rendered reply after the hole, not the timeline's first event", () => {
    const { msg, reply, gappySync } = setup();
    msg("$t3-root", 1000);
    reply("$t3-r1", "$t3-root", 1100);
    gappySync();
    msg("$t3-filler", 3000);
    reply("$t3-r2", "$t3-root", 3100);

    const { result } = renderHook(() => useThread(roomId, "$t3-root"));
    expect(result.current.gapBeforeEventIds).toEqual(["$t3-r2"]);
  });

  it("marks a hole whose only thread event above it is a fetched root", async () => {
    const { client, msg, reply, gappySync } = setup();
    (client as unknown as Record<string, unknown>).fetchRoomEvent = vi.fn().mockResolvedValue({
      event_id: "$t4-root",
      room_id: roomId,
      sender: "@a:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "root" },
      origin_server_ts: 1000,
    });
    msg("$t4-older", 2000);
    gappySync();
    reply("$t4-r1", "$t4-root", 3000);
    reply("$t4-r2", "$t4-root", 3100);

    const { result } = renderHook(() => useThread(roomId, "$t4-root"));
    await waitFor(() => expect(result.current.root?.getId()).toBe("$t4-root"));
    expect(result.current.gapBeforeEventIds).toEqual(["$t4-r1"]);
  });

  it("does not mark a hole that lies before the root", () => {
    const { msg, reply, gappySync } = setup();
    msg("$t5-older", 500);
    gappySync();
    msg("$t5-root", 1000);
    reply("$t5-r1", "$t5-root", 1100);

    const { result } = renderHook(() => useThread(roomId, "$t5-root"));
    expect(result.current.gapBeforeEventIds).toEqual([]);
  });

  it("does not mark a hole after the last rendered reply", () => {
    const { msg, reply, gappySync } = setup();
    msg("$t6-root", 1000);
    reply("$t6-r1", "$t6-root", 1100);
    gappySync();
    msg("$t6-later", 3000);

    const { result } = renderHook(() => useThread(roomId, "$t6-root"));
    expect(result.current.gapBeforeEventIds).toEqual([]);
  });

  it("shows several holes before the same reply as one marker", () => {
    const { msg, reply, gappySync } = setup();
    msg("$t7-root", 1000);
    reply("$t7-r1", "$t7-root", 1100);
    gappySync();
    msg("$t7-mid", 2000);
    gappySync();
    reply("$t7-r2", "$t7-root", 3000);

    const { result } = renderHook(() => useThread(roomId, "$t7-root"));
    expect(result.current.gapBeforeEventIds).toEqual(["$t7-r2"]);
  });

  // The join adds no reply of this thread, so a cache keyed on reply count
  // alone would keep serving the old snapshot and the marker would never go.
  it("retires the marker when the hole joins, though no reply was added", () => {
    const { room, msg, reply, gappySync, timelines } = setup();
    msg("$t8-root", 1000);
    reply("$t8-r1", "$t8-root", 1100);
    gappySync();
    reply("$t8-r2", "$t8-root", 3000);

    const { result } = renderHook(() => useThread(roomId, "$t8-root"));
    expect(result.current.gapBeforeEventIds).toEqual(["$t8-r2"]);

    act(() => {
      const [older, newer] = timelines();
      join(room, older, newer);
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.gapBeforeEventIds).toEqual([]);
  });

  // ZNC103 D4: one hole closes, another still sits above the same anchor.
  it("keeps the marker while another hole remains above the same reply", () => {
    const { room, msg, reply, gappySync, timelines } = setup();
    msg("$t9-root", 1000);
    reply("$t9-r1", "$t9-root", 1100);
    gappySync();
    msg("$t9-mid", 2000);
    gappySync();
    reply("$t9-r2", "$t9-root", 3000);

    const { result } = renderHook(() => useThread(roomId, "$t9-root"));
    act(() => {
      const [, middle, newest] = timelines();
      join(room, middle, newest);
    });

    expect(result.current.gapBeforeEventIds).toEqual(["$t9-r2"]);
  });
});
