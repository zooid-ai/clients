import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient } from "../../test/factories";

vi.mock("@dicebear/core", () => ({
  createAvatar: vi.fn().mockReturnValue({ toDataUri: () => "data:image/svg+xml,mock" }),
}));
vi.mock("@dicebear/collection", () => ({ shapes: {} }));

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
});

function injectRoomAvatar(mxc: string | null, httpUrl: string) {
  const client = makeFakeClient({ userId: "@me:h.example" });
  const room = { getMxcAvatarUrl: () => mxc, on: () => {}, off: () => {}, currentState: { on: () => {}, off: () => {} } };
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: () => room,
    mxcUrlToHttp: () => httpUrl,
  });
  MatrixClientPeg.injectClientForTest(client);
}

let RoomAvatar: typeof import("./room-avatar").RoomAvatar;
beforeEach(async () => {
  RoomAvatar = (await import("./room-avatar")).RoomAvatar;
});

describe("<RoomAvatar />", () => {
  it("uses the mxc thumbnail when it resolves", () => {
    injectRoomAvatar("mxc://h.example/abc", "https://h.example/thumb.png");
    render(<RoomAvatar roomId="!r:h.example" name="dev" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://h.example/thumb.png");
  });

  it("falls back to the generated avatar when there is no room avatar", () => {
    injectRoomAvatar(null, "");
    render(<RoomAvatar roomId="!r:h.example" name="dev" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("falls back when mxcUrlToHttp returns '' (invalid mxc)", () => {
    injectRoomAvatar("mxc://h.example/bogus", "");
    render(<RoomAvatar roomId="!r:h.example" name="dev" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml,mock");
  });

  it("degrades to the generated avatar if the thumbnail fails to load", () => {
    injectRoomAvatar("mxc://h.example/abc", "https://h.example/404.png");
    render(<RoomAvatar roomId="!r:h.example" name="dev" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", "data:image/svg+xml,mock");
  });
});
