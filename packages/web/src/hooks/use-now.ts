import { useSyncExternalStore } from "react";

// A single shared minute-resolution clock for relative timestamps. One interval
// drives every subscriber, so a timeline of N messages costs one timer, not N.

const TICK_MS = 60_000;

let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Refresh immediately so a just-mounted component reads a current value
  // rather than a stale module-load timestamp.
  current = Date.now();
  if (!timer) {
    timer = setInterval(() => {
      current = Date.now();
      for (const l of listeners) l();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time in ms, re-rendering subscribers about once a minute. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
