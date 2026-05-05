import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  makeFakeClient,
  makeRoom,
  mkMatrixEvent,
  pushTimelineEvent,
} from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useTimeline } from "./use-timeline";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useTimeline", () => {
  it("returns the room's current live timeline events", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        roomId,
        sender: "@a:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body: "hello" },
      }),
    );
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
      id === roomId ? room : null;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].getContent().body).toBe("hello");
  });

  it("appends new live events", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const { result } = renderHook(() => useTimeline(roomId));
    expect(result.current.events).toHaveLength(0);

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@a:h.example",
          type: "m.room.message",
          content: { msgtype: "m.text", body: "first" },
        }),
      );
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@b:h.example",
          type: "m.room.message",
          content: { msgtype: "m.text", body: "second" },
        }),
      );
    });
    expect(result.current.events.map((e) => e.getContent().body)).toEqual(["first", "second"]);
  });

  it("returns empty when the room does not exist", () => {
    const client = makeFakeClient({ userId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => null;
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useTimeline("!missing:h.example"));
    expect(result.current.events).toEqual([]);
  });
});
