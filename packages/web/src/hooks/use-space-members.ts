import { type RoomMember, RoomStateEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

const EMPTY: RoomMember[] = [];
const cache = new Map<string, RoomMember[]>();

function snapshot(spaceId: string | null): RoomMember[] {
  if (!spaceId) return EMPTY;
  const room = MatrixClientPeg.safeGet()?.getRoom(spaceId);
  if (!room) return EMPTY;
  const cached = cache.get(spaceId) ?? EMPTY;
  const next = room.getJoinedMembers();
  if (cached.length === next.length && cached.every((m, i) => m === next[i])) {
    return cached;
  }
  cache.set(spaceId, next);
  return next;
}

export function useSpaceMembers(spaceId: string | null): RoomMember[] {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const room = spaceId ? client?.getRoom(spaceId) : null;
      if (!room) return MatrixClientPeg.subscribe(cb);
      const onMember = () => cb();
      room.currentState.on(RoomStateEvent.Members, onMember);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        room.currentState.off(RoomStateEvent.Members, onMember);
        unsubPeg();
      };
    },
    () => snapshot(spaceId),
    () => EMPTY,
  );
}
