import { ClientEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "@/client/peg";

/** True once the client's store has the room (joined, invited, or just synced in). */
export function useRoomKnown(roomId: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      client?.on(ClientEvent.Room, cb);
      return () => {
        unsubPeg();
        client?.off(ClientEvent.Room, cb);
      };
    },
    () => {
      const client = MatrixClientPeg.safeGet();
      // Before initial sync, assume known so a cold load doesn't flash the panel.
      if (!client || !client.isInitialSyncComplete()) return true;
      return client.getRoom(roomId) !== null;
    },
    () => true,
  );
}
