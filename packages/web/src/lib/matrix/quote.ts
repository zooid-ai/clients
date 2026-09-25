import type { MatrixEvent } from "matrix-js-sdk";
import { buildThreadLink, threadRootOf } from "./permalinks";

/** Namespaced like dev.zooid.thread_start (ZNC030). */
export const QUOTE_FIELD = "dev.zooid.quote";
export const QUOTE_SNAPSHOT_MAX = 4000;

export interface QuoteSnapshot {
  msgtype: string;
  body: string;
  format?: "org.matrix.custom.html";
  formatted_body?: string;
}

export interface QuoteRef {
  room_id: string;
  event_id: string;
  thread_id: string;
  sender: string;
  origin_server_ts: number;
  snapshot: QuoteSnapshot;
  thread?: { reply_count: number };
}

interface SourceContent {
  msgtype?: string;
  body?: string;
  format?: string;
  formatted_body?: string;
}

export function buildQuoteRef(
  event: MatrixEvent,
  opts: { content?: SourceContent; replyCount?: number } = {},
): QuoteRef {
  const c = opts.content ?? (event.getContent() as SourceContent);
  const eventId = event.getId() ?? "";
  const threadId = threadRootOf(event);
  const body = c.body ?? "";
  const truncated = body.length > QUOTE_SNAPSHOT_MAX;
  const snapshot: QuoteSnapshot = {
    msgtype: c.msgtype ?? "m.text",
    body: truncated ? `${body.slice(0, QUOTE_SNAPSHOT_MAX - 1)}…` : body,
  };
  // Keep the HTML only when it matches the body we kept; never cut HTML mid-tag.
  if (!truncated && c.format === "org.matrix.custom.html" && c.formatted_body) {
    snapshot.format = "org.matrix.custom.html";
    snapshot.formatted_body = c.formatted_body;
  }
  const ref: QuoteRef = {
    room_id: event.getRoomId() ?? "",
    event_id: eventId,
    thread_id: threadId,
    sender: event.getSender() ?? "",
    origin_server_ts: event.getTs(),
    snapshot,
  };
  if (threadId === eventId && (opts.replyCount ?? 0) > 0) {
    ref.thread = { reply_count: opts.replyCount! };
  }
  return ref;
}

/** UTC so the fallback reads the same for every recipient, agents included. */
export function formatQuoteTime(ts: number): string {
  return `${new Date(ts).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function buildQuoteFallback(q: QuoteRef, senderName: string, origin: string): string {
  const link = buildThreadLink(origin, { roomId: q.room_id, threadId: q.thread_id, eventId: q.event_id });
  const header = `> ${senderName} · ${formatQuoteTime(q.origin_server_ts)} · ${link}`;
  const lines = q.snapshot.body.split("\n").map((l) => (l ? `> ${l}` : ">"));
  return [header, ...lines].join("\n");
}

export function joinQuoteFallback(comment: string, fallback: string): string {
  return comment ? `${comment}\n\n${fallback}` : fallback;
}

export function buildQuoteContent(opts: {
  comment: string;
  quote: QuoteRef;
  senderName: string;
  origin: string;
}): Record<string, unknown> {
  return {
    msgtype: "m.text",
    body: joinQuoteFallback(
      opts.comment.trim(),
      buildQuoteFallback(opts.quote, opts.senderName, opts.origin),
    ),
    // Always present, even empty: the quoted text must never be scanned for
    // mentions by receivers that fall back to the plain body.
    "m.mentions": {},
    [QUOTE_FIELD]: opts.quote,
  };
}

/**
 * The fallback is the trailing run of ">" lines after a blank line, or the
 * whole body for a bare quote. Prefer the shortest trailing run, so a comment
 * that has its own blockquote survives.
 */
export function splitQuoteFallback(body: string): { comment: string; fallback: string } {
  const starts: number[] = [];
  const i = body.lastIndexOf("\n\n> ");
  if (i >= 0) starts.push(i + 2);
  if (body.startsWith("> ")) starts.push(0);
  for (const start of starts) {
    const fallback = body.slice(start);
    if (fallback.split("\n").every((l) => l.startsWith(">"))) {
      return { comment: start === 0 ? "" : body.slice(0, start - 2), fallback };
    }
  }
  return { comment: body, fallback: "" };
}

export function readQuoteRef(content: unknown): QuoteRef | null {
  if (!content || typeof content !== "object") return null;
  const q = (content as Record<string, unknown>)[QUOTE_FIELD] as Partial<QuoteRef> | undefined;
  if (!q || typeof q !== "object") return null;
  if (
    typeof q.room_id !== "string" ||
    typeof q.event_id !== "string" ||
    typeof q.thread_id !== "string" ||
    typeof q.sender !== "string" ||
    typeof q.origin_server_ts !== "number" ||
    !q.snapshot ||
    typeof q.snapshot.body !== "string"
  ) {
    return null;
  }
  return q as QuoteRef;
}
