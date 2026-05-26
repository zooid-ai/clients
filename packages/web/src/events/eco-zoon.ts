import type { MatrixEvent } from "matrix-js-sdk";

export const EcoZoonEventType = {
  SessionStart: "eco.zoon.session.start",
  TurnStart: "eco.zoon.turn.start",
  AgentMessageChunk: "eco.zoon.agent_message_chunk",
  ToolCall: "eco.zoon.tool_call",
  ToolCallUpdate: "eco.zoon.tool_call_update",
  Plan: "eco.zoon.plan",
  TurnEnd: "eco.zoon.turn.end",
  Error: "eco.zoon.error",
} as const;

export interface ToolLocation {
  path: string;
  line?: number;
}

export type DecodedEcoZoonEvent =
  | { kind: "session.start"; sessionId: string }
  | { kind: "turn.start"; sessionId: string }
  | { kind: "agent_message_chunk"; sessionId: string; content: string }
  | {
      kind: "tool_call";
      sessionId: string;
      toolCallId: string;
      title: string;
      toolKind: string;
      rawInput?: Record<string, unknown>;
      locations?: ToolLocation[];
    }
  | {
      kind: "tool_call_update";
      sessionId: string;
      toolCallId: string;
      status: string;
      content?: string;
      rawInput?: Record<string, unknown>;
      locations?: ToolLocation[];
    }
  | {
      kind: "plan";
      sessionId: string;
      entries: Array<{ id: string; title: string; status: string }>;
    }
  | { kind: "turn.end"; sessionId: string; stopReason?: string }
  | {
      kind: "error";
      sessionId: string | null;
      turnId: string | null;
      code: string;
      message: string;
      detail?: string;
      transient: boolean;
      acpError?: { code: number; message: string; data?: unknown };
      recovery?: string;
    };

const lifecycleTypes: ReadonlySet<string> = new Set(Object.values(EcoZoonEventType));

export function isEcoZoonLifecycle(ev: MatrixEvent): boolean {
  return lifecycleTypes.has(ev.getType());
}

export function isAgentMessageChunk(ev: MatrixEvent): boolean {
  return ev.getType() === EcoZoonEventType.AgentMessageChunk;
}

export function isToolCall(ev: MatrixEvent): boolean {
  return ev.getType() === EcoZoonEventType.ToolCall;
}

export function isTurnEnd(ev: MatrixEvent): boolean {
  return ev.getType() === EcoZoonEventType.TurnEnd;
}

export function decodeEcoZoonEvent(ev: MatrixEvent): DecodedEcoZoonEvent | null {
  const c = ev.getContent() as Record<string, unknown>;
  const type = ev.getType();

  // Error events allow sessionId to be null (pre-turn failures).
  if (type === EcoZoonEventType.Error) {
    if (typeof c.code !== "string" || typeof c.message !== "string") return null;
    return {
      kind: "error",
      sessionId: typeof c.session_id === "string" ? c.session_id : null,
      turnId: typeof c.turn_id === "string" ? c.turn_id : null,
      code: c.code,
      message: c.message,
      detail: typeof c.detail === "string" ? c.detail : undefined,
      transient: c.transient === true,
      acpError:
        c.acp_error && typeof c.acp_error === "object"
          ? (c.acp_error as { code: number; message: string; data?: unknown })
          : undefined,
      recovery: typeof c.recovery === "string" ? c.recovery : undefined,
    };
  }

  const sessionId = typeof c.session_id === "string" ? c.session_id : null;
  if (!sessionId) return null;

  switch (type) {
    case EcoZoonEventType.SessionStart:
      return { kind: "session.start", sessionId };

    case EcoZoonEventType.TurnStart:
      return { kind: "turn.start", sessionId };

    case EcoZoonEventType.AgentMessageChunk: {
      if (typeof c.content !== "string") return null;
      return { kind: "agent_message_chunk", sessionId, content: c.content };
    }

    case EcoZoonEventType.ToolCall: {
      const toolCallId = typeof c.tool_call_id === "string" ? c.tool_call_id : null;
      const title = typeof c.title === "string" ? c.title : null;
      const toolKind = typeof c.kind === "string" ? c.kind : null;
      if (!toolCallId || !title || !toolKind) return null;
      return {
        kind: "tool_call",
        sessionId,
        toolCallId,
        title,
        toolKind,
        rawInput: extractRawInput(c.raw_input),
        locations: extractLocations(c.locations),
      };
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
        content: extractContentText(c.content),
        rawInput: extractRawInput(c.raw_input),
        locations: extractLocations(c.locations),
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

function extractRawInput(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return undefined;
}

function extractLocations(v: unknown): ToolLocation[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const out: ToolLocation[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      if (typeof r.path === "string") {
        out.push({
          path: r.path,
          line: typeof r.line === "number" ? r.line : undefined,
        });
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

/**
 * tool_call_update.content is either a string (legacy) or an array of
 * structured content blocks per ACP. Concatenate text blocks for display.
 */
function extractContentText(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const texts: string[] = [];
  for (const block of v) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "content" && b.content && typeof b.content === "object") {
      const inner = b.content as Record<string, unknown>;
      if (inner.type === "text" && typeof inner.text === "string") {
        texts.push(inner.text);
      }
    }
  }
  return texts.length > 0 ? texts.join("\n") : undefined;
}
