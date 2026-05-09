import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomEvent } from "matrix-js-sdk";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useRoomFavorite } from "./use-room-favorite";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

function setup(initialTagged = false) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  if (initialTagged) {
    (room as unknown as { tags: Record<string, unknown> }).tags = {
      "m.favourite": { order: 0.5 },
    };
  } else {
    (room as unknown as { tags: Record<string, unknown> }).tags = {};
  }
  const setRoomTag = vi.fn(async (_r: string, t: string, content: unknown) => {
    (room as unknown as { tags: Record<string, unknown> }).tags[t] = content;
    room.emit(RoomEvent.Tags, undefined as never, room);
  });
  const deleteRoomTag = vi.fn(async (_r: string, t: string) => {
    delete (room as unknown as { tags: Record<string, unknown> }).tags[t];
    room.emit(RoomEvent.Tags, undefined as never, room);
  });
  (client as unknown as { setRoomTag: typeof setRoomTag }).setRoomTag = setRoomTag;
  (client as unknown as { deleteRoomTag: typeof deleteRoomTag }).deleteRoomTag = deleteRoomTag;
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === roomId ? room : null;
  MatrixClientPeg.injectClientForTest(client);
  return { client, room, setRoomTag, deleteRoomTag };
}

describe("useRoomFavorite", () => {
  it("reports isFavorite=false for an untagged room", () => {
    setup(false);
    const { result } = renderHook(() => useRoomFavorite(roomId));
    expect(result.current.isFavorite).toBe(false);
  });

  it("reports isFavorite=true when the room has the m.favourite tag", () => {
    setup(true);
    const { result } = renderHook(() => useRoomFavorite(roomId));
    expect(result.current.isFavorite).toBe(true);
  });

  it("setRoomTag('m.favourite') is called when toggling on", async () => {
    const { setRoomTag } = setup(false);
    const { result } = renderHook(() => useRoomFavorite(roomId));
    await act(async () => {
      await result.current.toggle();
    });
    expect(setRoomTag).toHaveBeenCalledWith(roomId, "m.favourite", expect.objectContaining({ order: expect.any(Number) }));
    expect(result.current.isFavorite).toBe(true);
  });

  it("deleteRoomTag('m.favourite') is called when toggling off", async () => {
    const { deleteRoomTag } = setup(true);
    const { result } = renderHook(() => useRoomFavorite(roomId));
    await act(async () => {
      await result.current.toggle();
    });
    expect(deleteRoomTag).toHaveBeenCalledWith(roomId, "m.favourite");
    expect(result.current.isFavorite).toBe(false);
  });

  it("returns isFavorite=false and a no-op toggle when roomId is empty", async () => {
    setup(false);
    const { result } = renderHook(() => useRoomFavorite(""));
    expect(result.current.isFavorite).toBe(false);
    await act(async () => {
      await result.current.toggle();
    });
  });
});
