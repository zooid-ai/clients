import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useSpaceMembers } from "./use-space-members";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

function memberOf(userId: string, name: string) {
  return { userId, name, membership: "join" };
}

describe("useSpaceMembers", () => {
  it("returns joined members of the active space", () => {
    const client = makeFakeClient({ userId: me });
    const space = makeRoom(spaceId, { client, myUserId: me });
    const members = [memberOf(me, "me"), memberOf("@bob:h.example", "bob")];
    (space as unknown as { getJoinedMembers: () => unknown[] }).getJoinedMembers = () => members;
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
      id === spaceId ? space : null;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useSpaceMembers(spaceId));
    expect(result.current.map((m) => m.userId)).toEqual([me, "@bob:h.example"]);
  });

  it("returns EMPTY when spaceId is null", () => {
    const client = makeFakeClient({ userId: me });
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useSpaceMembers(null));
    expect(result.current).toEqual([]);
  });
});
