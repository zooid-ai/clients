import type { MatrixEvent } from "matrix-js-sdk";

export const EcoZoonEventType = {
  SessionStart: "eco.zoon.session.start",
  TurnStart: "eco.zoon.turn.start",
  MessageChunk: "eco.zoon.message_chunk",
  ToolCall: "eco.zoon.tool_call",
  ToolCallUpdate: "eco.zoon.tool_call_update",
  Plan: "eco.zoon.plan",
  TurnEnd: "eco.zoon.turn.end",
} as const;

export type DecodedEcoZoonEvent =
  | { kind: "session.start"; sessionId: string }
  | { kind: "turn.start"; sessionId: string }
  | { kind: "message_chunk"; sessionId: string; content: string }
  | {
      kind: "tool_call";
      sessionId: string;
      toolCallId: string;
      title: string;
      toolKind: string;
    }
  | {
      kind: "tool_call_update";
      sessionId: string;
      toolCallId: string;
      status: string;
      content?: string;
    }
  | {
      kind: "plan";
      sessionId: string;
      entries: Array<{ id: string; title: string; status: string }>;
    }
  | { kind: "turn.end"; sessionId: string; stopReason?: string };

const lifecycleTypes: ReadonlySet<string> = new Set(Object.values(EcoZoonEventType));

export function isEcoZoonLifecycle(ev: MatrixEvent): boolean {
  return lifecycleTypes.has(ev.getType());
}

export function isMessageChunk(ev: MatrixEvent): boolean {
  return ev.getType() === EcoZoonEventType.MessageChunk;
}

export function isToolCall(ev: MatrixEvent): boolean {
  return ev.getType() === EcoZoonEventType.ToolCall;
}

export function isTurnEnd(ev: MatrixEvent): boolean {
  return ev.getType() === EcoZoonEventType.TurnEnd;
}

export function decodeEcoZoonEvent(ev: MatrixEvent): DecodedEcoZoonEvent | null {
  const c = ev.getContent() as Record<string, unknown>;
  const sessionId = typeof c.session_id === "string" ? c.session_id : null;
  if (!sessionId) return null;

  switch (ev.getType()) {
    case EcoZoonEventType.SessionStart:
      return { kind: "session.start", sessionId };

    case EcoZoonEventType.TurnStart:
      return { kind: "turn.start", sessionId };

    case EcoZoonEventType.MessageChunk: {
      if (typeof c.content !== "string") return null;
      return { kind: "message_chunk", sessionId, content: c.content };
    }

    case EcoZoonEventType.ToolCall: {
      const toolCallId = typeof c.tool_call_id === "string" ? c.tool_call_id : null;
      const title = typeof c.title === "string" ? c.title : null;
      const toolKind = typeof c.kind === "string" ? c.kind : null;
      if (!toolCallId || !title || !toolKind) return null;
      return { kind: "tool_call", sessionId, toolCallId, title, toolKind };
    }

    case EcoZoonEventType.ToolCallUpdate: {
      const toolCallId = typeof c.tool_call_id === "string" ? c.tool_call_id : null;
      const status = typeof c.status === "string" ? c.status : null;
      if (!toolCallId || !status) return null;
      return {
        kind: "tool_call_update",
        sessionId,
        toolCallId,
        status,
        content: typeof c.content === "string" ? c.content : undefined,
      };
    }

    case EcoZoonEventType.Plan: {
      if (!Array.isArray(c.entries)) return null;
      const entries = (c.entries as unknown[])
        .map((e) => {
          if (!e || typeof e !== "object") return null;
          const r = e as Record<string, unknown>;
          if (
            typeof r.id !== "string" ||
            typeof r.title !== "string" ||
            typeof r.status !== "string"
          )
            return null;
          return { id: r.id, title: r.title, status: r.status };
        })
        .filter((e): e is { id: string; title: string; status: string } => e !== null);
      return { kind: "plan", sessionId, entries };
    }

    case EcoZoonEventType.TurnEnd:
      return {
        kind: "turn.end",
        sessionId,
        stopReason: typeof c.stop_reason === "string" ? c.stop_reason : undefined,
      };

    default:
      return null;
  }
}
