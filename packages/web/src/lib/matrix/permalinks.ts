import type { MatrixEvent } from "matrix-js-sdk";

/** Where a link points: always a thread, optionally one reply inside it. */
export interface ThreadTarget {
  roomId: string;
  threadId: string;
  eventId?: string;
}

/** The thread an event belongs to: its m.thread root, or itself. */
export function threadRootOf(event: MatrixEvent): string {
  const rel = (event.getContent() as { "m.relates_to"?: { rel_type?: string; event_id?: string } })[
    "m.relates_to"
  ];
  if (rel?.rel_type === "m.thread" && rel.event_id) return rel.event_id;
  return event.getId() ?? "";
}

export function threadTargetForEvent(event: MatrixEvent): ThreadTarget {
  const roomId = event.getRoomId() ?? "";
  const eventId = event.getId() ?? "";
  const threadId = threadRootOf(event);
  return threadId === eventId ? { roomId, threadId } : { roomId, threadId, eventId };
}

export function threadTargetPath(t: ThreadTarget): string {
  const params = new URLSearchParams({ thread: t.threadId });
  if (t.eventId && t.eventId !== t.threadId) params.set("event", t.eventId);
  return `/room/${encodeURIComponent(t.roomId)}?${params.toString()}`;
}

export function buildThreadLink(origin: string, t: ThreadTarget): string {
  return `${origin}${threadTargetPath(t)}`;
}

/**
 * Recognise links the client can open itself: its own /room/<id>?thread=…
 * URLs, and matrix.to event permalinks (which carry no thread, so the event
 * opens as a thread root). Anything else returns null.
 */
export function parseThreadLink(href: string, origin: string): ThreadTarget | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin === origin) {
    const m = /^\/room\/([^/]+)$/.exec(url.pathname);
    const threadId = url.searchParams.get("thread");
    if (!m || !threadId) return null;
    const roomId = decodeURIComponent(m[1]);
    const eventId = url.searchParams.get("event");
    return eventId && eventId !== threadId ? { roomId, threadId, eventId } : { roomId, threadId };
  }
  if (url.hostname === "matrix.to") {
    const [room, ev] = url.hash.replace(/^#\/?/, "").split("?")[0].split("/").map(decodeURIComponent);
    if (!room?.startsWith("!") || !ev?.startsWith("$")) return null;
    return { roomId: room, threadId: ev };
  }
  return null;
}
