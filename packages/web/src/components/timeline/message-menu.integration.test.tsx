import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { MatrixClientPeg } from "@/client/peg";
import { QUOTE_FIELD, type QuoteRef } from "@/lib/matrix/quote";
import { getQuoteDraft, resetQuoteDrafts } from "@/lib/quote-draft-store";
import { makeFakeClient, makeMatrixEvent, makeRoom, pushTimelineEvent } from "../../../test/factories";
import { TextMessage } from "./text-message";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const roomId = "!r:h.example";
const me = "@me:h.example";
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(() => {
  MatrixClientPeg.reset();
  resetQuoteDrafts();
  vi.clearAllMocks();
});

function setup(content: Record<string, unknown>, opts: { sender?: string; eventId?: string } = {}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = () => room;
  cast.sendEvent = vi.fn().mockResolvedValue({ event_id: "$new" });
  MatrixClientPeg.injectClientForTest(client);
  const event = makeMatrixEvent({
    eventId: opts.eventId ?? "$m1",
    roomId,
    sender: opts.sender ?? "@coding:h.example",
    type: "m.room.message",
    content,
  });
  pushTimelineEvent(room, event);
  return { client: cast, room, event };
}

async function openMenu() {
  const user = userEvent.setup();
  // userEvent.setup() installs its own clipboard stub; put ours back on top.
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  await user.click(screen.getByRole("button", { name: /more actions/i }));
  return user;
}

describe("message hover bar", () => {
  it("shows React, Reply, Share and More; Edit/Delete are no longer bar buttons", () => {
    const { event } = setup({ msgtype: "m.text", body: "hi" }, { sender: me });
    render(<TextMessage event={event} />);
    expect(screen.getByRole("button", { name: /^reply$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit message/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete message/i })).toBeNull();
  });

  it("labels Share as Share thread on a root with replies", () => {
    const { event } = setup({ msgtype: "m.text", body: "root" });
    (event as unknown as { getUnsigned: () => unknown }).getUnsigned = () => ({
      "m.relations": { "m.thread": { count: 3 } },
    });
    render(<TextMessage event={event} />);
    expect(screen.getByRole("button", { name: /share thread/i })).toBeInTheDocument();
  });
});

describe("⋯ menu", () => {
  it("lists Copy link, Copy text, Quote, and Edit/Delete only when allowed", async () => {
    const { event } = setup({ msgtype: "m.text", body: "hi" }, { sender: "@alice:h.example" });
    render(<TextMessage event={event} />);
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /copy text/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^quote$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^edit$/i })).toBeNull();
  });

  it("Copy link copies the thread URL and toasts", async () => {
    const { event } = setup(
      { msgtype: "m.text", body: "re", "m.relates_to": { rel_type: "m.thread", event_id: "$root" } },
      { eventId: "$reply" },
    );
    render(<TextMessage event={event} disableThreadAffordances />);
    const user = await openMenu();
    await user.click(await screen.findByRole("menuitem", { name: /copy link/i }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/room/!r%3Ah.example?thread=%24root&event=%24reply`,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  it("Copy text copies the plain body", async () => {
    const { event } = setup({ msgtype: "m.text", body: "copy me" });
    render(<TextMessage event={event} />);
    const user = await openMenu();
    await user.click(await screen.findByRole("menuitem", { name: /copy text/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("copy me"));
  });

  it("Quote in the room timeline drafts into the room composer", async () => {
    const { event } = setup({ msgtype: "m.text", body: "quote me" });
    render(<TextMessage event={event} />);
    const user = await openMenu();
    await user.click(await screen.findByRole("menuitem", { name: /^quote$/i }));
    const draft = getQuoteDraft(roomId, null);
    expect(draft?.quote).toMatchObject({ event_id: "$m1", thread_id: "$m1", snapshot: { body: "quote me" } });
    expect(draft?.senderName).toBeTruthy();
  });

  it("Quote inside a thread drafts into that thread's composer", async () => {
    const { event } = setup(
      { msgtype: "m.text", body: "re", "m.relates_to": { rel_type: "m.thread", event_id: "$root" } },
      { eventId: "$reply" },
    );
    render(<TextMessage event={event} disableThreadAffordances />);
    const user = await openMenu();
    await user.click(await screen.findByRole("menuitem", { name: /^quote$/i }));
    expect(getQuoteDraft(roomId, "$root")?.quote.event_id).toBe("$reply");
    expect(getQuoteDraft(roomId, null)).toBeNull();
  });
});

describe("quote messages", () => {
  const quote: QuoteRef = {
    room_id: "!src:h.example",
    event_id: "$q",
    thread_id: "$q",
    sender: "@coding:h.example",
    origin_server_ts: Date.UTC(2026, 8, 25, 14, 42),
    snapshot: { msgtype: "m.text", body: "the quoted answer" },
  };
  const fallback = "> Coding · 2026-09-25 14:42 UTC · link\n> the quoted answer";

  it("renders the comment and a card, not the raw fallback", () => {
    const { event } = setup({ msgtype: "m.text", body: `my take\n\n${fallback}`, [QUOTE_FIELD]: quote });
    render(<TextMessage event={event} />);
    expect(screen.getByText("my take")).toBeInTheDocument();
    const card = screen.getByRole("link", { name: /quoted message/i });
    expect(within(card).getByText("the quoted answer")).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-25 14:42 UTC/)).toBeNull();
  });

  it("editing a quote edits the comment and keeps the fallback", async () => {
    const { client, event } = setup(
      { msgtype: "m.text", body: `my take\n\n${fallback}`, [QUOTE_FIELD]: quote },
      { sender: me },
    );
    render(<TextMessage event={event} />);
    const user = await openMenu();
    await user.click(await screen.findByRole("menuitem", { name: /^edit$/i }));
    const box = screen.getByRole("textbox", { name: /edit message/i });
    expect(box).toHaveValue("my take");
    await user.clear(box);
    await user.type(box, "better take{Enter}");
    await waitFor(() => expect(client.sendEvent).toHaveBeenCalled());
    const content = (client.sendEvent as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(content["m.new_content"]).toEqual({ msgtype: "m.text", body: `better take\n\n${fallback}` });
  });
});
