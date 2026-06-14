import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useAvailableCommands } from "./use-available-commands";

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => MatrixClientPeg.reset());

describe("useAvailableCommands", () => {
  it("returns [] when nothing advertised", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useAvailableCommands(roomId));
    expect(result.current).toEqual([]);
  });

  it("returns the latest advertised set, replacing earlier ones", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useAvailableCommands(roomId));

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "eco.zoon.available_commands_update",
          content: { session_id: "s1", available_commands: [{ name: "plan", description: "Plan mode" }] },
        }),
      );
    });
    expect(result.current).toEqual([{ name: "plan", description: "Plan mode" }]);

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "eco.zoon.available_commands_update",
          content: { session_id: "s1", available_commands: [{ name: "compact", description: "Compact" }] },
        }),
      );
    });
    expect(result.current).toEqual([{ name: "compact", description: "Compact" }]);
  });
});
