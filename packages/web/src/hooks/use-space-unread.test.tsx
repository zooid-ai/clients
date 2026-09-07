import { renderHook } from "@testing-library/react";
import { NotificationCountType } from "matrix-js-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useInactiveSpacesUnread, useSpaceUnread } from "./use-space-unread";

const me = "@me:h.example";
const acme = "!acme:h.example";
const beta = "!beta:h.example";

afterEach(() => MatrixClientPeg.reset());

function seed() {
  const client = makeFakeClient({ userId: me });
  const rooms = new Map<string, ReturnType<typeof makeRoom>>();

  const mkSpace = (id: string, name: string) => {
    const space = makeRoom(id, { client, myUserId: me });
    Object.assign(space as unknown as Record<string, unknown>, {
      name,
      isSpaceRoom: () => true,
      getMyMembership: () => "join",
    });
    rooms.set(id, space);
    return space;
  };
  const mkChild = (id: string, parent: ReturnType<typeof makeRoom>, unread: number, hl = 0) => {
    const room = makeRoom(id, { client, myUserId: me });
    Object.assign(room as unknown as Record<string, unknown>, {
      isSpaceRoom: () => false,
      getMyMembership: () => "join",
    });
    room.setUnreadNotificationCount(NotificationCountType.Total, unread);
    room.setUnreadNotificationCount(NotificationCountType.Highlight, hl);
    injectStateEvent(
      parent,
      mkMatrixEvent({
        roomId: parent.roomId,
        sender: "@admin:h.example",
        type: "m.space.child",
        stateKey: id,
        content: { via: ["h.example"] },
      }),
    );
    rooms.set(id, room);
    return room;
  };

  const acmeSpace = mkSpace(acme, "Acme");
  const betaSpace = mkSpace(beta, "Beta");
  mkChild("!a1:h.example", acmeSpace, 3);
  mkChild("!a2:h.example", acmeSpace, 2, 1);
  mkChild("!b1:h.example", betaSpace, 5);

  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => rooms.get(id) ?? null;
  cast.getRooms = () => Array.from(rooms.values());
  MatrixClientPeg.injectClientForTest(client);
}

describe("useSpaceUnread", () => {
  it("sums total and highlight across a space's joined children", () => {
    seed();
    const { result } = renderHook(() => useSpaceUnread(acme));
    expect(result.current).toEqual({ total: 5, highlight: 1 });
  });

  it("is zero for a space with no children", () => {
    seed();
    const { result } = renderHook(() => useSpaceUnread("!empty:h.example"));
    expect(result.current).toEqual({ total: 0, highlight: 0 });
  });
});

describe("useInactiveSpacesUnread", () => {
  // The trigger badge answers "is something happening somewhere I'm not looking".
  // Counting the active space would make it echo the room list below it.
  it("excludes the active space", () => {
    seed();
    const { result } = renderHook(() => useInactiveSpacesUnread(acme));
    expect(result.current.total).toBe(5); // beta only
  });

  it("counts every space when none is active", () => {
    seed();
    const { result } = renderHook(() => useInactiveSpacesUnread(null));
    expect(result.current.total).toBe(10);
  });
});
