import { describe, expect, it } from "vitest";
import {
  bottleneck,
  cycleTime,
  firstPassApprovalRate,
  mean,
  median,
  reviewerWorkload,
  slaHitRate,
  stageDurations,
  startOfWeekUtc,
  topRules,
  weeklyThroughput,
  type MetricRound,
  type MetricSubmission,
} from "./metrics";

const T0 = new Date("2026-09-07T12:00:00Z"); // a Monday
const at = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);

const round = (overrides: Partial<MetricRound> & Pick<MetricRound, "submittedAt">): MetricRound => ({
  version: 1,
  slaDueAt: new Date(overrides.submittedAt.getTime() + 48 * 3_600_000),
  reviewStartedAt: null,
  decidedAt: null,
  outcome: null,
  decidedById: null,
  ruleIds: [],
  ...overrides,
});

/** Approved first time: 4h waiting, 6h in review. */
const quickApproval: MetricSubmission = {
  id: "a",
  status: "approved",
  assigneeId: "u_marcus",
  createdAt: at(0),
  rounds: [
    round({
      submittedAt: at(0),
      reviewStartedAt: at(4),
      decidedAt: at(10),
      outcome: "approved",
      decidedById: "u_marcus",
      ruleIds: ["false-urgency"],
    }),
  ],
};

/** Sent back once (decided late), fixed after 20h, then approved. */
const revised: MetricSubmission = {
  id: "b",
  status: "approved",
  assigneeId: "u_alana",
  createdAt: at(0),
  rounds: [
    round({
      submittedAt: at(0),
      reviewStartedAt: at(30),
      decidedAt: at(50),
      outcome: "changes_requested",
      decidedById: "u_alana",
      ruleIds: ["udaap-absolute-claim", "false-urgency"],
    }),
    round({
      version: 2,
      submittedAt: at(70),
      reviewStartedAt: at(72),
      decidedAt: at(74),
      outcome: "approved",
      decidedById: "u_alana",
    }),
  ],
};

/** Still waiting for a reviewer. */
const waiting: MetricSubmission = {
  id: "c",
  status: "submitted",
  assigneeId: "u_marcus",
  createdAt: at(90),
  rounds: [round({ submittedAt: at(90), ruleIds: ["udaap-absolute-claim"] })],
};

const all = [quickApproval, revised, waiting];
const now = at(100);

describe("median / mean", () => {
  it("handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(mean([2, 4])).toBe(3);
    expect(mean([])).toBeNull();
  });
});

describe("cycleTime", () => {
  it("measures first submission to final decision, ignoring open work", () => {
    expect(cycleTime(all)).toEqual({ medianHours: 42, meanHours: 42, count: 2 });
  });
});

describe("firstPassApprovalRate", () => {
  it("counts approvals on the first round among decided first rounds", () => {
    expect(firstPassApprovalRate(all)).toEqual({ rate: 0.5, numerator: 1, denominator: 2 });
  });

  it("is null with nothing decided", () => {
    expect(firstPassApprovalRate([waiting]).rate).toBeNull();
  });
});

describe("slaHitRate", () => {
  it("scores every decided round against its own SLA", () => {
    // quick (10h ≤ 48h ✓), revised v1 (50h > 48h ✗), revised v2 (4h ✓)
    expect(slaHitRate(all)).toEqual({ rate: 2 / 3, numerator: 2, denominator: 3 });
  });
});

describe("stageDurations and bottleneck", () => {
  const durations = stageDurations(all, now);
  const byStage = Object.fromEntries(durations.map((d) => [d.stage, d]));

  it("averages time waiting for pickup, counting open items up to now", () => {
    // 4h, 30h, 2h, and 10h for the item still waiting
    expect(byStage.awaiting_pickup.meanHours).toBe(11.5);
    expect(byStage.awaiting_pickup.samples).toBe(4);
  });

  it("averages review and with-submitter time", () => {
    expect(byStage.in_review.meanHours).toBe((6 + 20 + 2) / 3);
    expect(byStage.with_submitter.meanHours).toBe(20);
  });

  it("names the slowest stage as the bottleneck", () => {
    expect(bottleneck(durations)?.stage).toBe("with_submitter");
    expect(bottleneck([])).toBeNull();
  });
});

describe("reviewerWorkload", () => {
  it("counts open assignments and decisions per reviewer", () => {
    expect(reviewerWorkload(all, ["u_marcus", "u_alana", "u_kenji"])).toEqual([
      { reviewerId: "u_marcus", open: 1, decided: 1, medianReviewHours: 6 },
      { reviewerId: "u_alana", open: 0, decided: 2, medianReviewHours: 11 },
      { reviewerId: "u_kenji", open: 0, decided: 0, medianReviewHours: null },
    ]);
  });
});

describe("weeklyThroughput", () => {
  it("anchors weeks on Monday UTC", () => {
    expect(startOfWeekUtc(new Date("2026-09-13T23:59:00Z")).toISOString()).toBe(
      "2026-09-07T00:00:00.000Z",
    );
    expect(startOfWeekUtc(new Date("2026-09-14T00:00:00Z")).toISOString()).toBe(
      "2026-09-14T00:00:00.000Z",
    );
  });

  it("buckets decisions by outcome and intake by creation week, ending this week", () => {
    const weeks = weeklyThroughput(all, now, 2);
    expect(weeks.map((w) => w.weekStart.toISOString())).toEqual([
      "2026-08-31T00:00:00.000Z",
      "2026-09-07T00:00:00.000Z",
    ]);
    expect(weeks[0]).toMatchObject({ approved: 0, changesRequested: 0, submitted: 0 });
    // This week: quick approval (h10), revised v1 sent back (h50), revised v2 approved (h74)
    expect(weeks[1]).toMatchObject({ approved: 2, changesRequested: 1, rejected: 0, submitted: 3 });
  });

  it("drops activity older than the window", () => {
    const weeks = weeklyThroughput(all, new Date("2026-12-01T00:00:00Z"), 4);
    expect(weeks.every((w) => w.approved + w.submitted === 0)).toBe(true);
  });
});

describe("topRules", () => {
  it("ranks rules by how many first drafts triggered them", () => {
    expect(topRules(all)).toEqual([
      { ruleId: "false-urgency", submissions: 2 },
      { ruleId: "udaap-absolute-claim", submissions: 2 },
    ]);
    expect(topRules(all, 1)).toHaveLength(1);
  });
});
