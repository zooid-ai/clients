import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Section } from "./section";

describe("<Section>", () => {
  it("renders header, action slot, and children", () => {
    render(
      <Section title="Rooms" id="rooms" action={<button>+</button>}>
        <div>row</div>
      </Section>,
    );
    expect(screen.getByRole("heading", { name: "Rooms" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.getByText("row")).toBeInTheDocument();
  });

  it("collapses and expands on header click; persists state in localStorage", () => {
    localStorage.removeItem("zoon.sidebar.section.rooms");
    render(
      <Section title="Rooms" id="rooms">
        <div>row</div>
      </Section>,
    );
    fireEvent.click(screen.getByRole("button", { name: /toggle Rooms section/i }));
    expect(screen.queryByText("row")).not.toBeInTheDocument();
    expect(localStorage.getItem("zoon.sidebar.section.rooms")).toBe("collapsed");
    fireEvent.click(screen.getByRole("button", { name: /toggle Rooms section/i }));
    expect(screen.getByText("row")).toBeInTheDocument();
    expect(localStorage.getItem("zoon.sidebar.section.rooms")).toBe("expanded");
  });
});
