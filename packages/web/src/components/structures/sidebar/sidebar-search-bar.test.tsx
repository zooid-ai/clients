import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { setGlobalSearchEnabled } from "../../../client/feature-flags";
import { SidebarSearchBar } from "./sidebar-search-bar";

function Probe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SidebarSearchBar />
              <Probe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => setGlobalSearchEnabled(true));

describe("SidebarSearchBar", () => {
  it("renders as a link to /search, not a text input", () => {
    setGlobalSearchEnabled(true);
    renderAt("/");
    const link = screen.getByRole("link", { name: /search/i });
    expect(link).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders nothing when global search is off", () => {
    setGlobalSearchEnabled(false);
    renderAt("/");
    expect(screen.queryByRole("link", { name: /search/i })).not.toBeInTheDocument();
  });
});
