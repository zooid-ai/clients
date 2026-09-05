import { sessionStorage_ } from "../client/storage";

const SOUND_KEY = "turn-end-sound-enabled";

let ctx: AudioContext | null = null;

/**
 * Construct (once) and resume the shared AudioContext. Must be called
 * synchronously inside a user gesture — an AudioContext created lazily when
 * a cue is due starts `suspended` on Chrome, since a push message is not
 * user activation.
 */
export async function primeAudio(): Promise<void> {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return;
  if (!ctx) ctx = new Ctor();
  try {
    await ctx.resume();
  } catch {
    // A rejected resume() must never surface as an error to the user.
  }
}

function playTone(context: AudioContext, freq: number, startAt: number, duration: number): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0.2, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

/** A short two-tone envelope. No-op — never a throw — unless primed, running, and enabled. */
export function playTurnEndCue(): void {
  if (!ctx || ctx.state !== "running") return;
  if (!soundEnabledLocally()) return;
  const now = ctx.currentTime;
  playTone(ctx, 660, now, 0.12);
  playTone(ctx, 880, now + 0.1, 0.15);
}

/** Per-browser local toggle — deliberately not the push rule's sound tweak, which is per-user/device-agnostic. */
export function soundEnabledLocally(): boolean {
  const raw = sessionStorage_.get(SOUND_KEY);
  return raw === null ? true : raw === "true";
}

export function setSoundEnabledLocally(enabled: boolean): void {
  sessionStorage_.set(SOUND_KEY, String(enabled));
}

export function resetAudioForTest(): void {
  ctx = null;
}
