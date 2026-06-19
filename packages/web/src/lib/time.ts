// Timestamp formatting for the message timeline. Pure functions take an
// explicit `now` so they're deterministic and unit-testable; the live "now"
// ticker lives in the useNow() hook.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** True when both timestamps fall on the same local calendar day. */
export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Compact relative label shown next to each message:
 * "now" · "5m ago" · "3h ago" · "Yesterday" · weekday · "Jun 16".
 */
export function formatRelativeTime(ts: number, now: number): string {
  const diff = now - ts;
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (isSameDay(ts, now)) return `${Math.floor(diff / HOUR)}h ago`;
  if (isSameDay(ts, now - DAY)) return "Yesterday";
  if (diff < 7 * DAY) {
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(ts);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(ts);
}

/** Full, unambiguous timestamp for the hover/tap tooltip. */
export function formatAbsoluteTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(ts);
}

/** Day-separator label: "Today" · "Yesterday" · "June 16, 2026". */
export function formatDayDivider(ts: number, now: number): string {
  if (isSameDay(ts, now)) return "Today";
  if (isSameDay(ts, now - DAY)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(ts);
}
