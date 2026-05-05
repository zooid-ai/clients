import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventType } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  injectStateEvent,
  makeFakeClient,
  makeRoom,
  mkMatrixEvent,
  pushTimelineEvent,
} from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { ApprovalEventType } from "../../events/approval";
import { ApprovalCard } from "./approval-card";

const me = "@me:h.example";
const roomId = "!r:h.example";

function makeRequestEvent() {
  return mkMatrixEvent({
    roomId,
    sender: "@architect.acme:h.example",
    type: ApprovalEventType.Request,
    content: { approval_id: "a1", session_id: "s1", tool_call_id: "tc1" },
    eventId: "$req1",
  });
}

function setup(opts: { canApprove?: boolean; sendEvent?: ReturnType<typeof vi.fn> } = {}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, {
    client,
    myUserId: me,
    powerLevels: { [me]: opts.canApprove === false ? 0 : 50 },
  });
  if (opts.canApprove === false) {
    injectStateEvent(
      room,
      mkMatrixEvent({
        roomId,
        sender: "@admin:h.example",
        type: EventType.RoomPowerLevels,
        stateKey: "",
        content: {
          users: { [me]: 0 },
          users_default: 0,
          events_default: 0,
          state_default: 50,
          events: { [ApprovalEventType.Response]: 50 },
        },
      }),
    );
  }
  (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
  (client as unknown as { sendEvent: unknown }).sendEvent =
    opts.sendEvent ?? vi.fn().mockResolvedValue({ event_id: "$r1" });
  MatrixClientPeg.injectClientForTest(client);
  return { client, room };
}

afterEach(() => MatrixClientPeg.reset());

describe("<ApprovalCard />", () => {
  it("renders Allow + Cancel buttons when pending and the user can approve", () => {
    setup();
    render(<ApprovalCard event={makeRequestEvent()} />);
    expect(screen.getByRole("button", { name: /allow/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled();
  });

  it("hides buttons when the user lacks power to send approval_response", () => {
    setup({ canApprove: false });
    render(<ApprovalCard event={makeRequestEvent()} />);
    expect(screen.queryByRole("button", { name: /allow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.getByText(/insufficient permission/i)).toBeInTheDocument();
  });

  it("clicking Allow sends eco.zoon.approval_response and disables buttons during send", async () => {
    let resolveSend: () => void = () => {};
    const sendEvent = vi.fn().mockImplementation(
      () =>
        new Promise<{ event_id: string }>((res) => {
          resolveSend = () => res({ event_id: "$r1" });
        }),
    );
    setup({ sendEvent });
    render(<ApprovalCard event={makeRequestEvent()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /allow/i }));
    expect(screen.getByRole("button", { name: /allow/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    resolveSend();
    await waitFor(() =>
      expect(sendEvent).toHaveBeenCalledWith(roomId, ApprovalEventType.Response, {
        approval_id: "a1",
        decision: "allow",
      }),
    );
  });

  it("renders 'Approved by @bob' when a matching response event arrives", async () => {
    const { room } = setup();
    render(<ApprovalCard event={makeRequestEvent()} />);
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        roomId,
        sender: "@bob:h.example",
        type: ApprovalEventType.Response,
        content: { approval_id: "a1", decision: "allow" },
      }),
    );
    await waitFor(() => expect(screen.getByText(/approved by/i)).toBeInTheDocument());
    expect(screen.getByText(/@bob:h.example/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /allow/i })).not.toBeInTheDocument();
  });

  it("double-click on Allow sends only one event", async () => {
    const sendEvent = vi.fn().mockResolvedValue({ event_id: "$r1" });
    setup({ sendEvent });
    render(<ApprovalCard event={makeRequestEvent()} />);
    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: /allow/i });
    await user.dblClick(btn);
    expect(sendEvent).toHaveBeenCalledTimes(1);
  });
});
