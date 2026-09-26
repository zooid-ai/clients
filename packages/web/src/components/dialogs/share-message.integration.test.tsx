import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomMember } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { MatrixClientPeg } from "@/client/peg";
import { QUOTE_FIELD, type QuoteRef } from "@/lib/matrix/quote";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { ShareMessageDialog } from "./share-message";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const me = "@me:h.example";
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
  const add = (id: string, name: string, membership = "join", members: Record<string, string> = {}) => {
    const r = makeRoom(id, { client, myUserId: me });
    r.name = name;
    const joined = Object.entries(members).map(([userId, display]) => {
      const m = new RoomMember(id, userId);
      m.name = display;
      return m;
    });
    (r as unknown as { getJoinedMembers: () => RoomMember[] }).getJoinedMembers = () => joined;
    r.updateMyMembership(membership);
    (client as unknown as { addRoom(x: unknown): void }).addRoom(r);
  };
  add("!src:h.example", "product", "join", { "@srconly:h.example": "srconly", "@coding:h.example": "coding" });
  add("!backend:h.example", "backend", "join", { "@coding:h.example": "coding", "@alice:h.example": "alice" });
  add("!gone:h.example", "left-room", "leave");
  const send = vi.fn().mockResolvedValue({ event_id: "$s" });
  (client as unknown as Record<string, unknown>).sendEvent = send;
  MatrixClientPeg.injectClientForTest(client);
  return { send };
}

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
  vi.clearAllMocks();
});

const renderDialog = (onOpenChange = () => {}) =>
  render(
    <ShareMessageDialog open onOpenChange={onOpenChange} title="Share message" draft={{ quote, senderName: "Coding" }} />,
  );

async function pickBackend(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("combobox", { name: /search rooms/i }), "back");
  await user.click(await screen.findByRole("option", { name: "backend" }));
}

describe("<ShareMessageDialog />", () => {
  it("opens with a single search field and no room list", () => {
    setup();
    renderDialog();
    expect(screen.getByRole("combobox", { name: /search rooms and dms/i })).toBeInTheDocument();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("filters joined rooms as you type, and leaves rooms you've left out", async () => {
    setup();
    renderDialog();
    const user = userEvent.setup();
    const search = screen.getByRole("combobox", { name: /search rooms/i });
    await user.type(search, "b");
    expect(await screen.findByRole("option", { name: "backend" })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "e");
    expect(screen.queryByRole("option", { name: "left-room" })).toBeNull();
    expect(screen.getByRole("option", { name: "backend" })).toBeInTheDocument();
  });

  it("picks with the keyboard, shows a chip, and × clears it", async () => {
    setup();
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox", { name: /search rooms/i }), "back");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("combobox", { name: /search rooms/i })).toBeNull();
    expect(screen.getByText("backend")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear backend/i }));
    expect(screen.getByRole("combobox", { name: /search rooms/i })).toHaveValue("");
  });

  it("closes the dropdown on Escape without closing the dialog", async () => {
    setup();
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox", { name: /search rooms/i }), "back");
    expect(await screen.findByRole("option", { name: "backend" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option", { name: "backend" })).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("previews the card and keeps the comment and Send disabled until a room is picked", () => {
    setup();
    renderDialog();
    expect(screen.getByText("the answer")).toBeInTheDocument();
    const comment = screen.getByRole("textbox", { name: /comment/i });
    expect(comment).toBeDisabled();
    expect(comment).toHaveAttribute("placeholder", "Pick a room first");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
  });

  it("has no slash-command or attachment UI", async () => {
    setup();
    renderDialog();
    const user = userEvent.setup();
    await pickBackend(user);
    await user.type(screen.getByRole("textbox", { name: /comment/i }), "/");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByLabelText(/attach file/i)).toBeNull();
  });

  it("sends a top-level quote with the comment, toasts, and closes", async () => {
    const { send } = setup();
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    const user = userEvent.setup();
    await pickBackend(user);
    await user.type(screen.getByRole("textbox", { name: /comment/i }), "fyi");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    const [roomId, thread, type, content] = send.mock.calls[0];
    expect([roomId, thread, type]).toEqual(["!backend:h.example", null, "m.room.message"]);
    expect(content.body.startsWith("fyi\n\n> Coding · ")).toBe(true);
    expect(content[QUOTE_FIELD]).toEqual(quote);
    // Empty, not absent: receivers must not scan the quoted text for mentions.
    expect(content["m.mentions"]).toEqual({});
    expect(toast.success).toHaveBeenCalledWith(
      "Shared to backend",
      expect.objectContaining({ action: expect.objectContaining({ label: "View" }) }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("suggests the target room's members, not the source room's", async () => {
    setup();
    renderDialog();
    const user = userEvent.setup();
    await pickBackend(user);
    await user.type(screen.getByRole("textbox", { name: /comment/i }), "cc @");
    const list = await screen.findByRole("listbox", { name: /mention suggestions/i });
    expect(list).toHaveTextContent("alice");
    expect(list).toHaveTextContent("coding");
    expect(list).not.toHaveTextContent("srconly");
  });

  it("puts each mention in m.mentions.user_ids and sends on Enter", async () => {
    const { send } = setup();
    renderDialog();
    const user = userEvent.setup();
    await pickBackend(user);
    const comment = screen.getByRole("textbox", { name: /comment/i });
    await user.type(comment, "cc @ali");
    await user.keyboard("{Enter}");
    expect(send).not.toHaveBeenCalled(); // Enter picked the suggestion
    await user.type(comment, "look");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(send).toHaveBeenCalled());
    const content = send.mock.calls[0][3];
    expect(content.body.startsWith("cc @alice:h.example look\n\n> Coding · ")).toBe(true);
    expect(content["m.mentions"]).toEqual({ user_ids: ["@alice:h.example"] });
  });

  it("adds a newline on Shift+Enter instead of sending", async () => {
    const { send } = setup();
    renderDialog();
    const user = userEvent.setup();
    await pickBackend(user);
    const comment = screen.getByRole("textbox", { name: /comment/i });
    await user.type(comment, "one{Shift>}{Enter}{/Shift}two");
    expect(send).not.toHaveBeenCalled();
    expect(comment).toHaveValue("one\ntwo");
  });

  it("sends once on a double Enter and keeps the comment until the send resolves", async () => {
    const { send } = setup();
    let resolve!: (v: { event_id: string }) => void;
    send.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    renderDialog();
    const user = userEvent.setup();
    await pickBackend(user);
    const comment = screen.getByRole("textbox", { name: /comment/i });
    await user.type(comment, "fyi");
    await user.keyboard("{Enter}{Enter}");
    expect(send).toHaveBeenCalledTimes(1);
    expect(comment).toHaveValue("fyi");
    resolve({ event_id: "$s" });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("shows the error, keeps the comment and stays open when sending fails", async () => {
    const { send } = setup();
    send.mockRejectedValueOnce(new Error("forbidden"));
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    const user = userEvent.setup();
    await pickBackend(user);
    await user.type(screen.getByRole("textbox", { name: /comment/i }), "fyi");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("forbidden");
    expect(screen.getByRole("textbox", { name: /comment/i })).toHaveValue("fyi");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
