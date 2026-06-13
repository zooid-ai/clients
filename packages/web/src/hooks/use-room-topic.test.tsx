import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useRoomTopic } from "./use-room-topic";

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => MatrixClientPeg.reset());

function inject(topic: string | null) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  if (topic !== null) {
    injectStateEvent(
      room,
      mkMatrixEvent({ roomId, sender: "@a:h.example", type: "m.room.topic", stateKey: "", content: { topic } }),
    );
  }
  Object.assign(client as unknown as Record<string, unknown>, { getRoom: (id: string) => (id === roomId ? room : null) });
  MatrixClientPeg.injectClientForTest(client);
}

describe("useRoomTopic", () => {
  it("reads the m.room.topic state event", () => {
    inject("ship the daemon");
    const { result } = renderHook(() => useRoomTopic(roomId));
    expect(result.current).toBe("ship the daemon");
  });
  it("returns null when there is no topic", () => {
    inject(null);
    const { result } = renderHook(() => useRoomTopic(roomId));
    expect(result.current).toBeNull();
  });
});
