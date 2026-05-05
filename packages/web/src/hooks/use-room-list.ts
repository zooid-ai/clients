import { ClientEvent, type Room } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

const EMPTY: Room[] = [];

let cached: Room[] = EMPTY;

function snapshot(): Room[] {
  const next = MatrixClientPeg.safeGet()?.getRooms() ?? EMPTY;
  if (
    cached.length === next.length &&
    cached.every((r, i) => r === next[i])
  ) {
    return cached;
  }
  cached = next;
  return next;
}

export function useRoomList(): Room[] {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return MatrixClientPeg.subscribe(cb);
      const onChange = () => cb();
      client.on(ClientEvent.Room, onChange);
      client.on(ClientEvent.DeleteRoom, onChange);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        client.off(ClientEvent.Room, onChange);
        client.off(ClientEvent.DeleteRoom, onChange);
        unsubPeg();
      };
    },
    snapshot,
    () => EMPTY,
  );
}
