import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useActiveSpaceId } from "./use-active-space-id";

const me = "@me:h.example";
afterEach(() => MatrixClientPeg.reset());

function clientWithAlias(alias: string, roomId: string | null, alreadyJoined: boolean) {
  const client = makeFakeClient({ userId: me });
  const space = roomId ? makeRoom(roomId, { client, myUserId: me }) : null;
  (client as unknown as { getRoomIdForAlias: (a: string) => Promise<{ room_id: string } | null> }).getRoomIdForAlias =
    async (a) => (a === alias && roomId ? { room_id: roomId } : null);
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    alreadyJoined && roomId && id === roomId ? space : null;
  (client as unknown as { joinRoom: (id: string) => Promise<unknown> }).joinRoom = vi.fn(async () => space);
  MatrixClientPeg.injectClientForTest(client);
  return client;
}

describe("useActiveSpaceId", () => {
  it("returns null when alias does not resolve", async () => {
    clientWithAlias("#dev:h.example", null, false);
    const { result } = renderHook(() => useActiveSpaceId("dev", "h.example"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.spaceId).toBeNull();
  });

  it("returns the room ID without joining when already a member", async () => {
    const client = clientWithAlias("#dev:h.example", "!s:h.example", true);
    const { result } = renderHook(() => useActiveSpaceId("dev", "h.example"));
    await waitFor(() => expect(result.current.spaceId).toBe("!s:h.example"));
    expect(
      (client as unknown as { joinRoom: ReturnType<typeof vi.fn> }).joinRoom,
    ).not.toHaveBeenCalled();
  });

  it("joins the alias if not already a member", async () => {
    const client = clientWithAlias("#dev:h.example", "!s:h.example", false);
    const { result } = renderHook(() => useActiveSpaceId("dev", "h.example"));
    await waitFor(() => expect(result.current.spaceId).toBe("!s:h.example"));
    expect(
      (client as unknown as { joinRoom: ReturnType<typeof vi.fn> }).joinRoom,
    ).toHaveBeenCalledWith("#dev:h.example");
  });

  it("resolves a custom localpart", async () => {
    clientWithAlias("#acme:h.example", "!acme:h.example", true);
    const { result } = renderHook(() => useActiveSpaceId("acme", "h.example"));
    await waitFor(() => expect(result.current.spaceId).toBe("!acme:h.example"));
  });

  it("is ready with no space, without any lookup, for an invalid localpart", async () => {
    const client = clientWithAlias("#dev:h.example", "!s:h.example", true);
    const lookup = vi.spyOn(
      client as unknown as { getRoomIdForAlias: () => Promise<unknown> },
      "getRoomIdForAlias",
    );
    const { result } = renderHook(() => useActiveSpaceId("#dev:h.example", "h.example"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.spaceId).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("is ready with no space when joining fails", async () => {
    const client = clientWithAlias("#dev:h.example", "!s:h.example", false);
    (client as unknown as { joinRoom: () => Promise<unknown> }).joinRoom = vi.fn(async () => {
      throw new Error("forbidden");
    });
    const { result } = renderHook(() => useActiveSpaceId("dev", "h.example"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.spaceId).toBeNull();
  });
});
