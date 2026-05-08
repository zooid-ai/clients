import { type Room, RoomStateEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

const EMPTY: Room[] = [];

const cache = new Map<string, Room[]>();

function snapshot(spaceId: string): Room[] {
  const client = MatrixClientPeg.safeGet();
  const space = client?.getRoom(spaceId);
  const cached = cache.get(spaceId) ?? EMPTY;
  if (!client || !space) {
    if (cached !== EMPTY) cache.set(spaceId, EMPTY);
    return EMPTY;
  }
  const childIds = space.currentState
    .getStateEvents("m.space.child")
    .map((e) => e.getStateKey())
    .filter((k): k is string => !!k);
  const next = childIds.map((id) => client.getRoom(id)).filter((r): r is Room => !!r);
  if (cached.length === next.length && cached.every((r, i) => r === next[i])) {
    return cached;
  }
  cache.set(spaceId, next);
  return next;
}

export function useSpaceChildren(spaceId: string): Room[] {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const room = client?.getRoom(spaceId);
      if (!room) return MatrixClientPeg.subscribe(cb);
      const onState = () => cb();
      room.currentState.on(RoomStateEvent.Events, onState);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        room.currentState.off(RoomStateEvent.Events, onState);
        unsubPeg();
      };
    },
    () => snapshot(spaceId),
    () => EMPTY,
  );
}
