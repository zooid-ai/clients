import { act, renderHook } from "@testing-library/react";
import { EventType } from "matrix-js-sdk";
import { afterEach, describe, expect, it } from "vitest";
import {
  injectStateEvent,
  makeFakeClient,
  makeRoom,
  mkMatrixEvent,
} from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useMyPowerLevel } from "./use-my-power-level";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useMyPowerLevel", () => {
  it("returns my power level on mount", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, {
      client,
      myUserId: me,
      powerLevels: { [me]: 50 },
    });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useMyPowerLevel(roomId));
    expect(result.current.level).toBe(50);
  });

  it("falls back to users_default when I'm not listed", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, {
      client,
      myUserId: me,
      powerLevels: { "@admin:h.example": 100 },
      usersDefault: 0,
    });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useMyPowerLevel(roomId));
    expect(result.current.level).toBe(0);
  });

  it("re-evaluates live when m.room.power_levels changes", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, {
      client,
      myUserId: me,
      powerLevels: { [me]: 0 },
    });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useMyPowerLevel(roomId));
    expect(result.current.level).toBe(0);

    act(() => {
      injectStateEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@admin:h.example",
          type: EventType.RoomPowerLevels,
          stateKey: "",
          content: {
            users: { [me]: 50, "@admin:h.example": 100 },
            users_default: 0,
            events_default: 0,
            state_default: 50,
          },
        }),
      );
    });
    expect(result.current.level).toBe(50);
  });

  it("canSendEvent honors per-event gate from power_levels", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, {
      client,
      myUserId: me,
      powerLevels: { [me]: 25 },
    });
    injectStateEvent(
      room,
      mkMatrixEvent({
        roomId,
        sender: "@admin:h.example",
        type: EventType.RoomPowerLevels,
        stateKey: "",
        content: {
          users: { [me]: 25 },
          users_default: 0,
          events_default: 0,
          state_default: 50,
          events: { "eco.zoon.workspace": 100, "eco.zoon.approval_response": 0 },
        },
      }),
    );
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useMyPowerLevel(roomId));
    expect(result.current.canSendEvent("eco.zoon.workspace")).toBe(false);
    expect(result.current.canSendEvent("eco.zoon.approval_response")).toBe(true);
  });
});
