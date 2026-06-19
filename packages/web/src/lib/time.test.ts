import { describe, expect, it } from "vitest";
import { formatDayDivider, formatRelativeTime, isSameDay } from "./time";

// Build local-time timestamps so they line up with the local-calendar logic in
// isSameDay (which uses getFullYear/getMonth/getDate).
function at(y: number, m: number, d: number, h = 12, min = 0): number {
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

describe("isSameDay", () => {
  it("is true within a day and false across midnight", () => {
    expect(isSameDay(at(2026, 6, 16, 0, 1), at(2026, 6, 16, 23, 59))).toBe(true);
    expect(isSameDay(at(2026, 6, 16, 23, 59), at(2026, 6, 17, 0, 1))).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = at(2026, 6, 16, 12, 0);

  it("shows 'now' under a minute", () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe("now");
  });

  it("shows minutes then hours within the same day", () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe("3h ago");
  });

  it("shows 'Yesterday' for the previous calendar day", () => {
    expect(formatRelativeTime(at(2026, 6, 15, 12, 0), now)).toBe("Yesterday");
  });

  it("falls back to a date string for older messages", () => {
    const label = formatRelativeTime(at(2026, 1, 2, 12, 0), now);
    expect(label).not.toMatch(/ago|Yesterday|now/);
    expect(label.length).toBeGreaterThan(0);
  });
});

describe("formatDayDivider", () => {
  const now = at(2026, 6, 16, 9, 0);

  it("labels today and yesterday", () => {
    expect(formatDayDivider(at(2026, 6, 16, 1, 0), now)).toBe("Today");
    expect(formatDayDivider(at(2026, 6, 15, 23, 0), now)).toBe("Yesterday");
  });

  it("labels older days with a full date containing the year", () => {
    expect(formatDayDivider(at(2026, 6, 14, 12, 0), now)).toMatch(/2026/);
  });
});
