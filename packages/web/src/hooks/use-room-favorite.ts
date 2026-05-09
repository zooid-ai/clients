import { ClientEvent, RoomEvent } from "matrix-js-sdk";
import { useCallback, useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

interface RoomFavorite {
  isFavorite: boolean;
  toggle: () => Promise<void>;
}

function snapshot(roomId: string): boolean {
  if (!roomId) return false;
  const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
  return Boolean(
    (room as unknown as { tags?: Record<string, unknown> } | null)?.tags?.[
      "m.favourite"
    ],
  );
}

export function useRoomFavorite(roomId: string): RoomFavorite {
  const isFavorite = useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      if (!client || !roomId) return MatrixClientPeg.subscribe(cb);

      let tagsOff: (() => void) | null = null;
      const attach = () => {
        if (tagsOff) return;
        const room = client.getRoom(roomId);
        if (!room) return;
        const onTags = () => cb();
        room.on(RoomEvent.Tags, onTags);
        tagsOff = () => room.off(RoomEvent.Tags, onTags);
      };
      attach();

      const onRoom = () => {
        attach();
        cb();
      };
      client.on(ClientEvent.Room, onRoom);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        client.off(ClientEvent.Room, onRoom);
        if (tagsOff) tagsOff();
        unsubPeg();
      };
    },
    () => snapshot(roomId),
    () => false,
  );

  const toggle = useCallback(async () => {
    if (!roomId) return;
    const client = MatrixClientPeg.safeGet();
    if (!client) return;
    if (isFavorite) {
      await (
        client as unknown as { deleteRoomTag: (r: string, t: string) => Promise<void> }
      ).deleteRoomTag(roomId, "m.favourite");
    } else {
      await (
        client as unknown as {
          setRoomTag: (r: string, t: string, m: unknown) => Promise<void>;
        }
      ).setRoomTag(roomId, "m.favourite", { order: 0.5 });
    }
  }, [roomId, isFavorite]);

  return { isFavorite, toggle };
}
