import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorTile } from "./error-tile";
import type { DecodedEcoZoonEvent } from "../../events/eco-zoon";

type ErrorDecoded = Extract<DecodedEcoZoonEvent, { kind: "error" }>;

const baseDecoded: ErrorDecoded = {
  kind: "error",
  sessionId: "sess-1",
  turnId: "turn-1",
  code: "auth_missing",
  message: "Authentication required",
  detail: "claude-agent-acp RequestError on session/prompt",
  transient: false,
  acpError: { code: -32000, message: "Authentication required" },
  recovery: "https://zooid.dev/docs/guides/run-in-container#auth",
};

describe("<ErrorTile />", () => {
  it("renders message as the title and a collapsed detail body", () => {
    render(<ErrorTile decoded={baseDecoded} onRetry={() => {}} />);
    expect(screen.getByText("Authentication required")).toBeInTheDocument();
    const det = screen.getByText(/claude-agent-acp RequestError/i);
    expect(det.closest("details")).not.toBeNull();
    expect(det.closest("details")!.open).toBe(false);
  });

  it("shows Retry button only when transient", () => {
    const { rerender } = render(<ErrorTile decoded={baseDecoded} onRetry={() => {}} />);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();

    rerender(
      <ErrorTile
        decoded={{ ...baseDecoded, transient: true, code: "model_rate_limit" }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("Retry button calls onRetry handler", () => {
    const onRetry = vi.fn();
    render(
      <ErrorTile
        decoded={{ ...baseDecoded, transient: true, code: "model_rate_limit" }}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("Copy details button copies JSON payload to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<ErrorTile decoded={baseDecoded} onRetry={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /copy details/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const arg = writeText.mock.calls[0]![0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({
      code: "auth_missing",
      message: "Authentication required",
      acp_error: { code: -32000 },
    });
  });

  it("Learn more link only shown when recovery URL is present", () => {
    const { rerender } = render(<ErrorTile decoded={baseDecoded} onRetry={() => {}} />);
    expect(screen.getByRole("link", { name: /learn more/i })).toHaveAttribute(
      "href",
      baseDecoded.recovery,
    );

    rerender(<ErrorTile decoded={{ ...baseDecoded, recovery: undefined }} onRetry={() => {}} />);
    expect(screen.queryByRole("link", { name: /learn more/i })).toBeNull();
  });
});
