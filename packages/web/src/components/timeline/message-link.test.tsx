import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MessageLink } from "./message-link";

function Probe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

const internal = `${window.location.origin}/room/!r:h.example?thread=$root`;

describe("<MessageLink />", () => {
  it("routes a thread link in-app", async () => {
    render(
      <MemoryRouter initialEntries={["/room/!other:h.example"]}>
        <Routes>
          <Route path="*" element={<><MessageLink href={internal}>link</MessageLink><Probe /></>} />
        </Routes>
      </MemoryRouter>,
    );
    const a = screen.getByRole("link", { name: "link" });
    expect(a).not.toHaveAttribute("target");
    await userEvent.setup().click(a);
    expect(screen.getByTestId("loc")).toHaveTextContent("/room/!r%3Ah.example?thread=%24root");
  });

  it("routes a matrix.to permalink in-app", () => {
    render(
      <MemoryRouter>
        <MessageLink href="https://matrix.to/#/!r:h.example/$ev">p</MessageLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "p" })).toHaveAttribute(
      "href",
      "/room/!r%3Ah.example?thread=%24ev",
    );
  });

  it("opens other links in a new tab", () => {
    render(<MessageLink href="https://example.com/x">ext</MessageLink>);
    const a = screen.getByRole("link", { name: "ext" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("href", "https://example.com/x");
  });

  it("renders without a router (bare TextMessage tests)", () => {
    render(<MessageLink href={internal}>bare</MessageLink>);
    expect(screen.getByRole("link", { name: "bare" })).toHaveAttribute(
      "href",
      "/room/!r%3Ah.example?thread=%24root",
    );
  });
});
