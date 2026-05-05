import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useMembers } from "./use-members";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useMembers", () => {
  it("returns joined members of the room", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    room.currentState.setJoinedMemberCount(2);
    const members = [
      { userId: me, name: "me" },
      { userId: "@architect.acme:h.example", name: "architect" },
    ];
    (room as unknown as { getJoinedMembers: () => unknown[] }).getJoinedMembers = () => members;
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useMembers(roomId));
    expect(result.current.map((m) => m.userId)).toEqual([me, "@architect.acme:h.example"]);
  });
});
