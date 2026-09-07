import { renderHook, waitFor } from "@testing-library/react";
import type { MatrixClient, Room } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useSpaceHierarchy } from "./use-space-hierarchy";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

/** Seeds a hierarchy of: the space, two rooms, one archived room, one subspace. */
function seed(memberships: Record<string, string> = {}) {
  const client = makeFakeClient({ userId: me });
  const rooms = new Map<string, Room>();
  for (const [id, membership] of Object.entries(memberships)) {
    const room = makeRoom(id, { client, myUserId: me });
    (room as unknown as { getMyMembership: () => string }).getMyMembership = () => membership;
    rooms.set(id, room);
  }
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => rooms.get(id) ?? null;
  const getRoomHierarchy = vi.fn(async () => ({
    rooms: [
      { room_id: spaceId, name: "Acme", room_type: "m.space" },
      { room_id: "!general:h.example", name: "general", topic: "town square", num_joined_members: 4 },
      { room_id: "!design:h.example", name: "design", num_joined_members: 2 },
      { room_id: "!archive:h.example", name: "archive", num_joined_members: 1 },
      { room_id: "!guides:h.example", name: "Guides", room_type: "m.space", num_joined_members: 9 },
    ],
  }));
  cast.getRoomHierarchy = getRoomHierarchy;
  MatrixClientPeg.injectClientForTest(client);
  return { client: client as MatrixClient, getRoomHierarchy };
}

describe("useSpaceHierarchy", () => {
  it("returns joined and unjoined children alike", async () => {
    seed({ "!general:h.example": "join" });
    const { result } = renderHook(() => useSpaceHierarchy(spaceId, true));
    await waitFor(() => expect(result.current.children).toHaveLength(4));

    const byId = Object.fromEntries(result.current.children.map((c) => [c.roomId, c]));
    expect(byId["!general:h.example"].joined).toBe(true);
    expect(byId["!design:h.example"].joined).toBe(false);
  });

  it("keeps subspaces, tagged as kind: space", async () => {
    seed();
    const { result } = renderHook(() => useSpaceHierarchy(spaceId, true));
    await waitFor(() => expect(result.current.children).toHaveLength(4));

    const guides = result.current.children.find((c) => c.roomId === "!guides:h.example");
    expect(guides?.kind).toBe("space");
    expect(guides?.name).toBe("Guides");
    expect(result.current.children.filter((c) => c.kind === "room")).toHaveLength(3);
  });

  // The bug: getRoom() is truthy for left and invited rooms, so the old filter
  // hid them from browse entirely and made a left room unrejoinable from the UI.
  it("treats a left room as present but not joined", async () => {
    seed({ "!archive:h.example": "leave" });
    const { result } = renderHook(() => useSpaceHierarchy(spaceId, true));
    await waitFor(() => expect(result.current.children).toHaveLength(4));

    const archive = result.current.children.find((c) => c.roomId === "!archive:h.example");
    expect(archive).toBeDefined();
    expect(archive?.joined).toBe(false);
  });

  it("treats a pending invite as not joined", async () => {
    seed({ "!design:h.example": "invite" });
    const { result } = renderHook(() => useSpaceHierarchy(spaceId, true));
    await waitFor(() => expect(result.current.children).toHaveLength(4));

    expect(result.current.children.find((c) => c.roomId === "!design:h.example")?.joined).toBe(false);
  });

  it("excludes the space itself", async () => {
    seed();
    const { result } = renderHook(() => useSpaceHierarchy(spaceId, true));
    await waitFor(() => expect(result.current.children).toHaveLength(4));
    expect(result.current.children.some((c) => c.roomId === spaceId)).toBe(false);
  });

  // zooid.yaml authors this order; it carries intent and must survive the hook.
  it("preserves the order the hierarchy returned", async () => {
    seed();
    const { result } = renderHook(() => useSpaceHierarchy(spaceId, true));
    await waitFor(() => expect(result.current.children).toHaveLength(4));
    expect(result.current.children.map((c) => c.roomId)).toEqual([
      "!general:h.example",
      "!design:h.example",
      "!archive:h.example",
      "!guides:h.example",
    ]);
  });

  it("does not fetch while disabled", async () => {
    const { getRoomHierarchy } = seed();
    renderHook(() => useSpaceHierarchy(spaceId, false));
    await waitFor(() => expect(getRoomHierarchy).not.toHaveBeenCalled());
  });
});
