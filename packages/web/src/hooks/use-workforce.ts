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
  const parsed = mergedRoster(room);
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

/**
 * Each daemon publishes its own roster under its workstation's state key, so
 * the workforce is the union of every `dev.zooid.workforce` event in the
 * space. Null until at least one roster parses.
 */
function mergedRoster(room: Room): RosterAgent[] | null {
  const events = [...room.currentState.getStateEvents("dev.zooid.workforce")].sort((a, b) =>
    (a.getStateKey() ?? "").localeCompare(b.getStateKey() ?? ""),
  );
  let out: RosterAgent[] | null = null;
  const seen = new Set<string>();
  for (const ev of events) {
    const parsed = parseWorkforceRoster(ev.getContent());
    if (!parsed) continue;
    out ??= [];
    for (const a of parsed) {
      if (seen.has(a.userId)) continue;
      seen.add(a.userId);
      out.push(a);
    }
  }
  return out;
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
