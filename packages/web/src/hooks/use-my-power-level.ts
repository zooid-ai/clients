import { EventType, type MatrixEvent, RoomStateEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

export interface MyPowerLevel {
  level: number;
  canSendEvent(eventType: string): boolean;
  canSendStateEvent(eventType: string): boolean;
}

const EMPTY: MyPowerLevel = {
  level: 0,
  canSendEvent: () => false,
  canSendStateEvent: () => false,
};

interface CacheEntry {
  plEvent: MatrixEvent | null;
  result: MyPowerLevel;
}

const cache = new Map<string, CacheEntry>();

function snapshot(roomId: string): MyPowerLevel {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  const me = client?.getUserId();
  if (!room || !me) return EMPTY;

  const plEvent = room.currentState.getStateEvents(EventType.RoomPowerLevels, "") ?? null;
  const cached = cache.get(roomId);
  if (cached && cached.plEvent === plEvent) return cached.result;

  const pl = (plEvent?.getContent() ?? {}) as {
    users?: Record<string, number>;
    users_default?: number;
    events_default?: number;
    state_default?: number;
    events?: Record<string, number>;
  };

  const level = pl.users?.[me] ?? pl.users_default ?? 0;
  const eventsDefault = pl.events_default ?? 0;
  const stateDefault = pl.state_default ?? 50;

  const result: MyPowerLevel = {
    level,
    canSendEvent: (type) => level >= (pl.events?.[type] ?? eventsDefault),
    canSendStateEvent: (type) => level >= (pl.events?.[type] ?? stateDefault),
  };
  cache.set(roomId, { plEvent, result });
  return result;
}

export function useMyPowerLevel(roomId: string): MyPowerLevel {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const room = client?.getRoom(roomId);
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
    () => EMPTY,
  );
}
