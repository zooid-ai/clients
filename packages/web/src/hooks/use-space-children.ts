import { ClientEvent, type Room, RoomStateEvent } from "matrix-js-sdk";
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
      if (!client) return MatrixClientPeg.subscribe(cb);

      // The space room may not be in the client yet — sync delivers the
      // workforce space *after* the alias join completes, so we must keep
      // listening for ClientEvent.Room and upgrade to a state subscription
      // as soon as the space arrives.
      let stateOff: (() => void) | null = null;
      const attachToSpace = () => {
        if (stateOff) return;
        const space = client.getRoom(spaceId);
        if (!space) return;
        const onState = () => cb();
        space.currentState.on(RoomStateEvent.Events, onState);
        stateOff = () => space.currentState.off(RoomStateEvent.Events, onState);
      };
      attachToSpace();

      const onRoom = () => {
        attachToSpace();
        cb();
      };
      client.on(ClientEvent.Room, onRoom);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        client.off(ClientEvent.Room, onRoom);
        if (stateOff) stateOff();
        unsubPeg();
      };
    },
    () => snapshot(spaceId),
    () => EMPTY,
  );
}
