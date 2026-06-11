import { describe, expect, it } from "vitest";
import { makeMatrixEvent } from "../../../test/factories";
import { resolveEditedContent } from "./edits";

const roomId = "!r:h.example";
const targetId = "$orig";

function original(sender = "@alice:h.example") {
  return makeMatrixEvent({
    eventId: targetId,
    roomId,
    sender,
    type: "m.room.message",
    content: { msgtype: "m.text", body: "helo wrold" },
  });
}

function edit(opts: { eventId: string; sender?: string; body: string; ts?: number }) {
  const ev = makeMatrixEvent({
    eventId: opts.eventId,
    roomId,
    sender: opts.sender ?? "@alice:h.example",
    type: "m.room.message",
    content: {
      msgtype: "m.text",
      body: `* ${opts.body}`,
      "m.new_content": { msgtype: "m.text", body: opts.body },
      "m.relates_to": { rel_type: "m.replace", event_id: targetId },
    },
  });
  if (opts.ts !== undefined) {
    (ev as unknown as { getTs: () => number }).getTs = () => opts.ts!;
  }
  return ev;
}

describe("resolveEditedContent", () => {
  it("returns null when no edits target the event", () => {
    expect(resolveEditedContent(original(), [original()])).toBeNull();
  });

  it("returns the m.new_content of an edit targeting the event", () => {
    const target = original();
    const e1 = edit({ eventId: "$e1", body: "hello world" });
    expect(resolveEditedContent(target, [target, e1])).toEqual({
      msgtype: "m.text",
      body: "hello world",
    });
  });

  it("picks the latest edit by timestamp", () => {
    const target = original();
    const e1 = edit({ eventId: "$e1", body: "first fix", ts: 1000 });
    const e2 = edit({ eventId: "$e2", body: "second fix", ts: 2000 });
    // order in timeline should not matter
    expect(resolveEditedContent(target, [target, e2, e1])).toEqual({
      msgtype: "m.text",
      body: "second fix",
    });
  });

  it("ignores edits from a different sender", () => {
    const target = original("@alice:h.example");
    const evil = edit({ eventId: "$e1", sender: "@mallory:h.example", body: "pwned" });
    expect(resolveEditedContent(target, [target, evil])).toBeNull();
  });

  it("ignores redacted edits", () => {
    const target = original();
    const e1 = edit({ eventId: "$e1", body: "hello world" });
    (e1 as unknown as { isRedacted: () => boolean }).isRedacted = () => true;
    expect(resolveEditedContent(target, [target, e1])).toBeNull();
  });
});
