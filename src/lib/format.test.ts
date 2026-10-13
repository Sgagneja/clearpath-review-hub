import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelative,
  initials,
  pluralize,
} from "./format";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("formatDuration", () => {
  it.each([
    [30 * 1000, "1m"],
    [45 * MIN, "45m"],
    [6 * HOUR, "6h"],
    [52 * HOUR, "2d 4h"],
    [48 * HOUR, "2d"],
    [71.9 * HOUR, "3d"],
    [-5 * HOUR, "5h"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  it("describes future and past times", () => {
    expect(formatRelative(new Date(now.getTime() + 6 * HOUR), now)).toBe("in 6h");
    expect(formatRelative(new Date(now.getTime() - 3 * HOUR), now)).toBe("3h ago");
    expect(formatRelative(now, now)).toBe("just now");
  });
});

describe("dates", () => {
  it("renders absolute times in Eastern time", () => {
    expect(formatDateTime(new Date("2026-10-12T13:30:00Z"))).toBe("Oct 12, 9:30 AM ET");
  });

  it("renders calendar dates without a time-zone shift", () => {
    expect(formatCalendarDate("2026-11-01")).toBe("Nov 1, 2026");
  });
});

describe("small helpers", () => {
  it("formats rates, initials and plurals", () => {
    expect(formatPercent(0.876)).toBe("88%");
    expect(formatPercent(null)).toBe("—");
    expect(initials("Dana Okafor")).toBe("DO");
    expect(initials("Priya")).toBe("P");
    expect(pluralize(1, "finding")).toBe("1 finding");
    expect(pluralize(3, "finding")).toBe("3 findings");
  });
});
