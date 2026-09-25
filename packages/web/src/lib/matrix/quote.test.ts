import { describe, expect, it } from "vitest";
import { makeMatrixEvent } from "../../../test/factories";
import {
  buildQuoteContent,
  buildQuoteRef,
  formatQuoteTime,
  joinQuoteFallback,
  QUOTE_FIELD,
  QUOTE_SNAPSHOT_MAX,
  readQuoteRef,
  splitQuoteFallback,
  type QuoteRef,
} from "./quote";

const origin = "https://app.example";
const roomId = "!r:h.example";
const TS = Date.UTC(2026, 8, 25, 14, 42);

function msg(eventId: string, content: Record<string, unknown>) {
  return makeMatrixEvent({
    eventId,
    roomId,
    sender: "@coding:h.example",
    type: "m.room.message",
    content,
  });
}

const ref: QuoteRef = {
  room_id: roomId,
  event_id: "$reply",
  thread_id: "$root",
  sender: "@coding:h.example",
  origin_server_ts: TS,
  snapshot: { msgtype: "m.text", body: "line one\n\nline two" },
};

describe("buildQuoteRef", () => {
  it("captures the source identity and a body snapshot", () => {
    const q = buildQuoteRef(msg("$root", { msgtype: "m.notice", body: "hello" }));
    expect(q).toMatchObject({
      room_id: roomId,
      event_id: "$root",
      thread_id: "$root",
      sender: "@coding:h.example",
      snapshot: { msgtype: "m.notice", body: "hello" },
    });
    expect(typeof q.origin_server_ts).toBe("number");
    expect(q.thread).toBeUndefined();
  });

  it("records the reply count only for a thread root that has replies", () => {
    expect(buildQuoteRef(msg("$root", { msgtype: "m.text", body: "x" }), { replyCount: 12 }).thread)
      .toEqual({ reply_count: 12 });
    const reply = msg("$r", {
      msgtype: "m.text",
      body: "x",
      "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
    });
    expect(buildQuoteRef(reply, { replyCount: 12 }).thread).toBeUndefined();
    expect(buildQuoteRef(reply).thread_id).toBe("$root");
  });

  it("keeps formatted_body when the body fits", () => {
    const q = buildQuoteRef(
      msg("$a", {
        msgtype: "m.text",
        body: "**hi**",
        format: "org.matrix.custom.html",
        formatted_body: "<strong>hi</strong>",
      }),
    );
    expect(q.snapshot).toEqual({
      msgtype: "m.text",
      body: "**hi**",
      format: "org.matrix.custom.html",
      formatted_body: "<strong>hi</strong>",
    });
  });

  it("caps a long body with an ellipsis and drops its HTML", () => {
    const long = "a".repeat(QUOTE_SNAPSHOT_MAX + 50);
    const q = buildQuoteRef(
      msg("$a", { msgtype: "m.text", body: long, format: "org.matrix.custom.html", formatted_body: `<p>${long}</p>` }),
    );
    expect(q.snapshot.body).toHaveLength(QUOTE_SNAPSHOT_MAX);
    expect(q.snapshot.body.endsWith("…")).toBe(true);
    expect(q.snapshot.formatted_body).toBeUndefined();
  });

  it("prefers the displayed (edited) content when given", () => {
    const q = buildQuoteRef(msg("$a", { msgtype: "m.text", body: "old" }), {
      content: { msgtype: "m.text", body: "new" },
    });
    expect(q.snapshot.body).toBe("new");
  });
});

describe("buildQuoteContent", () => {
  it("writes the comment, then a UTC-stamped blockquote fallback with the link", () => {
    const content = buildQuoteContent({ comment: "look at this", quote: ref, senderName: "Coding", origin });
    expect(formatQuoteTime(TS)).toBe("2026-09-25 14:42 UTC");
    expect(content).toEqual({
      msgtype: "m.text",
      body:
        "look at this\n\n" +
        "> Coding · 2026-09-25 14:42 UTC · https://app.example/room/!r%3Ah.example?thread=%24root&event=%24reply\n" +
        "> line one\n" +
        ">\n" +
        "> line two",
      "m.mentions": {},
      [QUOTE_FIELD]: ref,
    });
  });

  it("is the bare fallback when there is no comment", () => {
    const content = buildQuoteContent({ comment: "   ", quote: ref, senderName: "Coding", origin });
    expect((content.body as string).startsWith("> Coding · ")).toBe(true);
  });
});

describe("splitQuoteFallback / joinQuoteFallback", () => {
  const fallback = "> Coding · 2026-09-25 14:42 UTC · link\n> line one\n>\n> line two";

  it("splits the trailing fallback from the comment", () => {
    expect(splitQuoteFallback(`hey\n\n${fallback}`)).toEqual({ comment: "hey", fallback });
  });

  it("returns an empty comment for a bare quote", () => {
    expect(splitQuoteFallback(fallback)).toEqual({ comment: "", fallback });
  });

  it("keeps a comment that has its own blockquote", () => {
    const body = `> their point\n\nagreed\n\n${fallback}`;
    expect(splitQuoteFallback(body)).toEqual({ comment: "> their point\n\nagreed", fallback });
  });

  it("leaves a plain body alone", () => {
    expect(splitQuoteFallback("just text")).toEqual({ comment: "just text", fallback: "" });
  });

  it("joins back to the original", () => {
    expect(joinQuoteFallback("hey", fallback)).toBe(`hey\n\n${fallback}`);
    expect(joinQuoteFallback("", fallback)).toBe(fallback);
  });
});

describe("readQuoteRef", () => {
  it("reads a well-formed reference", () => {
    expect(readQuoteRef({ body: "x", [QUOTE_FIELD]: ref })).toEqual(ref);
  });

  it("rejects missing or malformed references", () => {
    expect(readQuoteRef({ body: "x" })).toBeNull();
    expect(readQuoteRef({ [QUOTE_FIELD]: { ...ref, event_id: 5 } })).toBeNull();
    expect(readQuoteRef({ [QUOTE_FIELD]: { ...ref, snapshot: {} } })).toBeNull();
    expect(readQuoteRef(null)).toBeNull();
  });
});
