import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffView } from "./diff-view";

describe("DiffView", () => {
  it("renders the file path and +/- lines", () => {
    render(<DiffView diff={{ path: "/repo/auth.ts", oldText: "old\n", newText: "new\n" }} />);
    expect(screen.getByText("auth.ts")).toBeInTheDocument();
    const del = screen.getByText("old");
    const add = screen.getByText("new");
    expect(del.closest("[data-diff-row]")).toHaveAttribute("data-diff-row", "del");
    expect(add.closest("[data-diff-row]")).toHaveAttribute("data-diff-row", "add");
  });
});
