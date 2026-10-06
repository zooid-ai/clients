import { act, renderHook } from "@testing-library/react";
import { Direction, RoomEvent } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClientEventName,
  makeFakeClient,
  makeRoom,
  mkMatrixEvent,
  pushTimelineEvent,
} from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useLoadMoreHistory } from "./use-load-more-history";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useLoadMoreHistory", () => {
  it("offers more history when the live timeline has a back-pagination token", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    room.getLiveTimeline().setPaginationToken("tok", Direction.Backward);
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useLoadMoreHistory(roomId));
    expect(result.current.hasMore).toBe(true);
  });

  // Navigating straight to /room/:roomId after login mounts this hook before
  // sync has delivered the room. The hook used to bail out and never re-check,
  // so hasMore stayed false for the whole mount: no prefetch, and no "Load
  // more" button — the timeline was stuck at the initial sync window
  // (zooid-ai/zooid#14).
  it("recovers when the room only arrives after mount", () => {
    const client = makeFakeClient({ userId: me });
    let room: ReturnType<typeof makeRoom> | null = null;
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useLoadMoreHistory(roomId));
    expect(result.current.hasMore).toBe(false);

    act(() => {
      room = makeRoom(roomId, { client, myUserId: me });
      room.getLiveTimeline().setPaginationToken("tok", Direction.Backward);
      (client as unknown as { emit: (n: string, r: unknown) => void }).emit(
        ClientEventName.Room,
        room,
      );
    });

    expect(result.current.hasMore).toBe(true);
  });

  it("stops offering more once pagination reaches the start of the room", async () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    room.getLiveTimeline().setPaginationToken("tok", Direction.Backward);
    const paginate = vi.fn().mockResolvedValue(false);
    Object.assign(client as unknown as Record<string, unknown>, {
      getRoom: () => room,
      paginateEventTimeline: paginate,
    });
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useLoadMoreHistory(roomId));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(paginate).toHaveBeenCalledWith(room.getLiveTimeline(), {
      backwards: true,
      limit: 50,
    });
    expect(result.current.hasMore).toBe(false);
  });

  describe("after a gappy sync", () => {
    function gappyRoom() {
      const client = makeFakeClient({ userId: me });
      const room = makeRoom(roomId, { client, myUserId: me, timelineSupport: true });
      const push = (eventId: string, ts: number) =>
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
      push("$old1", 1000);
      room.getLiveTimeline().setPaginationToken("older_tok", Direction.Backward);
      room.resetLiveTimeline("hole_tok", "old_sync_tok");
      push("$new1", 3000);
      const [older, newer] = room.getUnfilteredTimelineSet().getTimelines();

      const paginate = vi.fn().mockResolvedValue(true);
      Object.assign(client as unknown as Record<string, unknown>, {
        getRoom: () => room,
        paginateEventTimeline: paginate,
      });
      MatrixClientPeg.injectClientForTest(client);
      return { room, older, newer, paginate };
    }

    it("paginates the oldest timeline, not the live one", async () => {
      const { older, newer, paginate } = gappyRoom();

      const { result } = renderHook(() => useLoadMoreHistory(roomId));
      await act(async () => {
        await result.current.loadMore();
      });

      expect(paginate).toHaveBeenCalledWith(older, { backwards: true, limit: 50 });
      expect(paginate).not.toHaveBeenCalledWith(newer, expect.anything());
    });

    it("keeps offering more once the hole joins, while the older timeline holds a token", () => {
      const { room, older, newer } = gappyRoom();
      expect(newer.getPaginationToken(Direction.Backward)).toBe("hole_tok");

      const { result } = renderHook(() => useLoadMoreHistory(roomId));
      expect(result.current.hasMore).toBe(true);

      // What the SDK does when pagination across the hole reaches known events.
      act(() => {
        newer.setNeighbouringTimeline(older, Direction.Backward);
        older.setNeighbouringTimeline(newer, Direction.Forward);
        room.emit(RoomEvent.TimelineReset, room, room.getUnfilteredTimelineSet(), true);
      });

      expect(newer.getPaginationToken(Direction.Backward)).toBeNull();
      expect(older.getPaginationToken(Direction.Backward)).toBe("older_tok");
      expect(result.current.hasMore).toBe(true);
    });

    it("hides the button once the oldest timeline reaches the start of the room", () => {
      const { room, older, newer } = gappyRoom();
      newer.setNeighbouringTimeline(older, Direction.Backward);
      older.setNeighbouringTimeline(newer, Direction.Forward);
      older.setPaginationToken(null, Direction.Backward);

      const { result } = renderHook(() => useLoadMoreHistory(roomId));
      expect(result.current.hasMore).toBe(false);
      expect(room.getLiveTimeline().getPaginationToken(Direction.Backward)).toBeNull();
    });
  });
});
