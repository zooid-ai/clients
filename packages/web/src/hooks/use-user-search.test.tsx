import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useUserSearch } from "./use-user-search";

const me = "@me:h.example";
afterEach(() => MatrixClientPeg.reset());

function setupClient(searchResults: Array<{ user_id: string; display_name?: string }>) {
  const client = makeFakeClient({ userId: me });
  const search = vi.fn(async () => ({ results: searchResults, limited: false }));
  (client as unknown as { searchUserDirectory: typeof search }).searchUserDirectory = search;
  MatrixClientPeg.injectClientForTest(client);
  return { client, search };
}

describe("useUserSearch", () => {
  it("returns empty results when query is empty", async () => {
    setupClient([]);
    const { result } = renderHook(() => useUserSearch(""));
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("calls searchUserDirectory after the debounce window", async () => {
    vi.useFakeTimers();
    try {
      const { search } = setupClient([
        { user_id: "@bob:h.example", display_name: "Bob" },
      ]);
      const { result, rerender } = renderHook(({ q }) => useUserSearch(q), {
        initialProps: { q: "" },
      });
      rerender({ q: "bo" });
      expect(search).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      vi.useRealTimers();
      await waitFor(() => expect(search).toHaveBeenCalledWith({ term: "bo", limit: 10 }));
      expect(result.current.results.map((r) => r.userId)).toEqual(["@bob:h.example"]);
    } finally {
      // already restored in the try
    }
  });

  it("excludes the current user from results", async () => {
    vi.useFakeTimers();
    setupClient([
      { user_id: me, display_name: "me" },
      { user_id: "@bob:h.example", display_name: "Bob" },
    ]);
    const { result, rerender } = renderHook(({ q }) => useUserSearch(q), {
      initialProps: { q: "" },
    });
    rerender({ q: "x" });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    vi.useRealTimers();
    await waitFor(() => expect(result.current.results.map((r) => r.userId)).toEqual(["@bob:h.example"]));
  });
});
