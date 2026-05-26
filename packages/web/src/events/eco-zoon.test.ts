import { describe, expect, it } from "vitest";
import { mkMatrixEvent } from "../../test/factories";
import {
  EcoZoonEventType,
  decodeEcoZoonEvent,
  isEcoZoonLifecycle,
  isAgentMessageChunk,
  isToolCall,
  isTurnEnd,
} from "./eco-zoon";


const room = "!r:h.example";
const sender = "@architect.acme:h.example";

describe("decodeEcoZoonEvent", () => {
  it("decodes session.start", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.SessionStart,
      content: { session_id: "s1" },
    });
    expect(decodeEcoZoonEvent(ev)).toEqual({ kind: "session.start", sessionId: "s1" });
  });

  it("decodes turn.start", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.TurnStart,
      content: { session_id: "s1" },
    });
    expect(decodeEcoZoonEvent(ev)).toEqual({ kind: "turn.start", sessionId: "s1" });
  });

  it("decodes agent_message_chunk", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.AgentMessageChunk,
      content: { session_id: "s1", content: "hello" },
    });
    expect(decodeEcoZoonEvent(ev)).toEqual({
      kind: "agent_message_chunk",
      sessionId: "s1",
      content: "hello",
    });
  });

  it("decodes tool_call", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.ToolCall,
      content: { session_id: "s1", tool_call_id: "tc1", title: "Bash", kind: "execute" },
    });
    expect(decodeEcoZoonEvent(ev)).toEqual({
      kind: "tool_call",
      sessionId: "s1",
      toolCallId: "tc1",
      title: "Bash",
      toolKind: "execute",
    });
  });

  it("decodes tool_call_update", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.ToolCallUpdate,
      content: {
        session_id: "s1",
        tool_call_id: "tc1",
        status: "in_progress",
        content: "running…",
      },
    });
    expect(decodeEcoZoonEvent(ev)).toEqual({
      kind: "tool_call_update",
      sessionId: "s1",
      toolCallId: "tc1",
      status: "in_progress",
      content: "running…",
    });
  });

  it("decodes plan", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.Plan,
      content: {
        session_id: "s1",
        entries: [{ id: "p1", title: "do the thing", status: "pending" }],
      },
    });
    expect(decodeEcoZoonEvent(ev)).toMatchObject({
      kind: "plan",
      sessionId: "s1",
      entries: [{ id: "p1", title: "do the thing", status: "pending" }],
    });
  });

  it("decodes turn.end", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.TurnEnd,
      content: { session_id: "s1", stop_reason: "end_turn" },
    });
    expect(decodeEcoZoonEvent(ev)).toEqual({
      kind: "turn.end",
      sessionId: "s1",
      stopReason: "end_turn",
    });
  });

  it("returns null for non-eco events", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: "m.room.message",
      content: { msgtype: "m.text", body: "hi" },
    });
    expect(decodeEcoZoonEvent(ev)).toBeNull();
  });

  it("returns null for malformed eco events (missing required field)", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.AgentMessageChunk,
      content: { session_id: "s1" },
    });
    expect(decodeEcoZoonEvent(ev)).toBeNull();
  });

  it("returns null for unknown eco.zoon.* type (forward-compat)", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: "eco.zoon.future_event",
      content: { session_id: "s1" },
    });
    expect(decodeEcoZoonEvent(ev)).toBeNull();
  });
});

describe("type guards", () => {
  it("isEcoZoonLifecycle accepts all 7 lifecycle types", () => {
    const types = [
      EcoZoonEventType.SessionStart,
      EcoZoonEventType.TurnStart,
      EcoZoonEventType.AgentMessageChunk,
      EcoZoonEventType.ToolCall,
      EcoZoonEventType.ToolCallUpdate,
      EcoZoonEventType.Plan,
      EcoZoonEventType.TurnEnd,
    ];
    for (const t of types) {
      const ev = mkMatrixEvent({ roomId: room, sender, type: t, content: { session_id: "s1" } });
      expect(isEcoZoonLifecycle(ev)).toBe(true);
    }
  });

  it("isEcoZoonLifecycle rejects approval events (those are PLAN-03)", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: "eco.zoon.approval_request",
      content: { approval_id: "a1" },
    });
    expect(isEcoZoonLifecycle(ev)).toBe(false);
  });

  it("isAgentMessageChunk / isToolCall / isTurnEnd narrow correctly", () => {
    const chunk = mkMatrixEvent({
      roomId: room,
      sender,
      type: EcoZoonEventType.AgentMessageChunk,
      content: { session_id: "s1", content: "x" },
    });
    expect(isAgentMessageChunk(chunk)).toBe(true);
    expect(isToolCall(chunk)).toBe(false);
    expect(isTurnEnd(chunk)).toBe(false);
  });
});

describe("decodeEcoZoonEvent — error (ZOD055)", () => {
  it("decodes eco.zoon.error with full payload", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: "eco.zoon.error",
      content: {
        session_id: "sess-1",
        turn_id: "turn-1",
        code: "auth_missing",
        message: "Authentication required",
        detail: "claude-agent-acp RequestError",
        transient: false,
        acp_error: { code: -32000, message: "Authentication required" },
        recovery: "https://zooid.dev/docs/guides/run-in-container#auth",
      },
    });
    expect(decodeEcoZoonEvent(ev)).toEqual({
      kind: "error",
      sessionId: "sess-1",
      turnId: "turn-1",
      code: "auth_missing",
      message: "Authentication required",
      detail: "claude-agent-acp RequestError",
      transient: false,
      acpError: { code: -32000, message: "Authentication required" },
      recovery: "https://zooid.dev/docs/guides/run-in-container#auth",
    });
  });

  it("returns null when code missing AND message missing (untyped junk)", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: "eco.zoon.error",
      content: {},
    });
    expect(decodeEcoZoonEvent(ev)).toBeNull();
  });

  it("allows session_id null (pre-turn error) when code+message present", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: "eco.zoon.error",
      content: {
        code: "image_pull_failed",
        message: "pull failed",
        transient: true,
      },
    });
    const decoded = decodeEcoZoonEvent(ev);
    expect(decoded).toMatchObject({ kind: "error", code: "image_pull_failed" });
  });

  it("isEcoZoonLifecycle returns true for eco.zoon.error", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: "eco.zoon.error",
      content: {},
    });
    expect(isEcoZoonLifecycle(ev)).toBe(true);
  });

  it("EcoZoonEventType.Error is exported", () => {
    expect(EcoZoonEventType.Error).toBe("eco.zoon.error");
  });
});
