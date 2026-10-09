import {
  ClientEvent,
  Direction,
  type EventTimeline,
  type IEvent,
  type MatrixClient,
  MatrixEvent,
  type Room,
  RoomEvent,
} from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { ElicitationEventType, openElicitationSenders } from "../events/elicitation";
import { MatrixClientPeg } from "../client/peg";
import { extractToolCallContent, type DiffBlock } from "../events/zooid-events";

interface TimelineState {
  events: MatrixEvent[];
  /** Root event_ids referenced by thread replies that aren't yet in any local timeline. */
  pendingRootIds: string[];
  /**
   * Ids of rendered events that begin a stretch of timeline the SDK could not
   * join to what came before it. Everything above such an event is older, but
   * not adjacent — messages are missing in between and have to be paginated in.
   */
  gapBeforeEventIds: string[];
  /**
   * `id:status` of every local echo. A status change (SENDING → NOT_SENT →
   * SENDING → sent) mutates the same MatrixEvent in place, so without this the
   * cached snapshot would look unchanged and the tile would never repaint.
   */
  echoKey: string;
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
  /**
   * Ids of replies preceded by a hole the SDK could not join, between the
   * root and that reply. Same discontinuity rule as the room's
   * gapBeforeEventIds, applied to the thread's projection.
   */
  gapBeforeEventIds: string[];
}

const EMPTY: TimelineState = { events: [], pendingRootIds: [], gapBeforeEventIds: [], echoKey: "" };
const THREAD_EMPTY: ThreadPreviewState = { events: [], totalCount: 0 };
const THREAD_FULL_EMPTY: ThreadFullState = {
  root: undefined,
  rootPending: false,
  events: [],
  totalCount: 0,
  gapBeforeEventIds: [],
};

const snapshotCache = new WeakMap<Room, TimelineState>();

const threadCache = new Map<
  string,
  { replyCount: number; totalCount: number; state: ThreadPreviewState }
>();

const threadFullCache = new Map<
  string,
  { replyCount: number; totalCount: number; root: MatrixEvent | undefined; rootPending: boolean; gapKey: string; state: ThreadFullState }
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

export function allRoomEvents(room: Room): MatrixEvent[] {
  // getLiveTimeline() only covers the current window. After a limited sync,
  // older events live in historical timelines within the same set — which is
  // true only because the peg creates the client with timelineSupport: true.
  // Without it the SDK drops those timelines outright and this loop would
  // never see more than one.
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

/** The room's non-empty unfiltered timelines, ordered by their first event. */
function timelinesOldestFirst(room: Room): EventTimeline[] {
  return room
    .getUnfilteredTimelineSet()
    .getTimelines()
    .filter((tl) => tl.getEvents().length > 0)
    .sort((a, b) => a.getEvents()[0].getTs() - b.getEvents()[0].getTs());
}

/**
 * The timeline that owns the start of loaded history — the one "Load more"
 * must paginate. After a gappy sync the live timeline is the far side of a
 * hole, and joining it to an older one nulls its backward token, so it says
 * nothing about whether older history remains. Falls back to the live timeline
 * while the room has no events yet.
 */
export function oldestTimeline(room: Room): EventTimeline {
  return timelinesOldestFirst(room)[0] ?? room.getLiveTimeline();
}

/**
 * Timelines that start after a hole in the room's history.
 *
 * A gappy ("limited: true") sync forks a new timeline and leaves the previous
 * one in the set, unjoined — the events either side are contiguous once
 * allRoomEvents() sorts them by timestamp, but there are messages missing in
 * between. The SDK marks the boundary two ways: the later timeline has no
 * backward neighbour (nothing has been paginated across yet) and it still
 * carries a backward pagination token (there is something to fetch).
 *
 * The oldest timeline is excluded on purpose. It has both properties too, but
 * its backward token is simply the start of loaded history — that is what the
 * "Load more" button at the top of the panel is for, not a hole.
 */
function gapStartTimelines(room: Room): Set<EventTimeline> {
  const timelines = timelinesOldestFirst(room);

  const out = new Set<EventTimeline>();
  for (let i = 1; i < timelines.length; i++) {
    const tl = timelines[i];
    if (tl.getNeighbouringTimeline(Direction.Backward)) continue;
    if (tl.getPaginationToken(Direction.Backward) === null) continue;
    out.add(tl);
  }
  return out;
}

/**
 * Where a thread's gap markers go. The room's gap-start timelines, projected
 * onto the thread: a hole only counts if it starts after the root, and it is
 * anchored to the first rendered reply in that timeline *or any later one*.
 * The stretch right after the hole may hold no reply of this thread, while
 * one further down still sits on the far side of it. Holes that resolve to
 * the same reply show as one marker. A hole with no rendered reply after it
 * has nothing to anchor to.
 */
function threadGapBeforeEventIds(
  room: Room,
  root: MatrixEvent | undefined,
  replies: MatrixEvent[],
): string[] {
  const gaps = gapStartTimelines(room);
  if (!root || gaps.size === 0) return [];
  const order = timelinesOldestFirst(room);
  const timelineSet = room.getUnfilteredTimelineSet();
  const rank = (ev: MatrixEvent) => {
    const id = ev.getId();
    const tl = id ? timelineSet.getTimelineForEvent(id) : null;
    return tl ? order.indexOf(tl) : -1;
  };
  const anchors = new Set<string>();
  for (const gap of gaps) {
    // A hole at or before the root has nothing of this thread above it.
    if (gap.getEvents()[0].getTs() <= root.getTs()) continue;
    const gapRank = order.indexOf(gap);
    const id = replies.find((ev) => rank(ev) >= gapRank)?.getId();
    if (id) anchors.add(id);
  }
  return replies
    .map((ev) => ev.getId())
    .filter((id): id is string => !!id && anchors.has(id));
}

/**
 * Where the room's gap markers go: before the first rendered event below the
 * hole. Requiring the anchor to sit *in* the timeline after the hole drops the
 * marker in agent rooms, where that stretch is often all thread replies
 * (filtered out of the room view) and the roots that do render were fetched on
 * their own and sit in no timeline. So an event in a timeline counts if that
 * timeline is the gap's or a later one, and a fetched root counts if it is
 * newer than everything loaded above the hole. Holes that resolve to the same
 * event show as one marker; a hole with nothing rendered below it has nothing
 * to anchor to.
 */
function roomGapBeforeEventIds(room: Room, events: MatrixEvent[]): string[] {
  const gaps = gapStartTimelines(room);
  if (gaps.size === 0) return [];
  const order = timelinesOldestFirst(room);
  const timelineSet = room.getUnfilteredTimelineSet();
  const anchors = new Set<string>();
  for (const gap of gaps) {
    const gapRank = order.indexOf(gap);
    // gapStartTimelines never returns the oldest timeline, so this is non-empty.
    const holeStart = Math.max(
      ...order.slice(0, gapRank).map((tl) => tl.getEvents().at(-1)!.getTs()),
    );
    const below = (ev: MatrixEvent) => {
      const id = ev.getId();
      const tl = id ? timelineSet.getTimelineForEvent(id) : null;
      return tl ? order.indexOf(tl) >= gapRank : ev.getTs() > holeStart;
    };
    const id = events.find(below)?.getId();
    if (id) anchors.add(id);
  }
  return events
    .map((ev) => ev.getId())
    .filter((id): id is string => !!id && anchors.has(id));
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

  const gapBeforeEventIds = roomGapBeforeEventIds(room, events);

  const echoKey = events
    .filter((ev) => ev.status)
    .map((ev) => `${ev.getId()}:${ev.status}`)
    .join(",");

  const cached = snapshotCache.get(room);
  if (
    cached &&
    cached.echoKey === echoKey &&
    cached.events.length === events.length &&
    cached.events[events.length - 1] === events[events.length - 1] &&
    cached.pendingRootIds.length === pendingRootIds.length &&
    cached.pendingRootIds.every((id, i) => id === pendingRootIds[i]) &&
    cached.gapBeforeEventIds.length === gapBeforeEventIds.length &&
    cached.gapBeforeEventIds.every((id, i) => id === gapBeforeEventIds[i])
  ) {
    return cached;
  }
  const next = { events, pendingRootIds, gapBeforeEventIds, echoKey };
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
  const gapBeforeEventIds = threadGapBeforeEventIds(room, root, threadEvents);
  // A join adds no reply, so the reply count alone can't tell a stale snapshot.
  const gapKey = gapBeforeEventIds.join(",");
  const cacheKey = `${roomId}:${rootEventId}`;
  const cached = threadFullCache.get(cacheKey);
  if (
    cached &&
    cached.replyCount === threadEvents.length &&
    cached.totalCount === totalCount &&
    cached.root === root &&
    cached.rootPending === rootPending &&
    cached.gapKey === gapKey
  ) {
    return cached.state;
  }

  const state: ThreadFullState = {
    root,
    rootPending,
    events: threadEvents,
    totalCount,
    gapBeforeEventIds,
  };
  threadFullCache.set(cacheKey, {
    replyCount: threadEvents.length,
    totalCount,
    root,
    rootPending,
    gapKey,
    state,
  });
  return state;
}

export function makeSubscribe(roomId: string) {
  return (cb: () => void) => {
    const client = MatrixClientPeg.safeGet();
    if (!client) return MatrixClientPeg.subscribe(cb);
    const onTimeline = (_ev: MatrixEvent, room?: Room) => {
      if (room?.roomId === roomId) cb();
    };
    const onRoom = (room: Room) => {
      if (room.roomId === roomId) cb();
    };
    // A gappy sync makes the SDK rebuild the timeline set without emitting a
    // single Timeline event. Without this listener the store keeps serving a
    // snapshot of events that are no longer in the room, then collapses at
    // whatever unrelated event happens to arrive next.
    const onTimelineReset = (room?: Room) => {
      if (room?.roomId === roomId) cb();
    };
    // Fires when a local echo's status changes or it is cancelled or
    // resent; the event is mutated in place so no Timeline event follows.
    const onLocalEcho = (_ev: MatrixEvent, room: Room) => {
      if (room.roomId === roomId) cb();
    };
    client.on(RoomEvent.Timeline, onTimeline);
    client.on(RoomEvent.TimelineReset, onTimelineReset);
    client.on(ClientEvent.Room, onRoom);
    const room = client.getRoom(roomId);
    room?.on(RoomEvent.Timeline, onTimeline);
    room?.on(RoomEvent.TimelineReset, onTimelineReset);
    room?.on(RoomEvent.LocalEchoUpdated, onLocalEcho);
    fetchSubscribers.add(cb);
    const unsubPeg = MatrixClientPeg.subscribe(cb);
    return () => {
      client.off(RoomEvent.Timeline, onTimeline);
      client.off(RoomEvent.TimelineReset, onTimelineReset);
      client.off(ClientEvent.Room, onRoom);
      room?.off(RoomEvent.Timeline, onTimeline);
      room?.off(RoomEvent.TimelineReset, onTimelineReset);
      room?.off(RoomEvent.LocalEchoUpdated, onLocalEcho);
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
  diffs: DiffBlock[];
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
  diffs: [],
  rawInput: null,
  latestUpdateTs: 0,
};
const toolCallCache = new Map<
  string,
  { ts: number; status: string | null; rawInputKey: string; diffKey: number; result: ToolCallStatus }
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
  let latestDiffs: DiffBlock[] = [];
  let mergedInput: Record<string, unknown> | null = null;

  // Walk all events for this tool call in timeline order, accumulating
  // rawInput. ACP can deliver fields like `url` on the initial tool_call but
  // omit them on later tool_call_updates — overwriting would lose them.
  const relevant: Array<{ ts: number; ev: (typeof all)[number] }> = [];
  for (const ev of all) {
    const t = ev.getType();
    if (t !== "dev.zooid.tool_call" && t !== "dev.zooid.tool_call_update") continue;
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
      content?: unknown;
      raw_input?: unknown;
    };
    if (isPlainObject(c.raw_input)) {
      mergedInput = { ...(mergedInput ?? {}), ...c.raw_input };
    }
    if (t === "dev.zooid.tool_call_update" && typeof c.status === "string") {
      if (ts >= latestTs) {
        latestTs = ts;
        latestStatus = c.status;
        const parts = extractToolCallContent(c.content);
        latestContent = parts.text;
        latestDiffs = parts.diffs;
      }
    }
  }

  const rawInputKey = mergedInput ? JSON.stringify(mergedInput) : "";
  const diffKey = latestDiffs.length;
  const cacheKey = `${roomId}:${toolCallId}`;
  const cached = toolCallCache.get(cacheKey);
  if (
    cached &&
    cached.ts === latestTs &&
    cached.status === latestStatus &&
    cached.rawInputKey === rawInputKey &&
    cached.diffKey === diffKey
  ) {
    return cached.result;
  }
  const result: ToolCallStatus = {
    status: latestStatus,
    content: latestContent,
    diffs: latestDiffs,
    rawInput: mergedInput,
    latestUpdateTs: latestTs > 0 ? latestTs : 0,
  };
  toolCallCache.set(cacheKey, { ts: latestTs, status: latestStatus, rawInputKey, diffKey, result });
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
    if (ev.getType() !== "dev.zooid.approval_request") continue;
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


const NO_EVENTS: MatrixEvent[] = [];
const NO_USERS: string[] = [];
const trailCache = new Map<string, { room: Room; key: string; value: MatrixEvent[] }>();
const awaitingCache = new Map<string, { key: string; value: string[] }>();

function snapshotElicitationTrail(roomId: string, requestId: string): MatrixEvent[] {
  const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
  if (!room || !requestId) return NO_EVENTS;
  const hits = allRoomEvents(room).filter(
    (ev) =>
      (ev.getType() === ElicitationEventType.Resolved || ev.getType() === ElicitationEventType.Rejected) &&
      (ev.getContent() as { request_id?: unknown }).request_id === requestId,
  );
  const key = `${hits.length}:${hits.map((e) => e.getId()).join(",")}`;
  const cacheKey = `${roomId}|${requestId}`;
  const prev = trailCache.get(cacheKey);
  if (prev && prev.room === room && prev.key === key) return prev.value;
  const value = hits.length > 0 ? hits : NO_EVENTS;
  trailCache.set(cacheKey, { room, key, value });
  return value;
}

/** Resolved/rejected events for one question, thread-related ones included. */
export function useElicitationTrail(roomId: string, requestId: string): MatrixEvent[] {
  return useSyncExternalStore(
    makeSubscribe(roomId),
    () => snapshotElicitationTrail(roomId, requestId),
    () => NO_EVENTS,
  );
}

function snapshotAwaiting(roomId: string): string[] {
  const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
  if (!room) return NO_USERS;
  const senders = openElicitationSenders(
    allRoomEvents(room).filter(
      (ev) => ev.getType() === ElicitationEventType.Request || ev.getType() === ElicitationEventType.Resolved,
    ),
  );
  const key = senders.join(",");
  const prev = awaitingCache.get(roomId);
  if (prev && prev.key === key) return prev.value;
  const value = senders.length > 0 ? senders : NO_USERS;
  awaitingCache.set(roomId, { key, value });
  return value;
}

/** Agents in this room waiting on a human answer. */
export function useAwaitingInput(roomId: string): string[] {
  return useSyncExternalStore(makeSubscribe(roomId), () => snapshotAwaiting(roomId), () => NO_USERS);
}
