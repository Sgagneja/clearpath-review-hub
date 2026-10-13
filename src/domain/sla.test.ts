import { describe, expect, it } from "vitest";
import { launchCutoff, SLA_HOURS, slaDueAt, slaStatus, threatensLaunch } from "./sla";

const HOUR = 3_600_000;
const submittedAt = new Date("2026-10-05T14:00:00Z");

describe("slaDueAt", () => {
  it("gives riskier copy a shorter SLA", () => {
    expect(SLA_HOURS.high).toBeLessThan(SLA_HOURS.medium);
    expect(SLA_HOURS.medium).toBeLessThan(SLA_HOURS.low);
  });

  it.each([
    ["high", "2026-10-07T14:00:00.000Z"],
    ["medium", "2026-10-08T14:00:00.000Z"],
    ["low", "2026-10-10T14:00:00.000Z"],
  ] as const)("adds calendar hours for %s risk", (level, expected) => {
    expect(slaDueAt(submittedAt, level).toISOString()).toBe(expected);
  });
});

describe("slaStatus", () => {
  const dueAt = slaDueAt(submittedAt, "high");

  it("is on track early in the window", () => {
    const status = slaStatus({ submittedAt, dueAt, now: new Date(submittedAt.getTime() + 12 * HOUR) });
    expect(status.state).toBe("on_track");
    expect(status.remainingMs).toBe(36 * HOUR);
    expect(status.elapsedFraction).toBeCloseTo(0.25);
  });

  it("is due soon inside the last 12 hours", () => {
    const status = slaStatus({ submittedAt, dueAt, now: new Date(dueAt.getTime() - 12 * HOUR) });
    expect(status.state).toBe("due_soon");
  });

  it("is overdue past the deadline, with negative remaining time", () => {
    const status = slaStatus({ submittedAt, dueAt, now: new Date(dueAt.getTime() + 5 * HOUR) });
    expect(status.state).toBe("overdue");
    expect(status.remainingMs).toBe(-5 * HOUR);
    expect(status.elapsedFraction).toBe(1);
  });

  it("stops the clock at the decision", () => {
    const now = new Date(dueAt.getTime() + 100 * HOUR);
    expect(
      slaStatus({ submittedAt, dueAt, now, decidedAt: new Date(dueAt.getTime() - HOUR) }).state,
    ).toBe("met");
    expect(
      slaStatus({ submittedAt, dueAt, now, decidedAt: new Date(dueAt.getTime() + HOUR) }).state,
    ).toBe("missed");
  });
});

describe("launch risk", () => {
  it("cuts off at the start of the launch day (UTC)", () => {
    expect(launchCutoff("2026-10-09").toISOString()).toBe("2026-10-09T00:00:00.000Z");
  });

  it("flags an SLA that lands on or after the launch date", () => {
    const dueAt = slaDueAt(submittedAt, "low"); // Oct 10 14:00Z
    expect(threatensLaunch(dueAt, "2026-10-10")).toBe(true);
    expect(threatensLaunch(dueAt, "2026-10-11")).toBe(false);
  });
});
