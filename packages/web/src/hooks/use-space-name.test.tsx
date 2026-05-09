import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useSpaceName } from "./use-space-name";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useSpaceName", () => {
  it("returns the room.name of the workforce space", () => {
    const client = makeFakeClient({ userId: me });
    const space = makeRoom(spaceId, { client, myUserId: me });
    (space as unknown as { name: string }).name = "Dev";
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
      id === spaceId ? space : null;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useSpaceName(spaceId));
    expect(result.current).toBe("Dev");
  });

  it("returns null when spaceId is null", () => {
    const client = makeFakeClient({ userId: me });
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useSpaceName(null));
    expect(result.current).toBeNull();
  });

  it("returns null when the space room is not in the client", () => {
    const client = makeFakeClient({ userId: me });
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => null;
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useSpaceName(spaceId));
    expect(result.current).toBeNull();
  });
});
