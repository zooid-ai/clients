import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { MatrixClientPeg } from "@/client/peg";
import { clearAuthedMediaCache } from "@/lib/matrix/authed-media";
import { makeFakeClient } from "../../test/factories";
import { mswServer } from "../../test/setup";

// A plain function, not vi.fn(): vi.restoreAllMocks() in afterEach would
// strip the return value off a spy and hand back undefined.
vi.mock("@dicebear/core", () => ({
  createAvatar: () => ({ toDataUri: () => "data:image/svg+xml,mock" }),
}));
vi.mock("@dicebear/collection", () => ({ glass: {} }));

const HS = "https://hs.test";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
  clearAuthedMediaCache();
  vi.restoreAllMocks();
});

// Inject a client whose getUser reports the given mxc avatar.
function injectClientWithAvatar(avatarUrl: string | null) {
  const client = makeFakeClient({ userId: "@me:hs.test" });
  Object.assign(client as unknown as Record<string, unknown>, {
    baseUrl: HS,
    getAccessToken: () => "tok",
    getUser: () => ({ avatarUrl, on: () => {}, off: () => {} }),
  });
  MatrixClientPeg.injectClientForTest(client);
}

// Import AFTER mocks are registered
let UserAvatar: typeof import("./user-avatar").UserAvatar;
beforeEach(async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:avatar");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined as never);
  const mod = await import("./user-avatar");
  UserAvatar = mod.UserAvatar;
});

describe("<UserAvatar />", () => {
  it("renders an img with data URI src", () => {
    render(<UserAvatar userId="@architect.acme:hs.test" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("renders online presence dot", () => {
    render(<UserAvatar userId="@architect.acme:hs.test" presence="online" />);
    const dot = document.querySelector("[data-presence]");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("data-presence")).toBe("online");
  });

  it("renders no dot when presence is omitted", () => {
    render(<UserAvatar userId="@architect.acme:hs.test" />);
    expect(document.querySelector("[data-presence]")).toBeNull();
  });

  it("falls back to the generated avatar when the user has no avatar", () => {
    injectClientWithAvatar(null);
    render(<UserAvatar userId="@me:hs.test" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("fetches the avatar from the authenticated media endpoint", async () => {
    // Regression: the avatar used to be an <img src> pointing at the legacy
    // unauthenticated /_matrix/media/v3 thumbnail, which Matrix 1.11 servers
    // reject outright ("Unauthenticated media is disabled") — so every user
    // rendered as a generated avatar no matter what they had uploaded.
    injectClientWithAvatar("mxc://hs.test/abc");
    let sawAuth = "";
    let sawQuery = "";
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/abc`, ({ request }) => {
        sawAuth = request.headers.get("authorization") ?? "";
        sawQuery = new URL(request.url).search;
        return HttpResponse.arrayBuffer(PNG.buffer, { headers: { "Content-Type": "image/png" } });
      }),
    );
    render(<UserAvatar userId="@me:hs.test" />);
    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("src", "blob:avatar");
    });
    expect(sawAuth).toBe("Bearer tok");
    expect(sawQuery).toContain("method=crop");
  });

  it("falls back to the generated avatar when the media fetch fails", async () => {
    injectClientWithAvatar("mxc://hs.test/gone");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/gone`, () =>
        HttpResponse.json({ errcode: "M_NOT_FOUND" }, { status: 404 }),
      ),
    );
    render(<UserAvatar userId="@me:hs.test" />);
    await waitFor(() => {
      expect(console.warn).toHaveBeenCalled();
    });
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("falls back to the generated avatar if the fetched image fails to render", async () => {
    injectClientWithAvatar("mxc://hs.test/abc");
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/abc`, () =>
        HttpResponse.arrayBuffer(PNG.buffer, { headers: { "Content-Type": "image/png" } }),
      ),
    );
    render(<UserAvatar userId="@me:hs.test" />);
    const img = await screen.findByRole("img");
    await waitFor(() => expect(img).toHaveAttribute("src", "blob:avatar"));
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", "data:image/svg+xml,mock");
  });
});
