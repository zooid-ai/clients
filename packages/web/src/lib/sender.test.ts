import { describe, expect, it } from "vitest";
import { displayNameOf, nameOfMember, splitMentions, expandMentions } from "./sender";
import type { RoomMember } from "matrix-js-sdk";

function fakeMember(userId: string, name?: string): RoomMember {
  return { userId, name: name ?? "" } as unknown as RoomMember;
}

describe("displayNameOf", () => {
  it("returns the localpart of an mxid", () => {
    expect(displayNameOf("@docs:localhost")).toBe("docs");
  });
  it("returns the input when not an mxid", () => {
    expect(displayNameOf("docs")).toBe("docs");
  });
});

describe("nameOfMember", () => {
  it("returns the room-scoped displayname when set", () => {
    expect(nameOfMember(fakeMember("@docs:localhost", "Docs Agent"))).toBe("Docs Agent");
  });
  it("falls back to the user_id localpart when no displayname is set", () => {
    expect(nameOfMember(fakeMember("@docs:localhost", ""))).toBe("docs");
  });
});

describe("splitMentions", () => {
  it("returns plain segments and userId segments alternately", () => {
    const segs = splitMentions("hello @docs:localhost world");
    expect(segs).toEqual([
      { text: "hello ", userId: null },
      { text: "@docs:localhost", userId: "@docs:localhost" },
      { text: " world", userId: null },
    ]);
  });
});

describe("expandMentions", () => {
  it("expands short-form @localpart to full mxid using member directory", () => {
    const out = expandMentions("ping @docs", [{ userId: "@docs:localhost" }]);
    expect(out.body).toBe("ping @docs:localhost");
    expect(out.userIds).toEqual(["@docs:localhost"]);
  });

  it("leaves already-full mxids untouched and includes them in userIds", () => {
    const out = expandMentions("ping @docs:localhost", [{ userId: "@docs:localhost" }]);
    expect(out.body).toBe("ping @docs:localhost");
    expect(out.userIds).toEqual(["@docs:localhost"]);
  });

  it("leaves @xxx tokens that don't match any member as plain text", () => {
    const out = expandMentions("contact foo@bar.com", []);
    expect(out.body).toBe("contact foo@bar.com");
    expect(out.userIds).toEqual([]);
  });
});
