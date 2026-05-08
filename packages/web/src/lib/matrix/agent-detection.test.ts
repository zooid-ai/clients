import { describe, expect, it } from "vitest";
import { filterHumans, makeAgentSet, parseWorkforceRoster } from "./agent-detection";

describe("parseWorkforceRoster", () => {
  it("returns agents from a valid v1 event content", () => {
    const r = parseWorkforceRoster({
      version: 1,
      agents: [
        { user_id: "@planner:h", name: "planner", rooms: ["!a:h"] },
        { user_id: "@reviewer:h", name: "reviewer" },
      ],
    });
    expect(r).toEqual([
      { userId: "@planner:h", name: "planner", role: undefined, avatarUrl: undefined, rooms: ["!a:h"] },
      { userId: "@reviewer:h", name: "reviewer", role: undefined, avatarUrl: undefined, rooms: [] },
    ]);
  });

  it("returns null for missing or malformed content", () => {
    expect(parseWorkforceRoster(null)).toBeNull();
    expect(parseWorkforceRoster({})).toBeNull();
    expect(parseWorkforceRoster({ version: 1 })).toBeNull();
    expect(parseWorkforceRoster({ version: 2, agents: [] })).toBeNull();
  });

  it("skips entries missing user_id", () => {
    const r = parseWorkforceRoster({
      version: 1,
      agents: [{ name: "broken" }, { user_id: "@ok:h", name: "ok" }],
    });
    expect(r?.map((a) => a.userId)).toEqual(["@ok:h"]);
  });
});

describe("makeAgentSet", () => {
  it("builds a Set of MXIDs from a roster", () => {
    const set = makeAgentSet([
      { userId: "@a:h", name: "a", role: undefined, avatarUrl: undefined, rooms: [] },
      { userId: "@b:h", name: "b", role: undefined, avatarUrl: undefined, rooms: [] },
    ]);
    expect(set.has("@a:h")).toBe(true);
    expect(set.has("@b:h")).toBe(true);
    expect(set.has("@c:h")).toBe(false);
  });
});

describe("filterHumans", () => {
  it("removes agent MXIDs from a list of candidates", () => {
    const set = makeAgentSet([
      { userId: "@planner:h", name: "planner", role: undefined, avatarUrl: undefined, rooms: [] },
    ]);
    const candidates = ["@planner:h", "@alice:h", "@bob:h"];
    expect(filterHumans(candidates, (id) => set.has(id))).toEqual(["@alice:h", "@bob:h"]);
  });

  it("returns the input unchanged when ready=false (fail-open)", () => {
    expect(filterHumans(["@planner:h", "@alice:h"], () => false)).toEqual([
      "@planner:h",
      "@alice:h",
    ]);
  });
});
