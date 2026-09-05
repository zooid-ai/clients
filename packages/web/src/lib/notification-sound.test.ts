import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  primeAudio,
  playTurnEndCue,
  soundEnabledLocally,
  setSoundEnabledLocally,
  resetAudioForTest,
} from "./notification-sound";

class FakeGain {
  gain = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn();
}
class FakeOsc {
  frequency = { setValueAtTime: vi.fn() };
  type = "";
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createGain = vi.fn(() => new FakeGain());
  createOscillator = vi.fn(() => new FakeOsc());
  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  (globalThis as Record<string, unknown>).AudioContext = FakeAudioContext;
  resetAudioForTest();
  localStorage.clear();
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).AudioContext;
});

describe("primeAudio", () => {
  it("constructs and resumes the context inside the gesture", async () => {
    await primeAudio();
    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe("running");
  });

  it("reuses one context across calls", async () => {
    await primeAudio();
    await primeAudio();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("does not throw when the browser has no AudioContext", async () => {
    delete (globalThis as Record<string, unknown>).AudioContext;
    await expect(primeAudio()).resolves.toBeUndefined();
  });
});

describe("playTurnEndCue", () => {
  it("plays a two-tone cue once primed", async () => {
    await primeAudio();
    playTurnEndCue();
    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when never primed — a push is not user activation", () => {
    expect(() => playTurnEndCue()).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("is a no-op while the context is suspended, and never throws", async () => {
    await primeAudio();
    const ctx = FakeAudioContext.instances[0]!;
    ctx.state = "suspended";
    playTurnEndCue();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("respects the local toggle", async () => {
    await primeAudio();
    setSoundEnabledLocally(false);
    playTurnEndCue();
    expect(FakeAudioContext.instances[0]!.createOscillator).not.toHaveBeenCalled();
  });
});

describe("soundEnabledLocally", () => {
  it("defaults on", () => {
    expect(soundEnabledLocally()).toBe(true);
  });
  it("round-trips through storage so it survives a reload", () => {
    setSoundEnabledLocally(false);
    expect(soundEnabledLocally()).toBe(false);
  });
});
