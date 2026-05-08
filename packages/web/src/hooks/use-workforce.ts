import { type Room, RoomStateEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";
import { makeAgentSet, parseWorkforceRoster, type RosterAgent } from "../lib/matrix/agent-detection";

export interface WorkforceView {
  ready: boolean;
  agents: RosterAgent[];
  isAgent: (userId: string) => boolean;
}

const EMPTY: WorkforceView = { ready: false, agents: [], isAgent: () => false };
const cache = new WeakMap<Room, WorkforceView>();

function snapshot(spaceId: string): WorkforceView {
  const room = MatrixClientPeg.safeGet()?.getRoom(spaceId);
  if (!room) return EMPTY;
  const cached = cache.get(room);
  const ev = room.currentState.getStateEvents("eco.zoon.workforce", "");
  const content = ev?.getContent() ?? null;
  const parsed = parseWorkforceRoster(content);
  if (!parsed) {
    if (cached && !cached.ready) return cached;
    const v: WorkforceView = { ready: false, agents: [], isAgent: () => false };
    cache.set(room, v);
    return v;
  }
  if (
    cached?.ready &&
    cached.agents.length === parsed.length &&
    cached.agents.every((a, i) => a.userId === parsed[i]!.userId)
  ) {
    return cached;
  }
  const set = makeAgentSet(parsed);
  const v: WorkforceView = { ready: true, agents: parsed, isAgent: (id) => set.has(id) };
  cache.set(room, v);
  return v;
}

export function useWorkforce(spaceId: string): WorkforceView {
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
