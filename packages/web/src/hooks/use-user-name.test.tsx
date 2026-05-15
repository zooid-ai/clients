import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUserName } from "./use-user-name";

const clientRef: {
  current: {
    getRoom: (r: string) => unknown;
    getUser: (u: string) => unknown;
  } | null;
} = { current: null };

vi.mock("../client/peg", () => ({
  MatrixClientPeg: {
    safeGet: () => clientRef.current,
    subscribe: () => () => {},
  },
}));

function fakeRoom(members: Record<string, { name: string }>) {
  return {
    getMember: (userId: string) =>
      members[userId] ? { userId, name: members[userId].name } : null,
    currentState: { on: () => {}, off: () => {} },
    on: () => {},
    off: () => {},
  };
}

beforeEach(() => {
  clientRef.current = null;
});

describe("useUserName", () => {
  it("returns the room-member displayname when a roomId is supplied", () => {
    clientRef.current = {
      getRoom: () => fakeRoom({ "@docs:localhost": { name: "Docs Agent" } }) as never,
      getUser: () => null,
    };
    const { result } = renderHook(() =>
      useUserName("@docs:localhost", "!r:localhost"),
    );
    expect(result.current).toBe("Docs Agent");
  });

  it("falls back to the global profile when no roomId is supplied", () => {
    clientRef.current = {
      getRoom: () => null,
      getUser: () => ({ displayName: "Docs Agent", on: () => {}, off: () => {} }) as never,
    };
    const { result } = renderHook(() => useUserName("@docs:localhost"));
    expect(result.current).toBe("Docs Agent");
  });

  it("falls back to the localpart when neither member nor profile is known", () => {
    clientRef.current = {
      getRoom: () => null,
      getUser: () => null,
    };
    const { result } = renderHook(() =>
      useUserName("@docs:localhost", "!r:localhost"),
    );
    expect(result.current).toBe("docs");
  });

  it("falls back to the localpart when the peg has no client", () => {
    clientRef.current = null;
    const { result } = renderHook(() => useUserName("@docs:localhost"));
    expect(result.current).toBe("docs");
  });
});
