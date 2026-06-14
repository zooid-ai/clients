import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";
import { allRoomEvents, makeSubscribe } from "./use-timeline";
import {
  EcoZoonEventType,
  planEntriesFromToolInput,
  type PlanBoardEntry,
} from "../events/eco-zoon";

export interface PlanSnapshot {
  sessionId: string;
  entries: PlanBoardEntry[];
}

const planCache = new Map<string, { ts: number; count: number; result: PlanSnapshot | null }>();

function snapshotPlan(roomId: string, threadId: string): PlanSnapshot | null {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return null;

  // A turn has at most one live plan: the newest plan-bearing event wins
  // (ACP full-snapshot replace semantics — no merge). Scoped to the thread
  // so plans from different threads don't bleed into each other.
  let latestTs = -1;
  let latest: PlanSnapshot | null = null;
  let planEventCount = 0;
  for (const ev of allRoomEvents(room)) {
    // Only consider events that belong to this thread.
    const rel = ev.getRelation();
    if (rel?.rel_type !== "m.thread" || rel.event_id !== threadId) continue;

    const t = ev.getType();
    const c = ev.getContent() as Record<string, unknown>;
    const sessionId = typeof c.session_id === "string" ? c.session_id : null;
    if (!sessionId) continue;
    let entries: PlanBoardEntry[] | null = null;
    if (t === EcoZoonEventType.Plan && Array.isArray(c.entries)) {
      entries = (c.entries as unknown[])
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .filter((e) => typeof e.content === "string" && typeof e.status === "string")
        .map((e) => ({
          content: e.content as string,
          status: e.status as string,
          ...(typeof e.priority === "string" ? { priority: e.priority as string } : {}),
        }));
      if (entries.length === 0) entries = null;
    } else if (t === EcoZoonEventType.ToolCall || t === EcoZoonEventType.ToolCallUpdate) {
      entries = planEntriesFromToolInput(c.raw_input);
    }
    if (entries) {
      planEventCount++;
      if (ev.getTs() >= latestTs) {
        latestTs = ev.getTs();
        latest = { sessionId, entries };
      }
    }
  }

  const cacheKey = `${roomId}:${threadId}`;
  const cached = planCache.get(cacheKey);
  if (cached && cached.ts === latestTs && cached.count === planEventCount) return cached.result;
  planCache.set(cacheKey, { ts: latestTs, count: planEventCount, result: latest });
  return latest;
}

export function usePlan(roomId: string, threadId: string): PlanSnapshot | null {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshotPlan(roomId, threadId),
    () => null,
  );
}
