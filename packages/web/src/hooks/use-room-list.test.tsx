import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClientEventName, makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useRoomList } from "./use-room-list";

const me = "@me:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useRoomList", () => {
  it("returns the current rooms on mount", () => {
    const client = makeFakeClient({ userId: me });
    const a = makeRoom("!a:h.example", { client, myUserId: me });
    const b = makeRoom("!b:h.example", { client, myUserId: me });
    (client as unknown as { getRooms: () => unknown[] }).getRooms = () => [a, b];
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useRoomList());
    expect(result.current.map((r) => r.roomId)).toEqual(["!a:h.example", "!b:h.example"]);
  });

  it("re-renders when a room is added", () => {
    const client = makeFakeClient({ userId: me });
    const a = makeRoom("!a:h.example", { client, myUserId: me });
    const rooms = [a];
    (client as unknown as { getRooms: () => unknown[] }).getRooms = () => rooms;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useRoomList());
    expect(result.current).toHaveLength(1);

    act(() => {
      const b = makeRoom("!b:h.example", { client, myUserId: me });
      rooms.push(b);
      (client as unknown as { emit: (n: string, r: unknown) => void }).emit(
        ClientEventName.Room,
        b,
      );
    });
    expect(result.current).toHaveLength(2);
  });

  it("returns empty list when peg is empty", () => {
    const { result } = renderHook(() => useRoomList());
    expect(result.current).toEqual([]);
  });
});
