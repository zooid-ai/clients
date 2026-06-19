import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageTimestamp } from "./message-timestamp";

describe("<MessageTimestamp>", () => {
  it("renders a relative time in a <time> element with an absolute title", () => {
    const ts = Date.now() - 5 * 60_000;
    render(<MessageTimestamp ts={ts} />);
    const el = screen.getByText("5m ago");
    expect(el.tagName.toLowerCase()).toBe("time");
    expect(el).toHaveAttribute("title");
    expect(el).toHaveAttribute("datetime");
  });
});
