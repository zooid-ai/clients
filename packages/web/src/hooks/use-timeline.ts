import {
  ClientEvent,
  type IEvent,
  type MatrixClient,
  MatrixEvent,
  type Room,
  RoomEvent,
} from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

interface TimelineState {
  events: MatrixEvent[];
  /** Root event_ids referenced by thread replies that aren't yet in any local timeline. */
  pendingRootIds: string[];
}

export interface ThreadPreviewState {
  /** Last ≤3 thread-reply events for this root, in arrival order. */
  events: MatrixEvent[];
  /** Authoritative total reply count (from server unsigned or live timeline). */
  totalCount: number;
}

export interface ThreadFullState {
  /** The thread root event, or undefined while loading. */
  root: MatrixEvent | undefined;
  /** True while we're trying to fetch the root event from the server. */
  rootPending: boolean;
  /** All thread-reply events, in chronological order. */
  events: MatrixEvent[];
  /** Authoritative total reply count. */
  totalCount: number;
}

const EMPTY: TimelineState = { events: [], pendingRootIds: [] };
const THREAD_EMPTY: ThreadPreviewState = { events: [], totalCount: 0 };
const THREAD_FULL_EMPTY: ThreadFullState = {
  root: undefined,
  rootPending: false,
  events: [],
  totalCount: 0,
};

const snapshotCache = new WeakMap<Room, TimelineState>();

const threadCache = new Map<
  string,
  { replyCount: number; totalCount: number; state: ThreadPreviewState }
>();

const threadFullCache = new Map<
  string,
  { replyCount: number; totalCount: number; root: MatrixEvent | undefined; rootPending: boolean; state: ThreadFullState }
>();

// Lazy-loaded events fetched via /rooms/{roomId}/event/{eventId} when the
// thread root falls outside the synced timeline window. Keyed by event_id.
const fetchedEvents = new Map<string, MatrixEvent>();
const inFlightFetches = new Set<string>(); // `${roomId}:${eventId}`
const failedFetches = new Set<string>(); // don't retry endlessly
const fetchSubscribers = new Set<() => void>();

function notifyFetchSubscribers() {
  for (const cb of fetchSubscribers) cb();
}

function ensureRootFetched(client: MatrixClient, roomId: string, eventId: string): void {
  const key = `${roomId}:${eventId}`;
  if (
    fetchedEvents.has(eventId) ||
    inFlightFetches.has(key) ||
    failedFetches.has(key)
  ) {
    return;
  }
  inFlightFetches.add(key);
  void client
    .fetchRoomEvent(roomId, eventId)
    .then((raw) => {
      fetchedEvents.set(eventId, new MatrixEvent(raw as IEvent));
      notifyFetchSubscribers();
    })
    .catch((err) => {
      console.warn(`[useTimeline] fetchRoomEvent(${roomId}, ${eventId}) failed:`, err);
      failedFetches.add(key);
    })
    .finally(() => {
      inFlightFetches.delete(key);
    });
}

function allRoomEvents(room: Room): MatrixEvent[] {
  // getLiveTimeline() only covers the current window. After a limited sync,
  // older events live in historical timelines within the same set.
  const timelineSet = room.getUnfilteredTimelineSet();
  const seen = new Set<string>();
  const out: MatrixEvent[] = [];
  for (const tl of timelineSet.getTimelines()) {
    for (const ev of tl.getEvents()) {
      const id = ev.getId() ?? `${ev.getType()}-${ev.getTs()}`;
      if (!seen.has(id)) {
        seen.add(id);
        out.push(ev);
      }
    }
  }
  out.sort((a, b) => a.getTs() - b.getTs());
  return out;
}

function snapshot(roomId: string): TimelineState {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!client || !room) return EMPTY;

  const all = allRoomEvents(room);
  const inSetIds = new Set<string>();
  const referencedRootIds = new Set<string>();
  const events: MatrixEvent[] = [];

  for (const ev of all) {
    const id = ev.getId();
    if (id) inSetIds.add(id);
    // getRelation() reads getWireContent() — the original wire event — so it
    // is correct even for replaced events (getContent() returns m.new_content
    // which has no m.relates_to, causing edited threaded messages to leak into
    // the main timeline).
    const rel = ev.getRelation();
    if (rel?.rel_type === "m.thread") {
      if (rel.event_id) referencedRootIds.add(rel.event_id);
    } else if (rel?.rel_type === "m.replace") {
      // Edit events: suppress from the timeline; content applied to the
      // original event via resolveEditedContent / useEditedContent.
    } else {
      events.push(ev);
    }
  }

  const pendingRootIds: string[] = [];

  for (const rootId of referencedRootIds) {
    if (inSetIds.has(rootId)) continue;
    const cached = fetchedEvents.get(rootId);
    if (cached) {
      events.push(cached);
      continue;
    }
    const found = room.findEventById(rootId);
    if (found) {
      events.push(found);
      continue;
    }
    ensureRootFetched(client, roomId, rootId);
    pendingRootIds.push(rootId);
  }

  events.sort((a, b) => a.getTs() - b.getTs());

  const cached = snapshotCache.get(room);
  if (
    cached &&
    cached.events.length === events.length &&
    cached.events[events.length - 1] === events[events.length - 1] &&
    cached.pendingRootIds.length === pendingRootIds.length &&
    cached.pendingRootIds.every((id, i) => id === pendingRootIds[i])
  ) {
    return cached;
  }
  const next = { events, pendingRootIds };
  snapshotCache.set(room, next);
  return next;
}

function snapshotThread(roomId: string, rootEventId: string): ThreadPreviewState {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return THREAD_EMPTY;

  const all = allRoomEvents(room);
  const rootEvent =
    all.find((ev) => ev.getId() === rootEventId) ??
    fetchedEvents.get(rootEventId) ??
    room.findEventById(rootEventId);
  const unsigned = rootEvent?.getUnsigned() as
    | { "m.relations"?: { "m.thread"?: { count?: number } } }
    | undefined;
  const serverCount = unsigned?.["m.relations"]?.["m.thread"]?.count ?? 0;

  const threadEvents = all.filter((ev) => {
    const rel = ev.getRelation();
    return rel?.rel_type === "m.thread" && rel.event_id === rootEventId;
  });

  const totalCount = Math.max(serverCount, threadEvents.length);
  const cacheKey = `${roomId}:${rootEventId}`;
  const cached = threadCache.get(cacheKey);
  if (cached && cached.replyCount === threadEvents.length && cached.totalCount === totalCount) {
    return cached.state;
  }

  const state: ThreadPreviewState = { events: threadEvents.slice(-3), totalCount };
  threadCache.set(cacheKey, { replyCount: threadEvents.length, totalCount, state });
  return state;
}

function snapshotThreadFull(roomId: string, rootEventId: string): ThreadFullState {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!client || !room) return THREAD_FULL_EMPTY;

  const all = allRoomEvents(room);
  const root =
    all.find((ev) => ev.getId() === rootEventId) ??
    fetchedEvents.get(rootEventId) ??
    room.findEventById(rootEventId);

  let rootPending = false;
  if (!root) {
    ensureRootFetched(client, roomId, rootEventId);
    rootPending = true;
  }

  const unsigned = root?.getUnsigned() as
    | { "m.relations"?: { "m.thread"?: { count?: number } } }
    | undefined;
  const serverCount = unsigned?.["m.relations"]?.["m.thread"]?.count ?? 0;

  const threadEvents = all.filter((ev) => {
    const rel = ev.getRelation();
    return rel?.rel_type === "m.thread" && rel.event_id === rootEventId;
  });

  const totalCount = Math.max(serverCount, threadEvents.length);
  const cacheKey = `${roomId}:${rootEventId}`;
  const cached = threadFullCache.get(cacheKey);
  if (
    cached &&
    cached.replyCount === threadEvents.length &&
    cached.totalCount === totalCount &&
    cached.root === root &&
    cached.rootPending === rootPending
  ) {
    return cached.state;
  }

  const state: ThreadFullState = { root, rootPending, events: threadEvents, totalCount };
  threadFullCache.set(cacheKey, {
    replyCount: threadEvents.length,
    totalCount,
    root,
    rootPending,
    state,
  });
  return state;
}

function makeSubscribe(roomId: string) {
  return (cb: () => void) => {
    const client = MatrixClientPeg.safeGet();
    if (!client) return MatrixClientPeg.subscribe(cb);
    const onTimeline = (_ev: MatrixEvent, room?: Room) => {
      if (room?.roomId === roomId) cb();
    };
    const onRoom = (room: Room) => {
      if (room.roomId === roomId) cb();
    };
    client.on(RoomEvent.Timeline, onTimeline);
    client.on(ClientEvent.Room, onRoom);
    const room = client.getRoom(roomId);
    room?.on(RoomEvent.Timeline, onTimeline);
    fetchSubscribers.add(cb);
    const unsubPeg = MatrixClientPeg.subscribe(cb);
    return () => {
      client.off(RoomEvent.Timeline, onTimeline);
      client.off(ClientEvent.Room, onRoom);
      room?.off(RoomEvent.Timeline, onTimeline);
      fetchSubscribers.delete(cb);
      unsubPeg();
    };
  };
}

export function useTimeline(roomId: string): TimelineState {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshot(roomId),
    () => EMPTY,
  );
}

export function useThreadPreview(roomId: string, rootEventId: string): ThreadPreviewState {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshotThread(roomId, rootEventId),
    () => THREAD_EMPTY,
  );
}

export function useThread(roomId: string, rootEventId: string): ThreadFullState {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshotThreadFull(roomId, rootEventId),
    () => THREAD_FULL_EMPTY,
  );
}

export interface ToolCallStatus {
  status: string | null;
  content: string | null;
  /**
   * rawInput accumulated across the initial tool_call event and every
   * subsequent tool_call_update. Later events extend (rather than replace) the
   * input so a follow-up update that only sets `status` doesn't blow away
   * earlier fields like `url` or `command`.
   */
  rawInput: Record<string, unknown> | null;
  /** Timestamp of the latest tool_call or tool_call_update event for this id, or 0 if none. */
  latestUpdateTs: number;
}

const TOOL_CALL_EMPTY: ToolCallStatus = {
  status: null,
  content: null,
  rawInput: null,
  latestUpdateTs: 0,
};
const toolCallCache = new Map<
  string,
  { ts: number; status: string | null; rawInputKey: string; result: ToolCallStatus }
>();

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function snapshotToolCall(roomId: string, toolCallId: string): ToolCallStatus {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return TOOL_CALL_EMPTY;

  const all = allRoomEvents(room);
  let latestTs = -1;
  let latestStatus: string | null = null;
  let latestContent: string | null = null;
  let mergedInput: Record<string, unknown> | null = null;

  // Walk all events for this tool call in timeline order, accumulating
  // rawInput. ACP can deliver fields like `url` on the initial tool_call but
  // omit them on later tool_call_updates — overwriting would lose them.
  const relevant: Array<{ ts: number; ev: (typeof all)[number] }> = [];
  for (const ev of all) {
    const t = ev.getType();
    if (t !== "eco.zoon.tool_call" && t !== "eco.zoon.tool_call_update") continue;
    const c = ev.getContent() as { tool_call_id?: string };
    if (c.tool_call_id !== toolCallId) continue;
    relevant.push({ ts: ev.getTs(), ev });
  }
  relevant.sort((a, b) => a.ts - b.ts);

  for (const { ts, ev } of relevant) {
    const t = ev.getType();
    const c = ev.getContent() as {
      tool_call_id?: string;
      status?: string;
      content?: string;
      raw_input?: unknown;
    };
    if (isPlainObject(c.raw_input)) {
      mergedInput = { ...(mergedInput ?? {}), ...c.raw_input };
    }
    if (t === "eco.zoon.tool_call_update" && typeof c.status === "string") {
      if (ts >= latestTs) {
        latestTs = ts;
        latestStatus = c.status;
        latestContent = typeof c.content === "string" ? c.content : null;
      }
    }
  }

  const rawInputKey = mergedInput ? JSON.stringify(mergedInput) : "";
  const cacheKey = `${roomId}:${toolCallId}`;
  const cached = toolCallCache.get(cacheKey);
  if (
    cached &&
    cached.ts === latestTs &&
    cached.status === latestStatus &&
    cached.rawInputKey === rawInputKey
  ) {
    return cached.result;
  }
  const result: ToolCallStatus = {
    status: latestStatus,
    content: latestContent,
    rawInput: mergedInput,
    latestUpdateTs: latestTs > 0 ? latestTs : 0,
  };
  toolCallCache.set(cacheKey, { ts: latestTs, status: latestStatus, rawInputKey, result });
  return result;
}

export function useToolCallStatus(roomId: string, toolCallId: string): ToolCallStatus {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshotToolCall(roomId, toolCallId),
    () => TOOL_CALL_EMPTY,
  );
}

export interface ToolCallApproval {
  toolInput: Record<string, unknown> | null;
  toolKind: string | null;
  toolTitle: string | null;
}

const TOOL_CALL_APPROVAL_EMPTY: ToolCallApproval = {
  toolInput: null,
  toolKind: null,
  toolTitle: null,
};
const toolCallApprovalCache = new Map<string, { eventId: string | undefined; result: ToolCallApproval }>();

function snapshotToolCallApproval(roomId: string, toolCallId: string): ToolCallApproval {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return TOOL_CALL_APPROVAL_EMPTY;

  const all = allRoomEvents(room);
  let approvalEv: MatrixEvent | undefined;
  for (const ev of all) {
    if (ev.getType() !== "eco.zoon.approval_request") continue;
    const c = ev.getContent() as { tool_call_id?: string };
    if (c.tool_call_id === toolCallId) {
      approvalEv = ev;
      // first match is fine; one approval per tool call
      break;
    }
  }

  const cacheKey = `${roomId}:${toolCallId}`;
  const cached = toolCallApprovalCache.get(cacheKey);
  const evId = approvalEv?.getId();
  if (cached && cached.eventId === evId) return cached.result;

  if (!approvalEv) {
    toolCallApprovalCache.set(cacheKey, { eventId: undefined, result: TOOL_CALL_APPROVAL_EMPTY });
    return TOOL_CALL_APPROVAL_EMPTY;
  }

  const c = approvalEv.getContent() as {
    tool_input?: unknown;
    tool_kind?: string;
    tool_title?: string;
  };
  const result: ToolCallApproval = {
    toolInput:
      c.tool_input && typeof c.tool_input === "object" && !Array.isArray(c.tool_input)
        ? (c.tool_input as Record<string, unknown>)
        : null,
    toolKind: typeof c.tool_kind === "string" ? c.tool_kind : null,
    toolTitle: typeof c.tool_title === "string" ? c.tool_title : null,
  };
  toolCallApprovalCache.set(cacheKey, { eventId: evId, result });
  return result;
}

export function useToolCallApproval(roomId: string, toolCallId: string): ToolCallApproval {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshotToolCallApproval(roomId, toolCallId),
    () => TOOL_CALL_APPROVAL_EMPTY,
  );
}
