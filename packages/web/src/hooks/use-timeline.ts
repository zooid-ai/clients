import { ClientEvent, type MatrixEvent, type Room, RoomEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

interface TimelineState {
  events: MatrixEvent[];
}

const EMPTY: TimelineState = { events: [] };
const snapshotCache = new WeakMap<Room, TimelineState>();

function snapshot(roomId: string): TimelineState {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return EMPTY;
  const events = room.getLiveTimeline().getEvents();
  const cached = snapshotCache.get(room);
  if (
    cached &&
    cached.events.length === events.length &&
    cached.events[events.length - 1] === events[events.length - 1]
  ) {
    return cached;
  }
  const next = { events: [...events] };
  snapshotCache.set(room, next);
  return next;
}

export function useTimeline(roomId: string): TimelineState {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return MatrixClientPeg.subscribe(cb);
      // Subscribe at the client level: matrix-js-sdk re-emits Room.timeline
      // events on the client, and we need ClientEvent.Room to notice when the
      // room first appears (initial sync may complete after this hook mounts).
      const onTimeline = (_ev: MatrixEvent, room?: Room) => {
        if (room?.roomId === roomId) cb();
      };
      const onRoom = (room: Room) => {
        if (room.roomId === roomId) cb();
      };
      client.on(RoomEvent.Timeline, onTimeline);
      client.on(ClientEvent.Room, onRoom);
      // Also subscribe at the room level for the case where the SDK doesn't
      // re-emit room events on the client (e.g. unit-test fakes).
      const room = client.getRoom(roomId);
      room?.on(RoomEvent.Timeline, onTimeline);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        client.off(RoomEvent.Timeline, onTimeline);
        client.off(ClientEvent.Room, onRoom);
        room?.off(RoomEvent.Timeline, onTimeline);
        unsubPeg();
      };
    },
    () => snapshot(roomId),
    () => EMPTY,
  );
}
