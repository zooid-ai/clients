import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
