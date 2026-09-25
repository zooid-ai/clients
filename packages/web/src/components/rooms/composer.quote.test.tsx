import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { QUOTE_FIELD, type QuoteRef } from "@/lib/matrix/quote";
import { getQuoteDraft, resetQuoteDrafts, setQuoteDraft } from "@/lib/quote-draft-store";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { Composer } from "./composer";

const me = "@me:h.example";
const roomId = "!r:h.example";
const quote: QuoteRef = {
  room_id: "!src:h.example",
  event_id: "$q",
  thread_id: "$q",
  sender: "@coding:h.example",
  origin_server_ts: Date.UTC(2026, 8, 25, 14, 42),
  snapshot: { msgtype: "m.text", body: "the answer" },
};

function setup() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const send = vi.fn().mockResolvedValue({ event_id: "$m" });
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = () => room;
  cast.sendEvent = send;
  MatrixClientPeg.injectClientForTest(client);
  return { send };
}

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
  resetQuoteDrafts();
});

describe("<Composer /> quote chip", () => {
  it("shows the chip and removes it with ×", async () => {
    setup();
    render(<Composer roomId={roomId} />);
    act(() => setQuoteDraft(roomId, null, { quote, senderName: "Coding" }));
    expect(screen.getByLabelText(/quoted message/i)).toHaveTextContent("the answer");
    await userEvent.setup().click(screen.getByRole("button", { name: /remove quote/i }));
    expect(screen.queryByLabelText(/quoted message/i)).toBeNull();
    expect(getQuoteDraft(roomId, null)).toBeNull();
  });

  it("sends comment + quote at room scope and clears the chip", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    act(() => setQuoteDraft(roomId, null, { quote, senderName: "Coding" }));
    await userEvent.setup().type(screen.getByRole("textbox", { name: /message/i }), "see this{Enter}");
    await waitFor(() => expect(send).toHaveBeenCalled());
    const [r, thread, type, content] = send.mock.calls[0];
    expect([r, thread, type]).toEqual([roomId, null, "m.room.message"]);
    expect(content.body.startsWith("see this\n\n> Coding · 2026-09-25 14:42 UTC · ")).toBe(true);
    expect(content[QUOTE_FIELD]).toEqual(quote);
    expect(getQuoteDraft(roomId, null)).toBeNull();
  });

  it("always sends m.mentions, empty when the comment mentions nobody", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    act(() => setQuoteDraft(roomId, null, { quote, senderName: "Coding" }));
    await userEvent.setup().type(screen.getByRole("textbox", { name: /message/i }), "see this{Enter}");
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][3]["m.mentions"]).toEqual({});
  });

  it("sends a bare quote with an empty comment", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    act(() => setQuoteDraft(roomId, null, { quote, senderName: "Coding" }));
    const sendBtn = screen.getByRole("button", { name: /send message/i });
    expect(sendBtn).not.toBeDisabled();
    await userEvent.setup().click(sendBtn);
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][3].body.startsWith("> Coding · ")).toBe(true);
  });

  it("uses the thread's draft in a thread composer", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} threadRootEventId="$root" />);
    act(() => setQuoteDraft(roomId, null, { quote, senderName: "Room draft" }));
    expect(screen.queryByLabelText(/quoted message/i)).toBeNull();
    act(() => setQuoteDraft(roomId, "$root", { quote, senderName: "Coding" }));
    await userEvent.setup().type(screen.getByRole("textbox", { name: /message/i }), "ok{Enter}");
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1]).toBe("$root");
    expect(send.mock.calls[0][3][QUOTE_FIELD]).toEqual(quote);
  });

  it("does not treat a quoted /command as a slash command", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    act(() => setQuoteDraft(roomId, null, { quote, senderName: "Coding" }));
    await userEvent.setup().type(screen.getByRole("textbox", { name: /message/i }), "/clear{Enter}");
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][2]).toBe("m.room.message");
  });
});
