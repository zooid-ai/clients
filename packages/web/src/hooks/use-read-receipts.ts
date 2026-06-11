import { useSyncExternalStore } from "react";
import { RoomEvent, ReceiptType } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";

const EMPTY: string[] = [];
const cache = new Map<string, { key: string; value: string[] }>();

function snapshot(roomId: string, eventId: string): string[] {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!client || !room) return EMPTY;
  const target = room
    .getLiveTimeline()
    .getEvents()
    .find((ev) => ev.getId() === eventId);
  if (!target) return EMPTY;
  const me = client.getUserId();
  const users = room
    .getReceiptsForEvent(target)
    .filter((r) => r.type === ReceiptType.Read && r.userId !== me)
    .map((r) => r.userId)
    .sort();
  if (users.length === 0) return EMPTY;
  const cacheKey = `${roomId}|${eventId}`;
  const key = users.join(",");
  const cached = cache.get(cacheKey);
  if (cached && cached.key === key) return cached.value;
  cache.set(cacheKey, { key, value: users });
  return users;
}

export function useReadReceipts(roomId: string, eventId: string): string[] {
  return useSyncExternalStore(
    (cb) => {
      const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      if (!room) return unsubPeg;
      const onChange = () => cb();
      room.on(RoomEvent.Receipt, onChange);
      return () => {
        room.off(RoomEvent.Receipt, onChange);
        unsubPeg();
      };
    },
    () => snapshot(roomId, eventId),
    () => EMPTY,
  );
}
