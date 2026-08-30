import { act, renderHook } from "@testing-library/react";
import { Direction } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useFillGap } from "./use-fill-gap";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

function gappyRoom() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, timelineSupport: true });
  const push = (eventId: string, body: string) =>
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        eventId,
        roomId,
        sender: "@a:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body },
      }),
    );
  push("$old1", "one");
  room.resetLiveTimeline("prev_batch_tok", "old_sync_tok");
  push("$new1", "three");

  const paginate = vi.fn().mockResolvedValue(true);
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: () => room,
    paginateEventTimeline: paginate,
  });
  MatrixClientPeg.injectClientForTest(client);
  return { room, paginate };
}

describe("useFillGap", () => {
  it("paginates the timeline that starts at the gap, not the live one", async () => {
    const { room, paginate } = gappyRoom();
    const [older, newer] = room.getUnfilteredTimelineSet().getTimelines();

    const { result } = renderHook(() => useFillGap(roomId, 50));
    await act(async () => {
      await result.current.fillGap("$new1");
    });

    expect(paginate).toHaveBeenCalledWith(newer, { backwards: true, limit: 50 });
    expect(paginate).not.toHaveBeenCalledWith(older, expect.anything());
  });

  it("exposes which gap is loading and clears it afterwards", async () => {
    const { paginate } = gappyRoom();
    let release: (v: boolean) => void = () => {};
    paginate.mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
    );

    const { result } = renderHook(() => useFillGap(roomId));
    expect(result.current.pendingGapId).toBeNull();

    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.fillGap("$new1");
    });
    expect(result.current.pendingGapId).toBe("$new1");

    await act(async () => {
      release(true);
      await pending;
    });
    expect(result.current.pendingGapId).toBeNull();
  });

  it("ignores a second click while one fill is in flight", async () => {
    const { paginate } = gappyRoom();
    let release: (v: boolean) => void = () => {};
    paginate.mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve;
      }),
    );

    const { result } = renderHook(() => useFillGap(roomId));
    await act(async () => {
      void result.current.fillGap("$new1");
    });
    await act(async () => {
      void result.current.fillGap("$new1");
      release(true);
    });

    expect(paginate).toHaveBeenCalledTimes(1);
  });

  it("is inert for an event that belongs to no timeline", async () => {
    const { paginate } = gappyRoom();

    const { result } = renderHook(() => useFillGap(roomId));
    await act(async () => {
      await result.current.fillGap("$nowhere");
    });

    expect(paginate).not.toHaveBeenCalled();
    expect(result.current.pendingGapId).toBeNull();
  });

  it("clears the pending id when pagination rejects", async () => {
    const { paginate } = gappyRoom();
    paginate.mockRejectedValue(new Error("network"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useFillGap(roomId));
    await act(async () => {
      await result.current.fillGap("$new1");
    });

    expect(result.current.pendingGapId).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("leaves the live timeline's own back-pagination alone", async () => {
    const { room, paginate } = gappyRoom();
    room.getLiveTimeline().setPaginationToken("tok", Direction.Backward);

    const { result } = renderHook(() => useFillGap(roomId));
    await act(async () => {
      await result.current.fillGap("$old1");
    });

    const [older] = room.getUnfilteredTimelineSet().getTimelines();
    expect(paginate).toHaveBeenCalledWith(older, { backwards: true, limit: 50 });
  });
});
