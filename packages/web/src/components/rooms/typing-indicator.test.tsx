import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TypingIndicator } from "./typing-indicator";

afterEach(cleanup);

describe("<TypingIndicator />", () => {
  it("renders nothing when nobody is typing", () => {
    const { container } = render(<TypingIndicator typingUserIds={[]} />);
    expect(container.textContent).toBe("");
  });

  it("renders '<name> is typing…' for one user", () => {
    const { container } = render(<TypingIndicator typingUserIds={["@alice:h.example"]} />);
    expect(container.textContent).toMatch(/alice is typing/i);
  });

  it("renders '<name>, <name> are typing…' for two users", () => {
    const { container } = render(
      <TypingIndicator
        typingUserIds={["@alice:h.example", "@bob:h.example"]}
      />,
    );
    expect(container.textContent).toMatch(/alice/i);
    expect(container.textContent).toMatch(/bob/i);
    expect(container.textContent).toMatch(/are typing/i);
  });

  it("truncates to 2 names + N others for 4 users", () => {
    const { container } = render(
      <TypingIndicator
        typingUserIds={[
          "@alice:h.example",
          "@bob:h.example",
          "@carol:h.example",
          "@dave:h.example",
        ]}
      />,
    );
    expect(container.textContent).toMatch(/alice/i);
    expect(container.textContent).toMatch(/bob/i);
    expect(container.textContent).toMatch(/2 others/i);
    expect(container.textContent).toMatch(/typing/i);
  });
});

describe("TypingIndicator — awaiting input", () => {
  it("shows an agent awaiting input instead of typing", () => {
    render(<TypingIndicator typingUserIds={["@architect.acme:h.example"]} awaitingUserIds={["@architect.acme:h.example"]} />);
    expect(screen.getByText(/is awaiting your input/i)).toBeInTheDocument();
    expect(screen.queryByText(/is typing/i)).not.toBeInTheDocument();
  });
  it("shows both typing and awaiting users", () => {
    render(<TypingIndicator typingUserIds={["@bob:h.example"]} awaitingUserIds={["@architect.acme:h.example"]} />);
    expect(screen.getByText(/is typing/i)).toBeInTheDocument();
    expect(screen.getByText(/is awaiting your input/i)).toBeInTheDocument();
  });
});
