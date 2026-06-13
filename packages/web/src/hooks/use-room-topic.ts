import { type MatrixEvent, RoomStateEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

const cache = new Map<string, { event: MatrixEvent | null; result: string | null }>();

function snapshot(roomId: string): string | null {
  const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
  if (!room) return null;
  const event = room.currentState.getStateEvents("m.room.topic", "") ?? null;
  const cached = cache.get(roomId);
  if (cached && cached.event === event) return cached.result;
  const result = ((event?.getContent() as { topic?: string } | null)?.topic ?? null) || null;
  cache.set(roomId, { event, result });
  return result;
}

export function useRoomTopic(roomId: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
      if (!room) return MatrixClientPeg.subscribe(cb);
      const onState = () => cb();
      room.currentState.on(RoomStateEvent.Events, onState);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        room.currentState.off(RoomStateEvent.Events, onState);
        unsubPeg();
      };
    },
    () => snapshot(roomId),
    () => null,
  );
}
