import type { MatrixEvent } from "matrix-js-sdk";

export const ElicitationEventType = {
  Request: "dev.zooid.elicitation_request",
  Response: "dev.zooid.elicitation_response",
  Resolved: "dev.zooid.elicitation_resolved",
  Rejected: "dev.zooid.elicitation_rejected",
} as const;

export type ElicitationStatus = "accepted" | "declined" | "cancelled" | "interrupted";
const STATUSES = new Set<string>(["accepted", "declined", "cancelled", "interrupted"]);

export interface ElicitationRequestView {
  requestId: string;
  requestEventId: string;
  sessionId: string;
  toolCallId?: string;
  message: string;
  /** The ACP schema, untouched. Untrusted display data. */
  requestedSchema: Record<string, unknown>;
  sender: string;
  threadRoot?: string;
}

export interface ElicitationResolutionView {
  requestId: string;
  status: ElicitationStatus;
  respondedBy?: string;
  reason?: string;
  content?: Record<string, unknown>;
}

export interface ElicitationRejectionView {
  reason: "invalid" | "stale";
  errors?: Record<string, string>;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function threadRootOf(ev: MatrixEvent): string | undefined {
  const rel = ev.getRelation();
  return rel?.rel_type === "m.thread" && rel.event_id ? rel.event_id : undefined;
}

export function decodeElicitationRequest(ev: MatrixEvent): ElicitationRequestView | null {
  if (ev.getType() !== ElicitationEventType.Request) return null;
  const c = ev.getContent() as Record<string, unknown>;
  const id = ev.getId();
  const sender = ev.getSender();
  if (!id || !sender) return null;
  if (typeof c.request_id !== "string" || typeof c.session_id !== "string") return null;
  if (typeof c.message !== "string" || !isObj(c.requested_schema)) return null;
  const threadRoot = threadRootOf(ev);
  return {
    requestId: c.request_id,
    requestEventId: id,
    sessionId: c.session_id,
    ...(typeof c.tool_call_id === "string" ? { toolCallId: c.tool_call_id } : {}),
    message: c.message,
    requestedSchema: c.requested_schema,
    sender,
    ...(threadRoot ? { threadRoot } : {}),
  };
}

export function decodeElicitationResolved(ev: MatrixEvent): ElicitationResolutionView | null {
  if (ev.getType() !== ElicitationEventType.Resolved) return null;
  const c = ev.getContent() as Record<string, unknown>;
  if (typeof c.request_id !== "string" || typeof c.status !== "string" || !STATUSES.has(c.status)) return null;
  return {
    requestId: c.request_id,
    status: c.status as ElicitationStatus,
    respondedBy: typeof c.responded_by === "string" ? c.responded_by : undefined,
    reason: typeof c.reason === "string" ? c.reason : undefined,
    ...(isObj(c.content) ? { content: c.content } : {}),
  };
}

/** Only the requesting agent can close its own question. */
export function findElicitationResolution(
  events: MatrixEvent[],
  requestId: string,
  agentSender: string,
  request?: ElicitationRequestView,
): ElicitationResolutionView | null {
  for (const ev of events) {
    if (ev.getSender() !== agentSender) continue;
    if (request && (ev.getContent().request_event_id !== request.requestEventId || threadRootOf(ev) !== request.threadRoot)) continue;
    const r = decodeElicitationResolved(ev);
    if (r && r.requestId === requestId) return r;
  }
  return null;
}

export function findElicitationRejection(
  events: MatrixEvent[],
  requestId: string,
  responseEventId: string,
  agentSender: string,
  request?: ElicitationRequestView,
): ElicitationRejectionView | null {
  for (const ev of events) {
    if (ev.getType() !== ElicitationEventType.Rejected || ev.getSender() !== agentSender) continue;
    const c = ev.getContent() as Record<string, unknown>;
    if (c.request_id !== requestId || c.response_event_id !== responseEventId) continue;
    if (request && (c.request_event_id !== request.requestEventId || threadRootOf(ev) !== request.threadRoot)) continue;
    if (c.reason !== "invalid" && c.reason !== "stale") continue;
    const errors = isObj(c.errors)
      ? Object.fromEntries(Object.entries(c.errors).filter(([, v]) => typeof v === "string")) as Record<string, string>
      : undefined;
    return { reason: c.reason, ...(errors ? { errors } : {}) };
  }
  return null;
}

/** Agents that asked a question nobody has resolved yet, in first-asked order. */
export function openElicitationSenders(events: MatrixEvent[]): string[] {
  const open = new Map<string, string>(); // requestId → sender
  for (const ev of events) {
    const req = decodeElicitationRequest(ev);
    if (req) {
      open.set(req.requestId, req.sender);
      continue;
    }
    const res = decodeElicitationResolved(ev);
    if (res && open.get(res.requestId) === ev.getSender()) open.delete(res.requestId);
  }
  return [...new Set(open.values())];
}
