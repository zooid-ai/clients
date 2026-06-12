import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomMember } from "matrix-js-sdk";
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
  it("sends m.room.message at room scope when no thread is set", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "hello world{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        roomId,
        null,                              // room mode → no thread
        "m.room.message",
        { msgtype: "m.text", body: "hello world" },
      ),
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

  // --- Mention autocomplete: activeIdx persistence ---
  describe("mention autocomplete activeIdx", () => {
    it("ArrowDown does not snap activeIdx back to 0", async () => {
      const client = makeFakeClient({ userId: me });
      const room = makeRoom(roomId, { client, myUserId: me });
      const aliceMember = new RoomMember(roomId, "@alice:h.example");
      aliceMember.name = "alice";
      const bobMember = new RoomMember(roomId, "@bob:h.example");
      bobMember.name = "bob";
      const roomMembers = [aliceMember, bobMember];
      (room as unknown as { getJoinedMembers: () => RoomMember[] }).getJoinedMembers = () => roomMembers;
      (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
      (client as unknown as { sendEvent: unknown }).sendEvent = vi.fn().mockResolvedValue({ event_id: "$m1" });
      MatrixClientPeg.injectClientForTest(client);
      render(<Composer roomId={roomId} />);
      const user = userEvent.setup();
      const input = screen.getByRole("textbox", { name: /message/i });

      // Open mention autocomplete
      await user.type(input, "@");
      // Press ArrowDown once — should move to index 1
      await user.keyboard("{ArrowDown}");
      // Press ArrowDown again — should move to index 2 (wraps if only 2 entries → 0)
      await user.keyboard("{ArrowDown}");

      // The active item in the listbox should NOT be the first one
      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThan(0);

      // Move to index 1 and confirm Tab inserts the second member, not the first
      await user.keyboard("{ArrowDown}"); // index 0 → 1
      await user.keyboard("{Tab}");
      // Insertion uses the localpart (@bob), not the full mxid — per the
      // displayname-rendering decision so expandMentions stays tokenizable.
      expect((input as HTMLTextAreaElement).value).toMatch(/@bob\b/);
    });
  });

  // --- Slash command autocomplete ---
  describe("slash command autocomplete", () => {
    it("does not show /clear in room mode when / is typed", async () => {
      setup();
      render(<Composer roomId={roomId} />);
      const user = userEvent.setup();
      const input = screen.getByRole("textbox", { name: /message/i });
      await user.type(input, "/");
      // In room mode there are no slash commands — no listbox appears
      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });
});

describe("<Composer /> thread mode", () => {
  it("sends with the thread root when threadRootEventId prop is set", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} threadRootEventId="$root" />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "in-thread{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        roomId,
        "$root",                                // thread mode → root id
        "m.room.message",
        { msgtype: "m.text", body: "in-thread" },
      ),
    );
  });

  it("renders a 'replying to' chrome with an exit affordance", async () => {
    setup();
    render(<Composer roomId={roomId} threadRootEventId="$root" onExitThread={vi.fn()} />);
    expect(screen.getByText(/replying (to|in current thread)/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /exit thread|cancel|close/i })).toBeDefined();
  });

  it("calls onExitThread when the exit affordance is clicked", async () => {
    const onExitThread = vi.fn();
    setup();
    render(<Composer roomId={roomId} threadRootEventId="$root" onExitThread={onExitThread} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /exit thread|cancel|close/i }));
    expect(onExitThread).toHaveBeenCalled();
  });

  it("shows /clear in thread-mode slash autocomplete", async () => {
    setup();
    render(<Composer roomId={roomId} threadRootEventId="$root" />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "/");
    const list = screen.getByRole("listbox");
    expect(list).toBeDefined();
    expect(screen.getByText(/clear/i)).toBeDefined();
  });
});

describe("<Composer /> /clear scope", () => {
  it("/clear in thread mode sends eco.zoon.session_reset with the thread relation", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} threadRootEventId="$root" />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "/clear{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        roomId,
        "$root",
        "eco.zoon.session_reset",
        { "m.relates_to": { rel_type: "m.thread", event_id: "$root" } },
      ),
    );
  });

  it("/clear is not in slash autocomplete in room mode", async () => {
    setup();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "/");
    // No /clear suggestion in room mode.
    expect(screen.queryByText(/^clear$/i)).toBeNull();
  });

  it("/clear typed at room scope falls through as plain text", async () => {
    const { send } = setup();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /message/i });
    await user.type(input, "/clear{Enter}");
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        roomId,
        null,
        "m.room.message",
        { msgtype: "m.text", body: "/clear" },
      ),
    );
  });
});

describe("<Composer /> attachments", () => {
  function setupWithUpload(opts: { uploadResult?: string } = {}) {
    const send = vi.fn().mockResolvedValue({ event_id: "$m1" });
    const uploadContent = vi
      .fn()
      .mockResolvedValue({ content_uri: opts.uploadResult ?? "mxc://hs/up1" });
    const { client } = setup(send);
    (client as unknown as { uploadContent: unknown }).uploadContent = uploadContent;
    return { send, uploadContent };
  }

  function pngFile(bytes: number, name = "shot.png"): File {
    return new File([new Uint8Array(bytes)], name, { type: "image/png" });
  }

  it("rejects files over 0.5 MB with an in-composer error and never uploads", async () => {
    const { uploadContent, send } = setupWithUpload();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText(/attach file/i, { selector: "input" }) as HTMLInputElement;
    await user.upload(input, pngFile(524_289));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/0\.5\s?MB/i),
    );
    expect(uploadContent).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("stages a valid file, then on send uploads and sends m.image before the text event", async () => {
    const { uploadContent, send } = setupWithUpload();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText(/attach file/i, { selector: "input" }), pngFile(1024, "dog.png"));
    expect(screen.getByText("dog.png")).toBeDefined(); // staged chip

    await user.type(screen.getByRole("textbox", { name: /message/i }), "look{Enter}");

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(uploadContent).toHaveBeenCalledOnce();
    const [, , firstType, firstContent] = send.mock.calls[0] as [
      string,
      string | null,
      string,
      Record<string, unknown>,
    ];
    expect(firstType).toBe("m.room.message");
    expect(firstContent).toMatchObject({
      msgtype: "m.image",
      body: "dog.png",
      url: "mxc://hs/up1",
      info: { mimetype: "image/png", size: 1024 },
    });
    const [, , , secondContent] = send.mock.calls[1] as [
      string,
      string | null,
      string,
      Record<string, unknown>,
    ];
    expect(secondContent).toMatchObject({ msgtype: "m.text", body: "look" });
  });

  it("sends a staged attachment even with no text typed", async () => {
    const { send } = setupWithUpload();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText(/attach file/i, { selector: "input" }), pngFile(1024, "dog.png"));
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect((send.mock.calls[0] as [unknown, unknown, unknown, Record<string, unknown>])[3]).toMatchObject({
      msgtype: "m.image",
    });
  });

  it("sends non-image files as m.file", async () => {
    const { send } = setupWithUpload();
    render(<Composer roomId={roomId} />);
    const user = userEvent.setup();
    const pdf = new File([new Uint8Array(2048)], "report.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText(/attach file/i, { selector: "input" }), pdf);
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() =>
      expect(
        (send.mock.calls[0] as [unknown, unknown, unknown, Record<string, unknown>])[3],
      ).toMatchObject({
        msgtype: "m.file",
        body: "report.pdf",
        filename: "report.pdf",
        info: { mimetype: "application/pdf", size: 2048 },
      }),
    );
  });
});
