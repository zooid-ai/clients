import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  makeFakeClient,
  makeRoom,
  mkMatrixEvent,
  pushTimelineEvent,
} from "../../test/factories";
import { ApprovalEventType } from "../events/approval";
import { MatrixClientPeg } from "../client/peg";
import { useApproval } from "./use-approval";

const me = "@me:h.example";
const roomId = "!r:h.example";
const requestId = "$req1";

function setup(opts: { sendEvent?: ReturnType<typeof vi.fn> } = {}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, powerLevels: { [me]: 0 } });
  const requestEv = mkMatrixEvent({
    roomId,
    sender: "@architect.acme:h.example",
    type: ApprovalEventType.Request,
    content: { approval_id: "a1", session_id: "s1", tool_call_id: "tc1" },
    eventId: requestId,
  });
  pushTimelineEvent(room, requestEv);
  (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
  (client as unknown as { sendEvent: unknown }).sendEvent =
    opts.sendEvent ?? vi.fn().mockResolvedValue({ event_id: "$resp1" });
  MatrixClientPeg.injectClientForTest(client);
  return { client, room, requestEv };
}

afterEach(() => MatrixClientPeg.reset());

describe("useApproval — pending state", () => {
  it("starts pending", () => {
    const { requestEv } = setup();
    const { result } = renderHook(() => useApproval(requestEv));
    expect(result.current.state).toBe("pending");
  });
});

describe("useApproval — send", () => {
  it("send('allow') flips state to sending then back to pending awaiting timeline echo", async () => {
    const sendEvent = vi.fn().mockResolvedValue({ event_id: "$r1" });
    const { requestEv } = setup({ sendEvent });
    const { result } = renderHook(() => useApproval(requestEv));

    let p: Promise<void>;
    act(() => {
      p = result.current.send("allow");
    });
    expect(result.current.state).toBe("sending");
    await act(async () => {
      await p!;
    });
    // After sendEvent resolves we revert to "pending" — the resolved state
    // only flips when the response event actually appears in /sync.
    expect(result.current.state).toBe("pending");
    expect(sendEvent).toHaveBeenCalledWith(
      roomId,
      ApprovalEventType.Response,
      { approval_id: "a1", decision: "allow" },
    );
  });

  it("idempotency: while sending, repeat clicks no-op", async () => {
    let resolveSend: () => void = () => {};
    const sendEvent = vi.fn().mockImplementation(
      () =>
        new Promise<{ event_id: string }>((res) => {
          resolveSend = () => res({ event_id: "$r1" });
        }),
    );
    const { requestEv } = setup({ sendEvent });
    const { result } = renderHook(() => useApproval(requestEv));

    act(() => {
      result.current.send("allow");
    });
    expect(result.current.state).toBe("sending");
    act(() => {
      result.current.send("allow");
      result.current.send("cancel");
    });
    expect(sendEvent).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSend();
    });
  });

  it("idempotency: once resolved by *anyone*, send() is a no-op", async () => {
    const sendEvent = vi.fn();
    const { requestEv, room } = setup({ sendEvent });
    const { result } = renderHook(() => useApproval(requestEv));

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@bob:h.example",
          type: ApprovalEventType.Response,
          content: { approval_id: "a1", decision: "allow" },
        }),
      );
    });
    await waitFor(() => expect(result.current.state).toBe("resolved"));
    act(() => {
      result.current.send("allow");
    });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("send error surfaces and re-enables the buttons", async () => {
    const sendEvent = vi.fn().mockRejectedValue(new Error("M_FORBIDDEN"));
    const { requestEv } = setup({ sendEvent });
    const { result } = renderHook(() => useApproval(requestEv));
    await act(async () => {
      await result.current.send("allow").catch(() => {});
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/M_FORBIDDEN/);
    sendEvent.mockResolvedValueOnce({ event_id: "$r1" });
    await act(async () => {
      await result.current.send("allow");
    });
    expect(sendEvent).toHaveBeenCalledTimes(2);
  });
});

describe("useApproval — resolved state", () => {
  it("flips to resolved when a matching response is in the timeline", () => {
    const { requestEv, room } = setup();
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        roomId,
        sender: "@bob:h.example",
        type: ApprovalEventType.Response,
        content: { approval_id: "a1", decision: "cancel" },
      }),
    );
    const { result } = renderHook(() => useApproval(requestEv));
    expect(result.current.state).toBe("resolved");
    expect(result.current.resolution).toEqual({
      approvalId: "a1",
      decision: "cancel",
      optionId: undefined,
      respondedBy: "@bob:h.example",
    });
  });

  it("flips live when a response event arrives mid-render", () => {
    const { requestEv, room } = setup();
    const { result } = renderHook(() => useApproval(requestEv));
    expect(result.current.state).toBe("pending");
    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@me:h.example",
          type: ApprovalEventType.Response,
          content: { approval_id: "a1", decision: "allow" },
        }),
      );
    });
    expect(result.current.state).toBe("resolved");
    expect(result.current.resolution?.respondedBy).toBe("@me:h.example");
  });
});
