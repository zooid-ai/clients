import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { ElicitationEventType } from "../events/elicitation";
import { useAwaitingInput } from "./use-timeline";

const me = "@me:h.example";
const agent = "@architect.acme:h.example";
const roomId = "!r:h.example";
const thread = { "m.relates_to": { rel_type: "m.thread", event_id: "$root" } };

afterEach(() => MatrixClientPeg.reset());

describe("useAwaitingInput", () => {
  it("tracks agents with open questions, including threaded ones", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useAwaitingInput(roomId));
    expect(result.current).toEqual([]);
    act(() => pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: agent, type: ElicitationEventType.Request, eventId: "$ereq",
      content: { version: 1, request_id: "e1", session_id: "s1", message: "q", requested_schema: { type: "object", properties: {} }, ...thread },
    })));
    expect(result.current).toEqual([agent]);
    const first = result.current;
    act(() => pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: me, type: "m.room.message", content: { msgtype: "m.text", body: "hi" },
    })));
    expect(result.current).toBe(first); // stable reference while unchanged
    act(() => pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: agent, type: ElicitationEventType.Resolved,
      content: { version: 1, request_id: "e1", status: "accepted", ...thread },
    })));
    expect(result.current).toEqual([]);
  });
});
