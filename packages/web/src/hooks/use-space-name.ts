import { ClientEvent, RoomEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

function snapshot(spaceId: string | null): string | null {
  if (!spaceId) return null;
  const room = MatrixClientPeg.safeGet()?.getRoom(spaceId);
  return room?.name ?? null;
}

export function useSpaceName(spaceId: string | null): string | null {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      if (!client || !spaceId) return MatrixClientPeg.subscribe(cb);

      let nameOff: (() => void) | null = null;
      const attach = () => {
        if (nameOff) return;
        const room = client.getRoom(spaceId);
        if (!room) return;
        const onName = () => cb();
        room.on(RoomEvent.Name, onName);
        nameOff = () => room.off(RoomEvent.Name, onName);
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
        if (nameOff) nameOff();
        unsubPeg();
      };
    },
    () => snapshot(spaceId),
    () => null,
  );
}
