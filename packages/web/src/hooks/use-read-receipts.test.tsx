import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import {
  makeFakeClient,
  makeMatrixEvent,
  makeRoom,
  pushTimelineEvent,
} from "../../test/factories";
import { useReadReceipts } from "./use-read-receipts";

const roomId = "!r:h.example";
const me = "@me:h.example";
const targetId = "$m1";

afterEach(() => MatrixClientPeg.reset());

type Receipt = { userId: string; type: string; data: { ts: number } };

function setup(receipts: Receipt[]) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
  // Stub the receipt lookup — same cast convention as existing tests.
  (room as unknown as { getReceiptsForEvent: (ev: unknown) => Receipt[] }).getReceiptsForEvent =
    () => receipts;
  MatrixClientPeg.injectClientForTest(client);
  pushTimelineEvent(
    room,
    makeMatrixEvent({
      eventId: targetId,
      roomId,
      sender: "@alice:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "hi" },
    }),
  );
  return { client, room };
}

describe("useReadReceipts", () => {
  it("returns user ids with m.read receipts on the event", () => {
    setup([
      { userId: "@bob:h.example", type: "m.read", data: { ts: 1 } },
      { userId: "@carol:h.example", type: "m.read", data: { ts: 2 } },
    ]);
    const { result } = renderHook(() => useReadReceipts(roomId, targetId));
    expect(result.current).toEqual(["@bob:h.example", "@carol:h.example"]);
  });

  it("excludes the viewing user", () => {
    setup([
      { userId: me, type: "m.read", data: { ts: 1 } },
      { userId: "@bob:h.example", type: "m.read", data: { ts: 2 } },
    ]);
    const { result } = renderHook(() => useReadReceipts(roomId, targetId));
    expect(result.current).toEqual(["@bob:h.example"]);
  });

  it("ignores non-read receipt types", () => {
    setup([{ userId: "@bob:h.example", type: "m.fully_read", data: { ts: 1 } }]);
    const { result } = renderHook(() => useReadReceipts(roomId, targetId));
    expect(result.current).toEqual([]);
  });

  it("returns a stable empty array when there are no receipts", () => {
    setup([]);
    const { result, rerender } = renderHook(() => useReadReceipts(roomId, targetId));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
