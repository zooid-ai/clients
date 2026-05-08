import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useWorkforce } from "./use-workforce";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

function seedSpace(content: unknown) {
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === spaceId ? space : null;
  if (content) {
    injectStateEvent(
      space,
      mkMatrixEvent({
        roomId: spaceId,
        sender: "@zooid:h.example",
        type: "eco.zoon.workforce",
        stateKey: "",
        content: content as Record<string, unknown>,
      }),
    );
  }
  MatrixClientPeg.injectClientForTest(client);
  return { client, space };
}

describe("useWorkforce", () => {
  it("returns ready=false and isAgent fail-open when no roster present", () => {
    seedSpace(null);
    const { result } = renderHook(() => useWorkforce(spaceId));
    expect(result.current.ready).toBe(false);
    expect(result.current.agents).toEqual([]);
    expect(result.current.isAgent("@anyone:h.example")).toBe(false);
  });

  it("returns the agent set once the roster state event is present", () => {
    seedSpace({
      version: 1,
      agents: [
        { user_id: "@planner:h.example", name: "planner" },
        { user_id: "@reviewer:h.example", name: "reviewer" },
      ],
    });
    const { result } = renderHook(() => useWorkforce(spaceId));
    expect(result.current.ready).toBe(true);
    expect(result.current.isAgent("@planner:h.example")).toBe(true);
    expect(result.current.isAgent("@reviewer:h.example")).toBe(true);
    expect(result.current.isAgent("@me:h.example")).toBe(false);
  });

  it("updates when the roster state event changes", () => {
    const { space } = seedSpace({
      version: 1,
      agents: [{ user_id: "@planner:h.example", name: "planner" }],
    });
    const { result } = renderHook(() => useWorkforce(spaceId));
    expect(result.current.isAgent("@reviewer:h.example")).toBe(false);

    act(() => {
      injectStateEvent(
        space,
        mkMatrixEvent({
          roomId: spaceId,
          sender: "@zooid:h.example",
          type: "eco.zoon.workforce",
          stateKey: "",
          content: {
            version: 1,
            agents: [
              { user_id: "@planner:h.example", name: "planner" },
              { user_id: "@reviewer:h.example", name: "reviewer" },
            ],
          },
        }),
      );
    });
    expect(result.current.isAgent("@reviewer:h.example")).toBe(true);
  });
});
