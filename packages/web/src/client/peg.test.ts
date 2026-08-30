import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "./peg";

const creds = {
  homeserverUrl: "https://h.example",
  accessToken: "tok",
  userId: "@alice:h.example",
  deviceId: "DEV1",
};

describe("MatrixClientPeg", () => {
  afterEach(() => MatrixClientPeg.reset());

  it("returns null before set()", () => {
    expect(MatrixClientPeg.safeGet()).toBeNull();
  });

  it("creates a client and emits change on set()", () => {
    const onChange = vi.fn();
    MatrixClientPeg.subscribe(onChange);
    MatrixClientPeg.set(creds);
    expect(MatrixClientPeg.safeGet()).not.toBeNull();
    expect(MatrixClientPeg.safeGet()!.getUserId()).toBe(creds.userId);
    expect(onChange).toHaveBeenCalledOnce();
  });

  // Without timelineSupport, EventTimelineSet.resetLiveTimeline() throws away
  // every loaded event on any gappy sync, so a backgrounded tab comes back to
  // a timeline with a silent hole in it (zooid-ai/zooid#14).
  it("enables timelineSupport so a gappy sync doesn't discard loaded history", () => {
    MatrixClientPeg.set(creds);
    const c = MatrixClientPeg.safeGet()! as unknown as { timelineSupport: boolean };
    expect(c.timelineSupport).toBe(true);
  });

  it("reset() stops the client and clears the peg", () => {
    MatrixClientPeg.set(creds);
    const c = MatrixClientPeg.safeGet()!;
    const stopSpy = vi.spyOn(c, "stopClient");
    MatrixClientPeg.reset();
    expect(MatrixClientPeg.safeGet()).toBeNull();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("subscribe returns an unsubscribe fn", () => {
    const onChange = vi.fn();
    const unsub = MatrixClientPeg.subscribe(onChange);
    unsub();
    MatrixClientPeg.set(creds);
    expect(onChange).not.toHaveBeenCalled();
  });
});
