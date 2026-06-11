import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import {
  makeFakeClient,
  makeMatrixEvent,
  makeRoom,
  pushTimelineEvent,
} from "../../../test/factories";
import { TextMessage } from "./text-message";

const roomId = "!r:h.example";
const me = "@me:h.example";

afterEach(() => MatrixClientPeg.reset());

function setup(opts: { sender?: string } = {}) {
  const sender = opts.sender ?? me;
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = () => room;
  cast.sendEvent = vi.fn().mockResolvedValue({ event_id: "$new" });
  cast.redactEvent = vi.fn().mockResolvedValue({ event_id: "$redaction" });
  MatrixClientPeg.injectClientForTest(client);
  const event = makeMatrixEvent({
    eventId: "$m1",
    roomId,
    sender,
    type: "m.room.message",
    content: { msgtype: "m.text", body: "helo wrold" },
  });
  pushTimelineEvent(room, event);
  return { client: cast, room, event };
}

describe("message edit", () => {
  it("shows an Edit action on own messages and sends an m.replace on save", async () => {
    const { client, event } = setup();
    render(<TextMessage event={event} />);

    fireEvent.click(screen.getByRole("button", { name: /edit message/i }));
    const textarea = screen.getByRole("textbox", { name: /edit message/i });
    fireEvent.change(textarea, { target: { value: "hello world" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => expect(client.sendEvent).toHaveBeenCalled());
    const [calledRoomId, threadId, type, content] = (
      client.sendEvent as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(calledRoomId).toBe(roomId);
    expect(threadId).toBeNull();
    expect(type).toBe("m.room.message");
    expect(content).toMatchObject({
      msgtype: "m.text",
      body: "* hello world",
      "m.new_content": { msgtype: "m.text", body: "hello world" },
      "m.relates_to": { rel_type: "m.replace", event_id: "$m1" },
    });
  });

  it("does not offer Edit on someone else's message", () => {
    const { event } = setup({ sender: "@alice:h.example" });
    render(<TextMessage event={event} />);
    expect(screen.queryByRole("button", { name: /edit message/i })).toBeNull();
  });

  it("renders the latest edit with an (edited) marker", () => {
    const { room, event } = setup({ sender: "@alice:h.example" });
    pushTimelineEvent(
      room,
      makeMatrixEvent({
        eventId: "$e1",
        roomId,
        sender: "@alice:h.example",
        type: "m.room.message",
        content: {
          msgtype: "m.text",
          body: "* hello world",
          "m.new_content": { msgtype: "m.text", body: "hello world" },
          "m.relates_to": { rel_type: "m.replace", event_id: "$m1" },
        },
      }),
    );
    render(<TextMessage event={event} />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.getByText(/\(edited\)/i)).toBeInTheDocument();
  });
});

describe("message delete", () => {
  it("redacts own message after confirm", async () => {
    const { client, event } = setup();
    render(<TextMessage event={event} />);

    fireEvent.click(screen.getByRole("button", { name: /delete message/i }));
    // shadcn AlertDialog confirm action
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(client.redactEvent).toHaveBeenCalledWith(roomId, "$m1"),
    );
  });

  it("renders a tombstone for redacted events", () => {
    const { event } = setup({ sender: "@alice:h.example" });
    (event as unknown as { isRedacted: () => boolean }).isRedacted = () => true;
    render(<TextMessage event={event} />);
    expect(screen.getByText(/message deleted/i)).toBeInTheDocument();
  });
});
