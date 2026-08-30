import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mkMatrixEvent } from "../../../test/factories";
import { MessagePanel } from "./message-panel";

const DAY = 86_400_000;

// session_reset events render as a pure SessionDivider in EventTile, so the
// timeline list can be exercised without a Matrix client — only the date-divider
// logic (which keys off getTs) is under test here.
function resetEvent(id: string, ts: number) {
  const ev = mkMatrixEvent({
    eventId: id,
    roomId: "!r:h.example",
    sender: "@a:h.example",
    type: "dev.zooid.session_reset",
    content: {},
  });
  (ev as unknown as { getTs: () => number }).getTs = () => ts;
  return ev;
}

describe("<MessagePanel> date separators", () => {
  it("inserts a day divider at each calendar-day boundary", () => {
    const now = Date.now();
    render(<MessagePanel events={[resetEvent("a", now - DAY), resetEvent("b", now)]} />);
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("does not repeat the divider between same-day messages", () => {
    const now = Date.now();
    render(<MessagePanel events={[resetEvent("a", now - 1000), resetEvent("b", now)]} />);
    expect(screen.getAllByText("Today")).toHaveLength(1);
  });
});

describe("<MessagePanel> history gaps", () => {
  const now = Date.now();
  const events = [resetEvent("a", now - 2000), resetEvent("b", now - 1000), resetEvent("c", now)];

  it("renders no gap marker when there are none", () => {
    render(<MessagePanel events={events} />);
    expect(screen.queryByTestId("timeline-gap")).not.toBeInTheDocument();
  });

  it("renders the marker immediately before the event that follows the hole", () => {
    const { container } = render(
      <MessagePanel events={events} gapBeforeEventIds={["b"]} />,
    );
    const gap = screen.getByTestId("timeline-gap");
    expect(gap).toBeInTheDocument();

    // Position matters: the marker has to sit between the two loaded stretches,
    // not at the top of the panel where "Load more" already lives.
    const items = Array.from(container.querySelectorAll("li"));
    const gapIndex = items.findIndex((li) => li.contains(gap));
    const tileIndex = items.findIndex((li) => li.querySelector('[data-event-id="b"]'));
    expect(gapIndex).toBeGreaterThan(0);
    if (tileIndex >= 0) expect(gapIndex).toBeLessThan(tileIndex);
  });

  it("calls onFillGap with the anchoring event id", async () => {
    const onFillGap = vi.fn();
    render(<MessagePanel events={events} gapBeforeEventIds={["b"]} onFillGap={onFillGap} />);
    await userEvent.click(screen.getByRole("button", { name: /load missing messages/i }));
    expect(onFillGap).toHaveBeenCalledWith("b");
  });

  it("shows a busy, non-clickable marker while that gap is filling", () => {
    render(
      <MessagePanel events={events} gapBeforeEventIds={["b"]} pendingGapId="b" />,
    );
    const btn = screen.getByRole("button", { name: /load missing messages/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/loading/i);
  });

  it("leaves other gaps clickable while one is filling", () => {
    render(
      <MessagePanel events={events} gapBeforeEventIds={["b", "c"]} pendingGapId="b" />,
    );
    const btns = screen.getAllByRole("button", { name: /load missing messages/i });
    expect(btns).toHaveLength(2);
    expect(btns.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(1);
  });
});
