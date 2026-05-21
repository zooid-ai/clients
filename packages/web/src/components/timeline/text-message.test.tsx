import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeMatrixEvent } from "../../../test/factories";
import { TextMessage } from "./text-message";

// useThreadPreview requires a live MatrixClient; mock it so TextMessage stays a unit test.
vi.mock("@/hooks/use-timeline", () => ({
  useThreadPreview: vi.fn(() => ({ events: [], totalCount: 0 })),
}));

import { useThreadPreview } from "@/hooks/use-timeline";

const rootEvent = () =>
  makeMatrixEvent({
    eventId: "$root",
    roomId: "!r:h.example",
    sender: "@alice:h.example",
    type: "m.room.message",
    content: { msgtype: "m.text", body: "root message" },
  });

afterEach(() => {
  cleanup();
  vi.mocked(useThreadPreview).mockReturnValue({ events: [], totalCount: 0 });
});

describe("<TextMessage /> thread affordance", () => {
  it("shows a 'Reply in thread' control", () => {
    render(<TextMessage event={rootEvent()} onReplyInThread={vi.fn()} />);
    expect(screen.getByRole("button", { name: /reply in thread/i })).toBeDefined();
  });

  it("calls onReplyInThread with the event id when clicked", async () => {
    const onReplyInThread = vi.fn();
    render(<TextMessage event={rootEvent()} onReplyInThread={onReplyInThread} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /reply in thread/i }));
    expect(onReplyInThread).toHaveBeenCalledWith("$root");
  });
});

describe("<TextMessage /> inline thread preview", () => {
  it("renders inline replies when thread has replies", () => {
    const reply = makeMatrixEvent({
      eventId: "$r1",
      roomId: "!r:h.example",
      sender: "@agent:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "agent's reply" },
    });
    vi.mocked(useThreadPreview).mockReturnValue({ events: [reply], totalCount: 1 });
    render(<TextMessage event={rootEvent()} />);
    expect(screen.getByText("agent's reply")).toBeInTheDocument();
  });

  it("shows 'View full history' with count when totalCount > 3", async () => {
    const replies = Array.from({ length: 3 }, (_, i) =>
      makeMatrixEvent({
        eventId: `$r${i}`,
        roomId: "!r:h.example",
        sender: "@agent:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body: `reply ${i}` },
      }),
    );
    vi.mocked(useThreadPreview).mockReturnValue({ events: replies, totalCount: 5 });
    const onViewThread = vi.fn();
    render(<TextMessage event={rootEvent()} onViewThread={onViewThread} />);
    expect(screen.getByRole("button", { name: /view thread/i })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /view thread/i }));
    expect(onViewThread).toHaveBeenCalledWith("$root");
  });

  it("does not show 'View full history' when totalCount <= 3", () => {
    const reply = makeMatrixEvent({
      eventId: "$r1",
      roomId: "!r:h.example",
      sender: "@agent:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "only reply" },
    });
    vi.mocked(useThreadPreview).mockReturnValue({ events: [reply], totalCount: 1 });
    render(<TextMessage event={rootEvent()} />);
    expect(screen.queryByRole("button", { name: /view thread/i })).not.toBeInTheDocument();
  });

  it("shows no preview when thread is empty", () => {
    render(<TextMessage event={rootEvent()} />);
    expect(screen.queryByRole("button", { name: /view thread/i })).not.toBeInTheDocument();
    // Buttons present: bottom "Reply in thread" + top-right toolbar
    // ("add reaction" + "Reply" icon). ReactionsRow renders nothing
    // because there are no reactions seeded.
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});

describe("<TextMessage> formatted_body", () => {
  const makeFormattedEvent = (content: Record<string, unknown>) =>
    makeMatrixEvent({
      eventId: "$fmt",
      roomId: "!r:h.example",
      sender: "@alice:h.example",
      type: "m.room.message",
      content,
    });

  it("renders formatted_body when format is org.matrix.custom.html", () => {
    render(
      <TextMessage
        event={makeFormattedEvent({
          msgtype: "m.text",
          body: "**bold**",
          format: "org.matrix.custom.html",
          formatted_body: "<p><strong>bold</strong></p>",
        })}
      />,
    );
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("falls back to plain body when no formatted_body is set", () => {
    const { container } = render(
      <TextMessage
        event={makeFormattedEvent({ msgtype: "m.text", body: "**still raw**" })}
      />,
    );
    // No <strong> rendered — we did NOT re-parse markdown on the client.
    expect(container.querySelector("strong")).toBeNull();
    expect(screen.getByText("**still raw**")).toBeInTheDocument();
  });

  it("falls back to plain body when format is unknown", () => {
    const { container } = render(
      <TextMessage
        event={makeFormattedEvent({
          msgtype: "m.text",
          body: "plain",
          format: "something.else",
          formatted_body: "<strong>nope</strong>",
        })}
      />,
    );
    expect(container.querySelector("strong")).toBeNull();
    expect(screen.getByText("plain")).toBeInTheDocument();
  });
});

describe("<TextMessage> reactions", () => {
  it("shows a hover-only 'add reaction' button next to 'Reply in thread'", () => {
    render(<TextMessage event={rootEvent()} />);
    expect(screen.getByRole("button", { name: /add reaction/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reply in thread/i })).toBeInTheDocument();
  });

  it("still shows the 'add reaction' button when thread affordances are disabled (ThreadView)", () => {
    render(<TextMessage event={rootEvent()} disableThreadAffordances />);
    expect(screen.getByRole("button", { name: /add reaction/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reply in thread/i })).not.toBeInTheDocument();
  });
});
