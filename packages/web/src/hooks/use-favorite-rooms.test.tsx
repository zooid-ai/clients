import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useFavoriteRooms } from "./use-favorite-rooms";

const me = "@me:h.example";
afterEach(() => MatrixClientPeg.reset());

function withTags(room: ReturnType<typeof makeRoom>, tags: Record<string, unknown>) {
  (room as unknown as { tags: Record<string, unknown> }).tags = tags;
  return room;
}

describe("useFavoriteRooms", () => {
  it("returns rooms with the m.favourite tag", () => {
    const client = makeFakeClient({ userId: me });
    const fav = withTags(makeRoom("!fav:h.example", { client, myUserId: me }), {
      "m.favourite": { order: 0.5 },
    });
    const plain = makeRoom("!plain:h.example", { client, myUserId: me });
    (client as unknown as { getRooms: () => unknown[] }).getRooms = () => [fav, plain];
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useFavoriteRooms());
    expect(result.current.map((r) => r.roomId)).toEqual(["!fav:h.example"]);
  });
});
