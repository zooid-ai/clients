import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventStatus, MatrixError, MatrixEvent, type Room } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { useTimeline } from "@/hooks/use-timeline";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { MessagePanel } from "../structures/message-panel";
import { Composer } from "./composer";

const roomId = "!r:h.example";
const me = "@me:h.example";
const TXN = "txn-1";

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
});

function Harness({ thread }: { thread?: string }) {
  const { events } = useTimeline(roomId);
  return (
    <>
      <MessagePanel events={events} />
      <Composer roomId={roomId} threadRootEventId={thread} />
    </>
  );
}

/** Mimics what client.sendEvent does: add a local echo, then reject and mark it NOT_SENT. */
function rejectingSendEvent(room: Room, error: Error) {
  return vi.fn(async (_roomId: string, _thread: string | null, type: string, content: object) => {
    const echo = new MatrixEvent({
      type,
      content,
      sender: me,
      room_id: roomId,
      event_id: `~${roomId}:${TXN}`,
      origin_server_ts: Date.now(),
    });
    echo.setTxnId(TXN);
    echo.setStatus(EventStatus.SENDING);
    room.addPendingEvent(echo, TXN);
    echo.error = error as MatrixError;
    room.updatePendingEvent(echo, EventStatus.NOT_SENT);
    throw error;
  });
}

function setup(error: Error) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = () => room;
  cast.sendEvent = rejectingSendEvent(room, error);
  cast.resendEvent = vi.fn().mockResolvedValue({ event_id: "$sent" });
  cast.cancelPendingEvent = vi.fn();
  MatrixClientPeg.injectClientForTest(client);
  return { cast, room };
}

const forbidden = () =>
  new MatrixError(
    { errcode: "M_FORBIDDEN", error: "Auth check failed: sender's membership 'invite' is not 'join'" },
    403,
  );

async function sendHello() {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: /message/i }), "@agent hello{Enter}");
  return user;
}

describe("a send the server rejects", () => {
  it("shows the failed tile with Retry and no raw MatrixError under the composer", async () => {
    setup(forbidden());
    render(<Harness />);
    await sendHello();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Not sent")).toBeInTheDocument();
    expect(within(alert).getByText(/not a member of this room yet/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    // the message text stays on the tile, and nothing renders it as delivered
    expect(screen.getByText(/hello/)).toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
    // the composer cleared and carries no raw error line
    expect(screen.getByRole("textbox", { name: /message/i })).toHaveValue("");
    expect(screen.queryByText(/MatrixError|M_FORBIDDEN|Auth check failed/)).toBeNull();
  });

  it("Retry resends the same event, so the txnId is reused", async () => {
    const { cast, room } = setup(forbidden());
    render(<Harness />);
    const user = await sendHello();

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    const echo = room.getLiveTimeline().getEvents()[0];
    expect(echo.getAssociatedStatus() ?? echo.status).toBe(EventStatus.NOT_SENT);
    expect(cast.resendEvent).toHaveBeenCalledTimes(1);
    const [event, inRoom] = (cast.resendEvent as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(event).toBe(echo);
    expect(event.getTxnId()).toBe(TXN);
    expect(inRoom).toBe(room);
    expect(cast.sendEvent).toHaveBeenCalledTimes(1);
  });

  it("Delete cancels the pending event", async () => {
    const { cast, room } = setup(forbidden());
    render(<Harness />);
    const user = await sendHello();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(cast.cancelPendingEvent).toHaveBeenCalledWith(room.getLiveTimeline().getEvents()[0]);
  });

  it("repaints the tile when the echo goes back to sending", async () => {
    const { room } = setup(forbidden());
    render(<Harness />);
    await sendHello();
    await screen.findByRole("alert");

    room.updatePendingEvent(room.getLiveTimeline().getEvents()[0], EventStatus.SENDING);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByText("Sending…")).toBeInTheDocument();
  });

  it("keeps the composer error for a custom event, which has no tile to show it", async () => {
    const { cast } = setup(forbidden());
    render(<Harness thread="$root" />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: /message/i }), "/clear{Enter}");

    expect(await screen.findByText(/MatrixError: \[403\]/)).toBeInTheDocument();
    expect(screen.queryByText("Not sent")).toBeNull();
    expect(cast.cancelPendingEvent).toHaveBeenCalledTimes(1);
  });
});
