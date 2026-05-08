import { renderHook } from "@testing-library/react";
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
});
