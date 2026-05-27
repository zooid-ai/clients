import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useJoinedSpaces } from "./use-joined-spaces";

const me = "@me:h.example";

afterEach(() => MatrixClientPeg.reset());

function asSpace(room: ReturnType<typeof makeRoom>) {
  (room as unknown as { isSpaceRoom: () => boolean }).isSpaceRoom = () => true;
  return room;
}

describe("useJoinedSpaces", () => {
  it("returns only joined rooms that are spaces", () => {
    const client = makeFakeClient({ userId: me });
    const dev = asSpace(makeRoom("!dev:h.example", { client, myUserId: me }));
    (dev as unknown as { name: string }).name = "Dev";
    const ops = asSpace(makeRoom("!ops:h.example", { client, myUserId: me }));
    (ops as unknown as { name: string }).name = "Ops";
    const general = makeRoom("!general:h.example", { client, myUserId: me }); // not a space
    (general as unknown as { isSpaceRoom: () => boolean }).isSpaceRoom = () => false;

    (client as unknown as { getRooms: () => unknown[] }).getRooms = () => [dev, general, ops];
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useJoinedSpaces());
    expect(result.current.map((r) => r.roomId).sort()).toEqual(["!dev:h.example", "!ops:h.example"]);
  });

  it("re-evaluates when a space arrives after subscribe", () => {
    const client = makeFakeClient({ userId: me }) as unknown as {
      addRoom: (r: ReturnType<typeof makeRoom>) => void;
      getRooms: () => unknown[];
    };
    MatrixClientPeg.injectClientForTest(client as never);

    const { result } = renderHook(() => useJoinedSpaces());
    expect(result.current).toEqual([]);

    const dev = asSpace(makeRoom("!dev:h.example", { client: client as never, myUserId: me }));
    act(() => client.addRoom(dev));
    expect(result.current.map((r) => r.roomId)).toEqual(["!dev:h.example"]);
  });
});
