import { type Room, type RoomMember, RoomStateEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

const EMPTY: RoomMember[] = [];
const cache = new WeakMap<Room, RoomMember[]>();

function snapshot(roomId: string): RoomMember[] {
  const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
  if (!room) return EMPTY;
  const next = room.getJoinedMembers();
  const cached = cache.get(room);
  if (
    cached &&
    cached.length === next.length &&
    cached.every((m, i) => m === next[i])
  ) {
    return cached;
  }
  cache.set(room, next);
  return next;
}

export function useMembers(roomId: string): RoomMember[] {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const room = client?.getRoom(roomId);
      if (!room) return MatrixClientPeg.subscribe(cb);
      const onMember = () => cb();
      room.currentState.on(RoomStateEvent.Members, onMember);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        room.currentState.off(RoomStateEvent.Members, onMember);
        unsubPeg();
      };
    },
    () => snapshot(roomId),
    () => EMPTY,
  );
}
