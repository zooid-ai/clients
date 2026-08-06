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
vi.mock("@dicebear/collection", () => ({ shapes: {} }));

const HS = "https://hs.test";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
  clearAuthedMediaCache();
  vi.restoreAllMocks();
});

function injectRoomAvatar(mxc: string | null) {
  const client = makeFakeClient({ userId: "@me:hs.test" });
  const room = {
    getMxcAvatarUrl: () => mxc,
    on: () => {},
    off: () => {},
    currentState: { on: () => {}, off: () => {} },
  };
  Object.assign(client as unknown as Record<string, unknown>, {
    baseUrl: HS,
    getAccessToken: () => "tok",
    getRoom: () => room,
  });
  MatrixClientPeg.injectClientForTest(client);
}

let RoomAvatar: typeof import("./room-avatar").RoomAvatar;
beforeEach(async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:room-avatar");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined as never);
  RoomAvatar = (await import("./room-avatar")).RoomAvatar;
});

describe("<RoomAvatar />", () => {
  it("fetches the room avatar from the authenticated media endpoint", async () => {
    injectRoomAvatar("mxc://hs.test/abc");
    let sawAuth = "";
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/abc`, ({ request }) => {
        sawAuth = request.headers.get("authorization") ?? "";
        return HttpResponse.arrayBuffer(PNG.buffer, { headers: { "Content-Type": "image/png" } });
      }),
    );
    render(<RoomAvatar roomId="!r:hs.test" name="dev" />);
    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("src", "blob:room-avatar");
    });
    expect(sawAuth).toBe("Bearer tok");
  });

  it("falls back to the generated avatar when there is no room avatar", () => {
    injectRoomAvatar(null);
    render(<RoomAvatar roomId="!r:hs.test" name="dev" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("falls back to the generated avatar when the media fetch fails", async () => {
    injectRoomAvatar("mxc://hs.test/gone");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/gone`, () =>
        HttpResponse.json({ errcode: "M_FORBIDDEN" }, { status: 403 }),
      ),
    );
    render(<RoomAvatar roomId="!r:hs.test" name="dev" />);
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("degrades to the generated avatar if the thumbnail fails to load", async () => {
    injectRoomAvatar("mxc://hs.test/abc");
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/abc`, () =>
        HttpResponse.arrayBuffer(PNG.buffer, { headers: { "Content-Type": "image/png" } }),
      ),
    );
    render(<RoomAvatar roomId="!r:hs.test" name="dev" />);
    const img = screen.getByRole("img");
    await waitFor(() => expect(img).toHaveAttribute("src", "blob:room-avatar"));
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", "data:image/svg+xml,mock");
  });
});
