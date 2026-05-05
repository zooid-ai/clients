import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MatrixClientPeg } from "../client/peg";
import { useAuthState } from "./use-auth-state";
import { useMatrixClient } from "./use-matrix-client";

const creds = {
  homeserverUrl: "https://h.example",
  accessToken: "tok",
  userId: "@alice:h.example",
  deviceId: "DEV1",
};

describe("useAuthState", () => {
  afterEach(() => {
    cleanup();
    MatrixClientPeg.reset();
  });

  it("starts as 'logged-out' when peg is empty", () => {
    const { result } = renderHook(() => useAuthState());
    expect(result.current).toBe("logged-out");
  });

  it("flips to 'logged-in' when peg is set", () => {
    const { result } = renderHook(() => useAuthState());
    act(() => {
      MatrixClientPeg.set(creds);
    });
    expect(result.current).toBe("logged-in");
  });

  it("flips back to 'logged-out' on reset", () => {
    MatrixClientPeg.set(creds);
    const { result } = renderHook(() => useAuthState());
    expect(result.current).toBe("logged-in");
    act(() => {
      MatrixClientPeg.reset();
    });
    expect(result.current).toBe("logged-out");
  });
});

describe("useMatrixClient", () => {
  afterEach(() => {
    cleanup();
    MatrixClientPeg.reset();
  });

  it("throws when called without a logged-in client", () => {
    // The hook is documented to be called only inside <LoggedInView>; if a
    // component calls it pre-login that's a programmer error.
    expect(() => renderHook(() => useMatrixClient())).toThrow(/not logged in/i);
  });

  it("returns the live client when logged in", () => {
    MatrixClientPeg.set(creds);
    const { result } = renderHook(() => useMatrixClient());
    expect(result.current.getUserId()).toBe(creds.userId);
  });
});
