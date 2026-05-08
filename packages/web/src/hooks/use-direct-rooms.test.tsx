import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClientEvent } from "matrix-js-sdk";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useDirectRooms } from "./use-direct-rooms";

const me = "@me:h.example";
afterEach(() => MatrixClientPeg.reset());

describe("useDirectRooms", () => {
  it("returns rooms listed under any user in the m.direct account_data event", () => {
    const client = makeFakeClient({ userId: me });
    const dm1 = makeRoom("!dm1:h.example", { client, myUserId: me });
    const dm2 = makeRoom("!dm2:h.example", { client, myUserId: me });
    const other = makeRoom("!other:h.example", { client, myUserId: me });

    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
      ({ "!dm1:h.example": dm1, "!dm2:h.example": dm2, "!other:h.example": other })[id] ?? null;
    (client as unknown as { getAccountData: (t: string) => unknown }).getAccountData = (t) =>
      t === "m.direct"
        ? { getContent: () => ({ "@bob:h.example": ["!dm1:h.example"], "@carol:h.example": ["!dm2:h.example"] }) }
        : null;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useDirectRooms());
    expect(result.current.map((r) => r.roomId).sort()).toEqual(["!dm1:h.example", "!dm2:h.example"]);
  });

  it("updates when m.direct account data changes", () => {
    const client = makeFakeClient({ userId: me });
    const dm1 = makeRoom("!dm1:h.example", { client, myUserId: me });
    let directContent: Record<string, string[]> = {};
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
      id === "!dm1:h.example" ? dm1 : null;
    (client as unknown as { getAccountData: (t: string) => unknown }).getAccountData = () => ({
      getContent: () => directContent,
    });
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useDirectRooms());
    expect(result.current).toEqual([]);

    act(() => {
      directContent = { "@bob:h.example": ["!dm1:h.example"] };
      (client as unknown as { emit: (n: string, e: unknown) => void }).emit(ClientEvent.AccountData, {
        getType: () => "m.direct",
        getContent: () => directContent,
      });
    });
    expect(result.current.map((r) => r.roomId)).toEqual(["!dm1:h.example"]);
  });
});
