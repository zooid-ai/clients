import { describe, expect, it } from "vitest";
import { mkMatrixEvent } from "../../test/factories";
import {
  ApprovalEventType,
  type ApprovalRequest,
  decodeApprovalRequest,
  decodeApprovalResponse,
  findResolvingResponse,
} from "./approval";

const room = "!r:h.example";
const sender = "@architect.acme:h.example";

describe("decodeApprovalRequest", () => {
  it("decodes a well-formed request (zooid {optionId,name,kind} options)", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: ApprovalEventType.Request,
      content: {
        approval_id: "a1",
        session_id: "s1",
        tool_call_id: "tc1",
        options: [
          { optionId: "once", name: "Allow once", kind: "allow_once" },
          { optionId: "reject", name: "Reject", kind: "reject_once" },
        ],
      },
    });
    expect(decodeApprovalRequest(ev)).toEqual<ApprovalRequest>({
      approvalId: "a1",
      sessionId: "s1",
      toolCallId: "tc1",
      toolKind: undefined,
      toolTitle: undefined,
      toolInput: undefined,
      options: [
        { optionId: "once", name: "Allow once", kind: "allow_once" },
        { optionId: "reject", name: "Reject", kind: "reject_once" },
      ],
    });
  });

  it("decodes legacy {id,label} options for back-compat", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: ApprovalEventType.Request,
      content: {
        approval_id: "a1",
        session_id: "s1",
        tool_call_id: "tc1",
        options: [
          { id: "allow", label: "Allow" },
          { id: "cancel", label: "Cancel" },
        ],
      },
    });
    expect(decodeApprovalRequest(ev)?.options).toEqual([
      { optionId: "allow", name: "Allow", kind: "" },
      { optionId: "cancel", name: "Cancel", kind: "" },
    ]);
  });

  it("returns null for malformed requests (missing approval_id)", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: ApprovalEventType.Request,
      content: { session_id: "s1" },
    });
    expect(decodeApprovalRequest(ev)).toBeNull();
  });

  it("tolerates missing options[]", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender,
      type: ApprovalEventType.Request,
      content: { approval_id: "a1", session_id: "s1", tool_call_id: "tc1" },
    });
    expect(decodeApprovalRequest(ev)?.options).toEqual([]);
  });
});

describe("decodeApprovalResponse", () => {
  it("decodes allow", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender: "@me:h.example",
      type: ApprovalEventType.Response,
      content: { approval_id: "a1", decision: "allow", option_id: "default" },
    });
    expect(decodeApprovalResponse(ev)).toEqual({
      approvalId: "a1",
      decision: "allow",
      optionId: "default",
      respondedBy: "@me:h.example",
    });
  });

  it("decodes cancel", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender: "@me:h.example",
      type: ApprovalEventType.Response,
      content: { approval_id: "a1", decision: "cancel" },
    });
    expect(decodeApprovalResponse(ev)?.decision).toBe("cancel");
  });

  it("returns null for unknown decisions", () => {
    const ev = mkMatrixEvent({
      roomId: room,
      sender: "@me:h.example",
      type: ApprovalEventType.Response,
      content: { approval_id: "a1", decision: "maybe" },
    });
    expect(decodeApprovalResponse(ev)).toBeNull();
  });
});

describe("findResolvingResponse", () => {
  it("finds a response with matching approval_id from anywhere in the timeline", () => {
    const events = [
      mkMatrixEvent({
        roomId: room,
        sender,
        type: ApprovalEventType.Request,
        content: { approval_id: "a1", session_id: "s1", tool_call_id: "tc1" },
      }),
      mkMatrixEvent({
        roomId: room,
        sender: "@me:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body: "noise" },
      }),
      mkMatrixEvent({
        roomId: room,
        sender: "@bob:h.example",
        type: ApprovalEventType.Response,
        content: { approval_id: "a1", decision: "allow" },
      }),
    ];
    const resolved = findResolvingResponse(events, "a1");
    expect(resolved?.respondedBy).toBe("@bob:h.example");
    expect(resolved?.decision).toBe("allow");
  });

  it("returns null when there's no matching response", () => {
    const events = [
      mkMatrixEvent({
        roomId: room,
        sender: "@me:h.example",
        type: ApprovalEventType.Response,
        content: { approval_id: "OTHER", decision: "allow" },
      }),
    ];
    expect(findResolvingResponse(events, "a1")).toBeNull();
  });

  it("returns the *first* response when multiple exist (race resolved by timestamp)", () => {
    const a = mkMatrixEvent({
      roomId: room,
      sender: "@a:h.example",
      type: ApprovalEventType.Response,
      content: { approval_id: "a1", decision: "allow" },
    });
    const b = mkMatrixEvent({
      roomId: room,
      sender: "@b:h.example",
      type: ApprovalEventType.Response,
      content: { approval_id: "a1", decision: "cancel" },
    });
    expect(findResolvingResponse([a, b], "a1")?.respondedBy).toBe("@a:h.example");
  });
});
