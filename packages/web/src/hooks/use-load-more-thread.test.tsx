import { renderHook, act } from "@testing-library/react";
import { Direction, type Room } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useLoadMoreThread } from "./use-load-more-thread";

const me = "@me:h.example";
const roomId = "!r:h.example";
const rootId = "$root:h.example";

afterEach(() => MatrixClientPeg.reset());

function setup(opts: { thread?: unknown; backToken?: string | null } = {}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  room
    .getLiveTimeline()
    .setPaginationToken(opts.backToken === undefined ? "tok" : opts.backToken, Direction.Backward);
  (room as unknown as { getThread: (id: string) => unknown }).getThread = () =>
    opts.thread ?? null;
  const paginate = vi.fn().mockResolvedValue(true);
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: (id: string) => (id === roomId ? room : null),
    paginateEventTimeline: paginate,
  });
  MatrixClientPeg.injectClientForTest(client);
  return { client, room, paginate };
}

describe("useLoadMoreThread", () => {
  // The client runs with threadSupport disabled, so Room.partitionThreadedEvents
  // keeps thread replies in the main room timeline and room.getThread() never
  // returns anything. Bailing on a null Thread made the ThreadView "Load more"
  // button a permanent no-op (zooid-ai/zooid#14).
  it("paginates the room's live timeline when the SDK has no Thread object", async () => {
    const { room, paginate } = setup({ thread: null });

    const { result } = renderHook(() => useLoadMoreThread(roomId, rootId, 50));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(paginate).toHaveBeenCalledTimes(1);
    expect(paginate).toHaveBeenCalledWith(room.getLiveTimeline(), {
      backwards: true,
      limit: 50,
    });
  });

  it("paginates the thread's own timeline when threadSupport gives us one", async () => {
    const threadTimeline = { getPaginationToken: () => "thread-tok" };
    const { paginate } = setup({ thread: { liveTimeline: threadTimeline } });

    const { result } = renderHook(() => useLoadMoreThread(roomId, rootId, 50));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(paginate).toHaveBeenCalledWith(threadTimeline, { backwards: true, limit: 50 });
  });

  it("reports hasMore false once the room timeline has no back-pagination token", () => {
    setup({ thread: null, backToken: null });

    const { result } = renderHook(() => useLoadMoreThread(roomId, rootId));
    expect(result.current.hasMore).toBe(false);
  });

  it("reports hasMore true while the room timeline still has a token", () => {
    setup({ thread: null });

    const { result } = renderHook(() => useLoadMoreThread(roomId, rootId));
    expect(result.current.hasMore).toBe(true);
  });

  it("stops offering more once pagination reaches the start of the room", async () => {
    const { paginate } = setup({ thread: null });
    paginate.mockResolvedValue(false);

    const { result } = renderHook(() => useLoadMoreThread(roomId, rootId));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.hasMore).toBe(false);
  });

  it("does not fire a second request while one is in flight", async () => {
    const { paginate } = setup({ thread: null });
    let release: (v: boolean) => void = () => {};
    paginate.mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
    );

    const { result } = renderHook(() => useLoadMoreThread(roomId, rootId));
    await act(async () => {
      void result.current.loadMore();
    });
    await act(async () => {
      void result.current.loadMore();
      release(true);
    });

    expect(paginate).toHaveBeenCalledTimes(1);
  });

  it("is inert when the room is not in the store", async () => {
    const client = makeFakeClient({ userId: me });
    const paginate = vi.fn();
    Object.assign(client as unknown as Record<string, unknown>, {
      getRoom: () => null as Room | null,
      paginateEventTimeline: paginate,
    });
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useLoadMoreThread(roomId, rootId));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(paginate).not.toHaveBeenCalled();
    expect(result.current.hasMore).toBe(false);
  });
});
