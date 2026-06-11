import { useSyncExternalStore } from "react";
import { RoomEvent, type IContent } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { resolveEditedContent } from "@/lib/matrix/edits";

// Cache snapshots per room|event so useSyncExternalStore sees stable refs.
const cache = new Map<string, { key: string; value: IContent | null }>();

function snapshot(roomId: string, eventId: string): IContent | null {
  const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
  const cacheKey = `${roomId}|${eventId}`;
  if (!room) return cache.get(cacheKey)?.value ?? null;
  const events = room.getLiveTimeline().getEvents();
  const target = events.find((ev) => ev.getId() === eventId);
  const content = target ? resolveEditedContent(target, events) : null;
  const key = content ? JSON.stringify(content) : "";
  const cached = cache.get(cacheKey);
  if (cached && cached.key === key) return cached.value;
  cache.set(cacheKey, { key, value: content });
  return content;
}

export function useEditedContent(roomId: string, eventId: string): IContent | null {
  return useSyncExternalStore(
    (cb) => {
      const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      if (!room) return unsubPeg;
      const onChange = () => cb();
      room.on(RoomEvent.Timeline, onChange);
      room.on(RoomEvent.Redaction, onChange);
      return () => {
        room.off(RoomEvent.Timeline, onChange);
        room.off(RoomEvent.Redaction, onChange);
        unsubPeg();
      };
    },
    () => snapshot(roomId, eventId),
    () => null,
  );
}
