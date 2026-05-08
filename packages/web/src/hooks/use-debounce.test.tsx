import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  it("returns the latest value after the delay elapses", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), {
        initialProps: { v: "a" },
      });
      expect(result.current).toBe("a");
      rerender({ v: "b" });
      expect(result.current).toBe("a");
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe("b");
    } finally {
      vi.useRealTimers();
    }
  });
});
