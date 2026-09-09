import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TruncatedBody } from "./truncated-body";

/** jsdom reports 0 for both by default; stub them to simulate real layout. */
function mockHeights(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(clientHeight);
}

describe("<TruncatedBody>", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders short content with no toggle", () => {
    mockHeights(40, 40);
    render(
      <TruncatedBody>
        <p>short message</p>
      </TruncatedBody>,
    );
    expect(screen.getByText("short message")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a 'See more' toggle when content overflows the clamp", () => {
    mockHeights(400, 120);
    render(
      <TruncatedBody>
        <p>a very long message</p>
      </TruncatedBody>,
    );
    expect(screen.getByRole("button", { name: "See more" })).toBeDefined();
  });

  it("expands to full height and back on toggle click", () => {
    mockHeights(400, 120);
    render(
      <TruncatedBody>
        <p>a very long message</p>
      </TruncatedBody>,
    );
    const toggle = screen.getByRole("button", { name: "See more" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "See less" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "See less" }));
    expect(screen.getByRole("button", { name: "See more" })).toBeDefined();
  });
});
