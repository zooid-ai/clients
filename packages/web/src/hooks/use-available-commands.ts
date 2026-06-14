import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";
import { allRoomEvents, makeSubscribe } from "./use-timeline";
import { EcoZoonEventType } from "../events/eco-zoon";

export interface AdvertisedCommand {
  name: string;
  description: string;
}

const EMPTY: AdvertisedCommand[] = [];
const cache = new Map<string, { ts: number; count: number; result: AdvertisedCommand[] }>();

function snapshot(roomId: string): AdvertisedCommand[] {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return EMPTY;

  // Full-snapshot replace: the newest advertisement wins.
  let latestTs = -1;
  let latest: AdvertisedCommand[] = EMPTY;
  let count = 0;
  for (const ev of allRoomEvents(room)) {
    if (ev.getType() !== EcoZoonEventType.AvailableCommandsUpdate) continue;
    const c = ev.getContent() as { available_commands?: unknown };
    if (!Array.isArray(c.available_commands)) continue;
    count++;
    if (ev.getTs() >= latestTs) {
      latestTs = ev.getTs();
      latest = (c.available_commands as unknown[])
        .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
        .filter((x): x is Record<string, unknown> => x !== null && typeof x.name === "string")
        .map((x) => ({
          name: x.name as string,
          description: typeof x.description === "string" ? x.description : "",
        }));
    }
  }

  const cached = cache.get(roomId);
  if (cached && cached.ts === latestTs && cached.count === count) return cached.result;
  cache.set(roomId, { ts: latestTs, count, result: latest });
  return latest;
}

export function useAvailableCommands(roomId: string): AdvertisedCommand[] {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshot(roomId),
    () => EMPTY,
  );
}
