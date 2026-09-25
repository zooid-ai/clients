import { describe, expect, it } from "vitest";
import { makeMatrixEvent } from "../../../test/factories";
import {
  buildThreadLink,
  parseThreadLink,
  threadRootOf,
  threadTargetForEvent,
  threadTargetPath,
} from "./permalinks";

const origin = "https://app.example";
const roomId = "!r:h.example";

function msg(eventId: string, content: Record<string, unknown> = {}) {
  return makeMatrixEvent({
    eventId,
    roomId,
    sender: "@a:h.example",
    type: "m.room.message",
    content: { msgtype: "m.text", body: "hi", ...content },
  });
}

describe("threadRootOf / threadTargetForEvent", () => {
  it("treats a top-level message as its own thread root", () => {
    const ev = msg("$root");
    expect(threadRootOf(ev)).toBe("$root");
    expect(threadTargetForEvent(ev)).toEqual({ roomId, threadId: "$root" });
  });

  it("targets a reply by its thread root and keeps the reply as the event", () => {
    const ev = msg("$reply", { "m.relates_to": { rel_type: "m.thread", event_id: "$root" } });
    expect(threadRootOf(ev)).toBe("$root");
    expect(threadTargetForEvent(ev)).toEqual({ roomId, threadId: "$root", eventId: "$reply" });
  });
});

describe("buildThreadLink / threadTargetPath", () => {
  it("puts the room in the path and the thread in the query", () => {
    // encodeURIComponent leaves "!" alone and encodes ":"; URLSearchParams encodes "$".
    expect(threadTargetPath({ roomId, threadId: "$root" })).toBe(
      "/room/!r%3Ah.example?thread=%24root",
    );
    expect(buildThreadLink(origin, { roomId, threadId: "$root" })).toBe(
      "https://app.example/room/!r%3Ah.example?thread=%24root",
    );
  });

  it("adds event only when it differs from the thread root", () => {
    expect(buildThreadLink(origin, { roomId, threadId: "$root", eventId: "$root" })).not.toContain(
      "event=",
    );
    expect(buildThreadLink(origin, { roomId, threadId: "$root", eventId: "$reply" })).toContain(
      "&event=%24reply",
    );
  });
});

describe("parseThreadLink", () => {
  it("round-trips its own links", () => {
    const t = { roomId, threadId: "$root", eventId: "$reply" };
    expect(parseThreadLink(buildThreadLink(origin, t), origin)).toEqual(t);
  });

  it("accepts unencoded same-origin links", () => {
    expect(parseThreadLink("https://app.example/room/!r:h.example?thread=$root", origin)).toEqual({
      roomId,
      threadId: "$root",
    });
  });

  it("maps a matrix.to event permalink to that event as the thread root", () => {
    expect(parseThreadLink("https://matrix.to/#/!r:h.example/$ev?via=h.example", origin)).toEqual({
      roomId,
      threadId: "$ev",
    });
  });

  it("rejects other origins, room-only links, aliases and junk", () => {
    expect(parseThreadLink("https://evil.example/room/!r:h.example?thread=$root", origin)).toBeNull();
    expect(parseThreadLink("https://app.example/room/!r:h.example", origin)).toBeNull();
    expect(parseThreadLink("https://matrix.to/#/#alias:h.example/$ev", origin)).toBeNull();
    expect(parseThreadLink("https://matrix.to/#/!r:h.example", origin)).toBeNull();
    expect(parseThreadLink("not a url", origin)).toBeNull();
  });
});
