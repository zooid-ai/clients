import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playTurnEndCue } from "@/lib/notification-sound";
import { useServiceWorkerMessages } from "./use-service-worker-messages";

vi.mock("@/lib/notification-sound", () => ({ playTurnEndCue: vi.fn() }));

let listeners: Record<string, (event: unknown) => void>;

beforeEach(() => {
  listeners = {};
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      addEventListener: vi.fn((type: string, fn: (event: unknown) => void) => {
        listeners[type] = fn;
      }),
      removeEventListener: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function dispatch(data: Record<string, unknown>) {
  act(() => listeners.message?.({ data }));
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useServiceWorkerMessages", () => {
  it("plays the cue on a sound message", () => {
    renderHook(() => useServiceWorkerMessages(), { wrapper });
    dispatch({ type: "sound" });
    expect(playTurnEndCue).toHaveBeenCalled();
  });

  it("navigates to the room on a navigate message", () => {
    let pathname = "";
    function Probe() {
      useServiceWorkerMessages();
      pathname = useLocation().pathname;
      return null;
    }
    renderHook(
      () => {},
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="*" element={<Probe />} />
            </Routes>
            {children}
          </MemoryRouter>
        ),
      },
    );
    dispatch({ type: "navigate", roomId: "!r:example.org" });
    expect(pathname).toBe("/room/!r:example.org");
  });

  it("ignores unknown message types", () => {
    renderHook(() => useServiceWorkerMessages(), { wrapper });
    dispatch({ type: "something-else" });
    expect(playTurnEndCue).not.toHaveBeenCalled();
  });
});
