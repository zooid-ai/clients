import type { MatrixEvent } from "matrix-js-sdk";

export const ApprovalEventType = {
  Request: "eco.zoon.approval_request",
  Response: "eco.zoon.approval_response",
} as const;

export type ApprovalDecision = "allow" | "cancel";

export interface ApprovalRequest {
  approvalId: string;
  sessionId: string;
  toolCallId: string;
  options: Array<{ id: string; label: string }>;
}

export interface ApprovalResponse {
  approvalId: string;
  decision: ApprovalDecision;
  optionId?: string;
  respondedBy: string;
}

export function decodeApprovalRequest(ev: MatrixEvent): ApprovalRequest | null {
  if (ev.getType() !== ApprovalEventType.Request) return null;
  const c = ev.getContent() as Record<string, unknown>;
  if (typeof c.approval_id !== "string") return null;
  if (typeof c.session_id !== "string") return null;
  if (typeof c.tool_call_id !== "string") return null;
  const optsRaw = Array.isArray(c.options) ? (c.options as unknown[]) : [];
  const options = optsRaw
    .map((o) => {
      if (!o || typeof o !== "object") return null;
      const r = o as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.label !== "string") return null;
      return { id: r.id, label: r.label };
    })
    .filter((o): o is { id: string; label: string } => o !== null);
  return {
    approvalId: c.approval_id,
    sessionId: c.session_id,
    toolCallId: c.tool_call_id,
    options,
  };
}

export function decodeApprovalResponse(ev: MatrixEvent): ApprovalResponse | null {
  if (ev.getType() !== ApprovalEventType.Response) return null;
  const c = ev.getContent() as Record<string, unknown>;
  if (typeof c.approval_id !== "string") return null;
  if (c.decision !== "allow" && c.decision !== "cancel") return null;
  return {
    approvalId: c.approval_id,
    decision: c.decision,
    optionId: typeof c.option_id === "string" ? c.option_id : undefined,
    respondedBy: ev.getSender() ?? "?",
  };
}

export function findResolvingResponse(
  events: MatrixEvent[],
  approvalId: string,
): ApprovalResponse | null {
  for (const ev of events) {
    const decoded = decodeApprovalResponse(ev);
    if (decoded && decoded.approvalId === approvalId) return decoded;
  }
  return null;
}
