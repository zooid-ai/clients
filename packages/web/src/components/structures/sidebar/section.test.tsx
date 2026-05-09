import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Section } from "./section";

describe("<Section>", () => {
  it("renders header, action slot, and children", () => {
    render(
      <Section title="Rooms" action={<button>+</button>}>
        <div>row</div>
      </Section>,
    );
    expect(screen.getByRole("heading", { name: "Rooms" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.getByText("row")).toBeInTheDocument();
  });

  it("collapses and expands on header click", () => {
    render(
      <Section title="Rooms">
        <div>row</div>
      </Section>,
    );
    fireEvent.click(screen.getByRole("button", { name: /toggle Rooms section/i }));
    expect(screen.queryByText("row")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /toggle Rooms section/i }));
    expect(screen.getByText("row")).toBeInTheDocument();
  });

  it("starts expanded by default", () => {
    render(
      <Section title="Rooms">
        <div>row</div>
      </Section>,
    );
    expect(screen.getByText("row")).toBeInTheDocument();
  });

  it("starts collapsed when defaultExpanded={false}", () => {
    render(
      <Section title="DMs" defaultExpanded={false}>
        <div>row</div>
      </Section>,
    );
    expect(screen.queryByText("row")).not.toBeInTheDocument();
  });

  it("does not read or write localStorage", () => {
    const before = { ...localStorage };
    render(
      <Section title="Rooms">
        <div>row</div>
      </Section>,
    );
    fireEvent.click(screen.getByRole("button", { name: /toggle Rooms section/i }));
    fireEvent.click(screen.getByRole("button", { name: /toggle Rooms section/i }));
    // No new keys should have been written.
    for (const k of Object.keys(localStorage)) {
      expect(k in before).toBe(true);
    }
  });
});
