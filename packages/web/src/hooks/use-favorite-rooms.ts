import { type Room, RoomEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

const EMPTY: Room[] = [];

let cached: Room[] = EMPTY;

function snapshot(): Room[] {
  const client = MatrixClientPeg.safeGet();
  if (!client) {
    if (cached !== EMPTY) cached = EMPTY;
    return cached;
  }
  const next = client
    .getRooms()
    .filter((r) =>
      Boolean((r as unknown as { tags?: Record<string, unknown> }).tags?.["m.favourite"]),
    );
  if (cached.length === next.length && cached.every((r, i) => r === next[i])) {
    return cached;
  }
  cached = next;
  return cached;
}

export function useFavoriteRooms(): Room[] {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return MatrixClientPeg.subscribe(cb);
      const onTags = () => cb();
      for (const r of client.getRooms()) r.on(RoomEvent.Tags, onTags);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        for (const r of client.getRooms()) r.off(RoomEvent.Tags, onTags);
        unsubPeg();
      };
    },
    snapshot,
    () => EMPTY,
  );
}
