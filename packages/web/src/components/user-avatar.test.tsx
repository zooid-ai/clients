import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient } from "../../test/factories";

vi.mock("@dicebear/core", () => ({
  createAvatar: vi.fn().mockReturnValue({ toDataUri: () => "data:image/svg+xml,mock" }),
}));
vi.mock("@dicebear/collection", () => ({ glass: {} }));

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
});

// Inject a client whose getUser returns the given avatarUrl and whose
// mxcUrlToHttp yields `httpUrl` (matrix-js-sdk returns "" for invalid mxc).
function injectClientWithAvatar(avatarUrl: string | null, httpUrl: string) {
  const client = makeFakeClient({ userId: "@me:h.example" });
  const cast = client as unknown as Record<string, unknown>;
  cast.getUser = () => ({ avatarUrl, on: () => {}, off: () => {} });
  cast.mxcUrlToHttp = () => httpUrl;
  MatrixClientPeg.injectClientForTest(client);
}

// Import AFTER mocks are registered
let UserAvatar: typeof import("./user-avatar").UserAvatar;
beforeEach(async () => {
  const mod = await import("./user-avatar");
  UserAvatar = mod.UserAvatar;
});

describe("<UserAvatar />", () => {
  it("renders an img with data URI src", () => {
    render(<UserAvatar userId="@architect.acme:h.example" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("renders online presence dot", () => {
    render(<UserAvatar userId="@architect.acme:h.example" presence="online" />);
    const dot = document.querySelector("[data-presence]");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("data-presence")).toBe("online");
  });

  it("renders no dot when presence is omitted", () => {
    render(<UserAvatar userId="@architect.acme:h.example" />);
    expect(document.querySelector("[data-presence]")).toBeNull();
  });

  it("falls back to the generated avatar when mxcUrlToHttp returns '' (invalid/empty mxc)", () => {
    // Regression: `?? null` / `?? fallback` leaked the empty string, rendering
    // <img src=""> → Chrome's broken-image icon for avatar-less users.
    injectClientWithAvatar("mxc://h.example/bogus", "");
    render(<UserAvatar userId="@me:h.example" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("uses the mxc thumbnail when it resolves", () => {
    injectClientWithAvatar("mxc://h.example/abc", "https://h.example/thumb.png");
    render(<UserAvatar userId="@me:h.example" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://h.example/thumb.png");
  });

  it("falls back to the generated avatar if the mxc thumbnail fails to load", () => {
    injectClientWithAvatar("mxc://h.example/abc", "https://h.example/404.png");
    render(<UserAvatar userId="@me:h.example" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://h.example/404.png");
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", "data:image/svg+xml,mock");
  });
});
