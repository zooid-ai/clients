import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { usePlan } from "./use-plan";

const me = "@me:h.example";
const roomId = "!r:h.example";
const THREAD_ROOT = "$thread-root:h.example";

afterEach(() => MatrixClientPeg.reset());

function wire() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === roomId ? room : null;
  MatrixClientPeg.injectClientForTest(client);
  return { client, room };
}

function threadContent(extra: Record<string, unknown>) {
  return {
    ...extra,
    "m.relates_to": { rel_type: "m.thread", event_id: THREAD_ROOT },
  };
}

describe("usePlan", () => {
  it("returns null when there is no plan", () => {
    wire();
    const { result } = renderHook(() => usePlan(roomId, THREAD_ROOT));
    expect(result.current).toBeNull();
  });

  it("returns the latest plan snapshot, replacing earlier ones", () => {
    const { room } = wire();
    const { result } = renderHook(() => usePlan(roomId, THREAD_ROOT));

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "eco.zoon.plan",
          content: threadContent({
            session_id: "s1",
            entries: [{ content: "Add bananas", status: "pending" }],
          }),
        }),
      );
    });
    expect(result.current?.entries).toEqual([{ content: "Add bananas", status: "pending" }]);

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "eco.zoon.plan",
          content: threadContent({
            session_id: "s1",
            entries: [
              { content: "Add bananas", status: "completed" },
              { content: "Add bread", status: "in_progress" },
            ],
          }),
        }),
      );
    });
    // Full-snapshot replace: the board reflects only the newest event.
    expect(result.current?.entries).toEqual([
      { content: "Add bananas", status: "completed" },
      { content: "Add bread", status: "in_progress" },
    ]);
  });

  it("lifts a planning tool call into the board when no `plan` event is present", () => {
    const { room } = wire();
    const { result } = renderHook(() => usePlan(roomId, THREAD_ROOT));

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "eco.zoon.tool_call",
          content: threadContent({
            session_id: "s1",
            tool_call_id: "tc1",
            title: "TodoWrite",
            kind: "other",
            raw_input: { todos: [{ content: "Add milk", status: "pending" }] },
          }),
        }),
      );
    });
    expect(result.current?.entries).toEqual([{ content: "Add milk", status: "pending" }]);
  });
});
