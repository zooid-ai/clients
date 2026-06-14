import type { MatrixEvent } from "matrix-js-sdk";

export interface PlanBoardEntry {
  content: string;
  status: string;
  priority?: string;
}

/**
 * Normalize the `rawInput` of a planning tool call into board entries.
 * Claude `TodoWrite` / opencode `todowrite`: { todos: [{content,status,priority?}] }.
 * Codex `update_plan`: { plan: [{step,status}] }. Returns null when the input
 * is not a recognized planning payload.
 */
export function planEntriesFromToolInput(input: unknown): PlanBoardEntry[] | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (Array.isArray(r.todos)) {
    const entries = r.todos
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .filter((t) => typeof t.content === "string" && typeof t.status === "string")
      .map((t) => ({
        content: t.content as string,
        status: t.status as string,
        ...(typeof t.priority === "string" ? { priority: t.priority } : {}),
      }));
    return entries.length > 0 ? entries : null;
  }
  if (Array.isArray(r.plan)) {
    const entries = r.plan
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .filter((p) => typeof p.step === "string" && typeof p.status === "string")
      .map((p) => ({ content: p.step as string, status: p.status as string }));
    return entries.length > 0 ? entries : null;
  }
  return null;
}

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

export interface DiffBlock {
  path: string;
  oldText: string;
  newText: string;
}

export interface ToolCallContentParts {
  text: string | null;
  diffs: DiffBlock[];
}

/**
 * Parse ACP `tool_call_update.content` (string legacy form, or a
 * ToolCallContent[] array) into display parts. Text blocks are concatenated;
 * `diff` blocks are kept structured. Unknown block types are ignored.
 */
export function extractToolCallContent(v: unknown): ToolCallContentParts {
  if (typeof v === "string") return { text: v, diffs: [] };
  if (!Array.isArray(v) || v.length === 0) return { text: null, diffs: [] };
  const texts: string[] = [];
  const diffs: DiffBlock[] = [];
  for (const block of v) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "content" && b.content && typeof b.content === "object") {
      const inner = b.content as Record<string, unknown>;
      if (inner.type === "text" && typeof inner.text === "string") texts.push(inner.text);
    } else if (b.type === "diff" && typeof b.path === "string" && typeof b.newText === "string") {
      diffs.push({
        path: b.path,
        oldText: typeof b.oldText === "string" ? b.oldText : "",
        newText: b.newText,
      });
    }
  }
  return { text: texts.length > 0 ? texts.join("\n") : null, diffs };
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
      diffs?: DiffBlock[];
      rawInput?: Record<string, unknown>;
      locations?: ToolLocation[];
    }
  | {
      kind: "plan";
      sessionId: string;
      entries: PlanBoardEntry[];
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
      const parts = extractToolCallContent(c.content);
      return {
        kind: "tool_call_update",
        sessionId,
        toolCallId,
        status,
        content: parts.text ?? undefined,
        diffs: parts.diffs.length > 0 ? parts.diffs : undefined,
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
          if (typeof r.content !== "string" || typeof r.status !== "string") return null;
          return {
            content: r.content,
            status: r.status,
            ...(typeof r.priority === "string" ? { priority: r.priority } : {}),
          } satisfies PlanBoardEntry;
        })
        .filter((e): e is PlanBoardEntry => e !== null);
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

