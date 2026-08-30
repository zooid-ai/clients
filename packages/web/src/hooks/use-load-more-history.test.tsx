import { act, renderHook } from "@testing-library/react";
import { Direction } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientEventName, makeFakeClient, makeRoom } from "../../test/factories";
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
});
