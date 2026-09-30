import { describe, expect, it } from "vitest";
import { mkMatrixEvent } from "../../test/factories";
import {
  ElicitationEventType,
  decodeElicitationRequest,
  decodeElicitationResolved,
  findElicitationResolution,
  findElicitationRejection,
  openElicitationSenders,
} from "./elicitation";

const room = "!r:h.example";
const agent = "@architect.acme:h.example";
const schema = { type: "object", properties: { env: { type: "string", enum: ["a", "b"] } } };

function req(id = "e1", eventId = "$ereq") {
  return mkMatrixEvent({
    roomId: room, sender: agent, type: ElicitationEventType.Request, eventId,
    content: {
      version: 1, request_id: id, session_id: "s1", tool_call_id: "tc1",
      message: "Which env?", requested_schema: schema,
      "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
    },
  });
}
function resolved(id = "e1", status = "accepted", sender = agent) {
  return mkMatrixEvent({
    roomId: room, sender, type: ElicitationEventType.Resolved,
    content: { version: 1, request_id: id, request_event_id: "$ereq", status, responded_by: "@me:h.example" },
  });
}

describe("decodeElicitationRequest", () => {
  it("decodes a request", () => {
    expect(decodeElicitationRequest(req())).toEqual({
      requestId: "e1", requestEventId: "$ereq", sessionId: "s1", toolCallId: "tc1",
      message: "Which env?", requestedSchema: schema, sender: agent, threadRoot: "$root",
    });
  });
  it("rejects wrong type or missing fields", () => {
    const bad = mkMatrixEvent({ roomId: room, sender: agent, type: ElicitationEventType.Request, content: { request_id: "e1" } });
    expect(decodeElicitationRequest(bad)).toBeNull();
  });
});

describe("resolution lookup", () => {
  it("only trusts resolved events sent by the requesting agent", () => {
    const events = [req(), resolved("e1", "accepted", "@mallory:h.example")];
    expect(findElicitationResolution(events, "e1", agent)).toBeNull();
    const ok = [req(), resolved("e1", "accepted")];
    expect(findElicitationResolution(ok, "e1", agent)).toEqual({
      requestId: "e1", status: "accepted", respondedBy: "@me:h.example", reason: undefined,
    });
  });
  it("decodes resolved statuses and rejects unknown ones", () => {
    expect(decodeElicitationResolved(resolved("e1", "interrupted"))?.status).toBe("interrupted");
    expect(decodeElicitationResolved(resolved("e1", "bogus"))).toBeNull();
  });
  it("finds the rejection for a given response event", () => {
    const rej = mkMatrixEvent({
      roomId: room, sender: agent, type: ElicitationEventType.Rejected,
      content: { request_id: "e1", response_event_id: "$mine", reason: "invalid", errors: { env: "required" } },
    });
    expect(findElicitationRejection([rej], "e1", "$mine", agent)).toEqual({
      reason: "invalid", errors: { env: "required" },
    });
    expect(findElicitationRejection([rej], "e1", "$other", agent)).toBeNull();
  });
});

describe("openElicitationSenders", () => {
  it("lists agents with an unresolved request, once each", () => {
    const events = [req("e1", "$a"), req("e2", "$b"), resolved("e1")];
    expect(openElicitationSenders(events)).toEqual([agent]);
    expect(openElicitationSenders([...events, resolved("e2")])).toEqual([]);
  });
});
