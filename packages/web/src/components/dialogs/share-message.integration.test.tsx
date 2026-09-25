import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  const add = (id: string, name: string, membership = "join") => {
    const r = makeRoom(id, { client, myUserId: me });
    r.name = name;
    r.updateMyMembership(membership);
    (client as unknown as { addRoom(x: unknown): void }).addRoom(r);
  };
  add("!src:h.example", "product");
  add("!backend:h.example", "backend");
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

describe("<ShareMessageDialog />", () => {
  it("lists joined rooms only, filtered by search", async () => {
    setup();
    render(
      <ShareMessageDialog open onOpenChange={() => {}} title="Share message" draft={{ quote, senderName: "Coding" }} />,
    );
    expect(screen.getByRole("option", { name: "backend" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "product" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "left-room" })).toBeNull();
    await userEvent.setup().type(screen.getByRole("textbox", { name: /search rooms/i }), "back");
    expect(screen.queryByRole("option", { name: "product" })).toBeNull();
  });

  it("previews the card and keeps Send disabled until a room is picked", () => {
    setup();
    render(
      <ShareMessageDialog open onOpenChange={() => {}} title="Share message" draft={{ quote, senderName: "Coding" }} />,
    );
    expect(screen.getByText("the answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
  });

  it("sends a top-level quote with the comment, toasts, and closes", async () => {
    const { send } = setup();
    const onOpenChange = vi.fn();
    render(
      <ShareMessageDialog open onOpenChange={onOpenChange} title="Share message" draft={{ quote, senderName: "Coding" }} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "backend" }));
    await user.type(screen.getByRole("textbox", { name: /comment/i }), "fyi");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    const [roomId, thread, type, content] = send.mock.calls[0];
    expect([roomId, thread, type]).toEqual(["!backend:h.example", null, "m.room.message"]);
    expect(content.body.startsWith("fyi\n\n> Coding · ")).toBe(true);
    expect(content[QUOTE_FIELD]).toEqual(quote);
    expect(toast.success).toHaveBeenCalledWith(
      "Shared to backend",
      expect.objectContaining({ action: expect.objectContaining({ label: "View" }) }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the error and stays open when sending fails", async () => {
    const { send } = setup();
    send.mockRejectedValueOnce(new Error("forbidden"));
    const onOpenChange = vi.fn();
    render(
      <ShareMessageDialog open onOpenChange={onOpenChange} title="Share message" draft={{ quote, senderName: "Coding" }} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "backend" }));
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("forbidden");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
