import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useSpaceChildren } from "./use-space-children";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useSpaceChildren", () => {
  it("returns rooms whose ID appears as an m.space.child state_key on the space", () => {
    const client = makeFakeClient({ userId: me });
    const space = makeRoom(spaceId, { client, myUserId: me });
    const childA = makeRoom("!a:h.example", { client, myUserId: me });
    const childB = makeRoom("!b:h.example", { client, myUserId: me });
    const orphan = makeRoom("!c:h.example", { client, myUserId: me });

    for (const id of ["!a:h.example", "!b:h.example"]) {
      injectStateEvent(
        space,
        mkMatrixEvent({
          roomId: spaceId,
          sender: "@admin:h.example",
          type: "m.space.child",
          stateKey: id,
          content: { via: ["h.example"] },
        }),
      );
    }
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
      ({ "!space:h.example": space, "!a:h.example": childA, "!b:h.example": childB, "!c:h.example": orphan })[id] ?? null;
    (client as unknown as { getRooms: () => unknown[] }).getRooms = () => [space, childA, childB, orphan];
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useSpaceChildren(spaceId));
    expect(result.current.map((r) => r.roomId).sort()).toEqual(["!a:h.example", "!b:h.example"]);
  });

  // Regression: live-debugged 2026-05-08. With production data, sync delivers
  // the workforce space room *after* useSpaceChildren has already mounted and
  // subscribed. The hook's subscribe path falls back to a peg-only listener
  // when client.getRoom(spaceId) returns null at subscribe time, but the peg
  // never re-fires after sync, so the hook stays at EMPTY even though the
  // space and its m.space.child state arrive seconds later.
  it("re-evaluates when the space and its children arrive after subscribe", async () => {
    const client = makeFakeClient({ userId: me }) as unknown as {
      addRoom: (r: ReturnType<typeof makeRoom>) => void;
    };
    MatrixClientPeg.injectClientForTest(client as never);

    // Mount the hook before the space exists in the client. This mirrors the
    // real flow: useActiveSpaceId resolves the alias and joins, but Tuwunel's
    // sync pushes the room state in a later /sync response.
    const { result } = renderHook(() => useSpaceChildren(spaceId));
    expect(result.current).toEqual([]);

    // Sync delivers the workforce space + its two children. No other hook
    // re-renders Sidebar, so the test does NOT call rerender() — the
    // ClientEvent.Room emission must itself trigger a re-snapshot.
    const space = makeRoom(spaceId, { client: client as never, myUserId: me });
    const childA = makeRoom("!a:h.example", { client: client as never, myUserId: me });
    const childB = makeRoom("!b:h.example", { client: client as never, myUserId: me });
    for (const id of ["!a:h.example", "!b:h.example"]) {
      injectStateEvent(
        space,
        mkMatrixEvent({
          roomId: spaceId,
          sender: "@admin:h.example",
          type: "m.space.child",
          stateKey: id,
          content: { via: ["h.example"] },
        }),
      );
    }
    act(() => {
      client.addRoom(childA);
      client.addRoom(childB);
      client.addRoom(space);
    });
    expect(result.current.map((r) => r.roomId).sort()).toEqual(["!a:h.example", "!b:h.example"]);
  });

  it("re-evaluates when an m.space.child state event is added after subscribe", () => {
    const client = makeFakeClient({ userId: me });
    const space = makeRoom(spaceId, { client, myUserId: me });
    const childA = makeRoom("!a:h.example", { client, myUserId: me });
    const rooms: Record<string, unknown> = { [spaceId]: space, "!a:h.example": childA };
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) => rooms[id] ?? null;
    (client as unknown as { getRooms: () => unknown[] }).getRooms = () => Object.values(rooms);
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useSpaceChildren(spaceId));
    expect(result.current).toEqual([]);

    // Daemon writes m.space.child after the page loaded.
    act(() => {
      injectStateEvent(
        space,
        mkMatrixEvent({
          roomId: spaceId,
          sender: "@zooid:h.example",
          type: "m.space.child",
          stateKey: "!a:h.example",
          content: { via: ["h.example"] },
        }),
      );
    });
    expect(result.current.map((r) => r.roomId)).toEqual(["!a:h.example"]);
  });
});
