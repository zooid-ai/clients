import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { Composer } from "./composer";

const me = "@me:h.example";
const roomId = "!r:h.example";

function setup(send: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ event_id: "$m1" })) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
  (client as unknown as { sendEvent: unknown }).sendEvent = send;
  MatrixClientPeg.injectClientForTest(client);
  return { client, send };
}

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
});

describe("<Composer />", () => {
  it("sends m.room.message on Enter", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "hello world{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(roomId, "m.room.message", {
        msgtype: "m.text",
        body: "hello world",
      }),
    );
    expect(input).toHaveValue("");
  });

  it("Shift+Enter inserts a newline instead of sending", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "line1{Shift>}{Enter}{/Shift}line2");
    expect(send).not.toHaveBeenCalled();
    expect((input as HTMLTextAreaElement).value).toBe("line1\nline2");
  });

  it("ignores Enter when the input is empty", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: /message/i }), "{Enter}");
    expect(send).not.toHaveBeenCalled();
  });

  it("disables input + restores on send error", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network"));
    setup(send);
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "hi{Enter}");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/network/i));
    expect(input).not.toBeDisabled();
    expect(input).toHaveValue("hi");
  });
});
