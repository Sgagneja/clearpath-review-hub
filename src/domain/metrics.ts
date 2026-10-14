import type { Status, VersionOutcome } from "./types";

/**
 * Throughput metrics for the compliance dashboard. All functions are pure and
 * operate on plain records, so the numbers on screen are unit-tested rather
 * than buried in SQL.
 *
 * A submission is a sequence of review *rounds* (one per version). Each round
 * runs submitted → picked up → decided; a "changes requested" decision sends
 * the asset back to the submitter until the next version arrives.
 */

export interface MetricRound {
  version: number;
  submittedAt: Date;
  slaDueAt: Date;
  reviewStartedAt: Date | null;
  decidedAt: Date | null;
  outcome: VersionOutcome | null;
  decidedById: string | null;
  ruleIds: string[];
}

export interface MetricSubmission {
  id: string;
  status: Status;
  assigneeId: string | null;
  createdAt: Date;
  rounds: MetricRound[];
}

const HOUR_MS = 3_600_000;
const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / HOUR_MS;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Final decision (approved/rejected), if the submission has one. */
function finalRound(sub: MetricSubmission): MetricRound | null {
  const last = sub.rounds[sub.rounds.length - 1];
  return last?.decidedAt && (last.outcome === "approved" || last.outcome === "rejected")
    ? last
    : null;
}

export interface CycleTime {
  medianHours: number | null;
  meanHours: number | null;
  count: number;
}

/** First submission to final decision, including time spent on revisions. */
export function cycleTime(subs: MetricSubmission[]): CycleTime {
  const hours = subs.flatMap((sub) => {
    const final = finalRound(sub);
    return final?.decidedAt ? [hoursBetween(sub.createdAt, final.decidedAt)] : [];
  });
  return { medianHours: median(hours), meanHours: mean(hours), count: hours.length };
}

export interface Rate {
  /** 0–1, or null when there is nothing to measure yet. */
  rate: number | null;
  numerator: number;
  denominator: number;
}

const rate = (numerator: number, denominator: number): Rate => ({
  rate: denominator === 0 ? null : numerator / denominator,
  numerator,
  denominator,
});

/** Share of submissions approved on their first review round. */
export function firstPassApprovalRate(subs: MetricSubmission[]): Rate {
  const decidedFirstRounds = subs
    .map((s) => s.rounds[0])
    .filter((r): r is MetricRound => Boolean(r?.decidedAt));
  return rate(
    decidedFirstRounds.filter((r) => r.outcome === "approved").length,
    decidedFirstRounds.length,
  );
}

/** Share of decided review rounds that were decided before their SLA. */
export function slaHitRate(subs: MetricSubmission[]): Rate {
  const decided = subs.flatMap((s) => s.rounds).filter((r) => r.decidedAt);
  const onTime = decided.filter((r) => r.decidedAt!.getTime() <= r.slaDueAt.getTime());
  return rate(onTime.length, decided.length);
}

export const STAGE_KEYS = ["awaiting_pickup", "in_review", "with_submitter"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  awaiting_pickup: "Waiting for a reviewer",
  in_review: "Under review",
  with_submitter: "Back with the submitter",
};

export interface StageDuration {
  stage: StageKey;
  meanHours: number | null;
  samples: number;
}

/**
 * Mean time spent in each stage. Open rounds count up to `now`, so a pile-up
 * that hasn't resolved yet still shows as a bottleneck.
 */
export function stageDurations(subs: MetricSubmission[], now: Date): StageDuration[] {
  const samples: Record<StageKey, number[]> = {
    awaiting_pickup: [],
    in_review: [],
    with_submitter: [],
  };

  for (const sub of subs) {
    sub.rounds.forEach((round, i) => {
      const pickedUp = round.reviewStartedAt ?? (round.decidedAt ? null : now);
      if (pickedUp) samples.awaiting_pickup.push(hoursBetween(round.submittedAt, pickedUp));
      if (round.reviewStartedAt) {
        samples.in_review.push(hoursBetween(round.reviewStartedAt, round.decidedAt ?? now));
      }
      if (round.outcome === "changes_requested" && round.decidedAt) {
        const next = sub.rounds[i + 1];
        samples.with_submitter.push(hoursBetween(round.decidedAt, next?.submittedAt ?? now));
      }
    });
  }

  return STAGE_KEYS.map((stage) => ({
    stage,
    meanHours: mean(samples[stage]),
    samples: samples[stage].length,
  }));
}

/** The stage with the longest mean dwell time. */
export function bottleneck(durations: StageDuration[]): StageDuration | null {
  return durations.reduce<StageDuration | null>((worst, d) => {
    if (d.meanHours === null) return worst;
    return !worst || d.meanHours > (worst.meanHours ?? 0) ? d : worst;
  }, null);
}

/** What is on someone's desk right now (or on nobody's, for unassigned work). */
export interface OpenLoad {
  /** Awaiting review or in review. */
  open: number;
  /** Assigned but not started yet. */
  toStart: number;
  inReview: number;
  overdue: number;
  /** Soonest deadline among the open reviews. */
  nextDueAt: Date | null;
}

/** How someone's decisions went. */
export interface DecisionRecord {
  decided: number;
  /** Decided before the round's deadline. */
  onTime: Rate;
  /** Typical time from starting a review to deciding it. */
  medianReviewHours: number | null;
}

export interface ReviewerLoad extends OpenLoad, DecisionRecord {
  reviewerId: string;
}

/** The deadline that counts for an open submission is its latest round's. */
function openLoad(subs: MetricSubmission[], now: Date): OpenLoad {
  const active = subs.filter((s) => s.status === "submitted" || s.status === "in_review");
  const deadlines = active.flatMap((s) => {
    const current = s.rounds[s.rounds.length - 1];
    return current ? [current.slaDueAt.getTime()] : [];
  });
  return {
    open: active.length,
    toStart: active.filter((s) => s.status === "submitted").length,
    inReview: active.filter((s) => s.status === "in_review").length,
    overdue: deadlines.filter((due) => due < now.getTime()).length,
    nextDueAt: deadlines.length ? new Date(Math.min(...deadlines)) : null,
  };
}

export function decisionRecord(
  rounds: Pick<MetricRound, "slaDueAt" | "reviewStartedAt" | "decidedAt">[],
): DecisionRecord {
  const decided = rounds.filter((r) => r.decidedAt !== null);
  const onTime = decided.filter((r) => r.decidedAt!.getTime() <= r.slaDueAt.getTime()).length;
  const reviewHours = decided.flatMap((r) =>
    r.reviewStartedAt ? [hoursBetween(r.reviewStartedAt, r.decidedAt!)] : [],
  );
  return {
    decided: decided.length,
    onTime: rate(onTime, decided.length),
    medianReviewHours: median(reviewHours),
  };
}

/** One row per reviewer: what they have open now and how their decisions have gone. */
export function reviewerWorkload(
  subs: MetricSubmission[],
  reviewerIds: string[],
  now: Date,
): ReviewerLoad[] {
  const rounds = subs.flatMap((s) => s.rounds);
  return reviewerIds.map((reviewerId) => ({
    reviewerId,
    ...openLoad(subs.filter((s) => s.assigneeId === reviewerId), now),
    ...decisionRecord(rounds.filter((r) => r.decidedById === reviewerId)),
  }));
}

/** Open work nobody has yet. Every hour here is pure waiting. */
export function unassignedLoad(subs: MetricSubmission[], now: Date): OpenLoad {
  return openLoad(subs.filter((s) => !s.assigneeId), now);
}

export interface WeekBucket {
  weekStart: Date;
  approved: number;
  changesRequested: number;
  rejected: number;
  submitted: number;
}

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

/** Decisions and new submissions per week, oldest first, ending this week. */
export function weeklyThroughput(
  subs: MetricSubmission[],
  now: Date,
  weeks = 8,
): WeekBucket[] {
  const thisWeek = startOfWeekUtc(now);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(thisWeek.getTime() - (weeks - 1 - i) * 7 * 24 * HOUR_MS),
    approved: 0,
    changesRequested: 0,
    rejected: 0,
    submitted: 0,
  }));
  const bucketFor = (date: Date) => {
    const start = startOfWeekUtc(date).getTime();
    return buckets.find((b) => b.weekStart.getTime() === start);
  };

  for (const sub of subs) {
    const intake = bucketFor(sub.createdAt);
    if (intake) intake.submitted++;
    for (const round of sub.rounds) {
      if (!round.decidedAt || !round.outcome) continue;
      const bucket = bucketFor(round.decidedAt);
      if (!bucket) continue;
      if (round.outcome === "approved") bucket.approved++;
      else if (round.outcome === "rejected") bucket.rejected++;
      else bucket.changesRequested++;
    }
  }
  return buckets;
}

export interface RuleFrequency {
  ruleId: string;
  submissions: number;
}

/**
 * Which rules fire most often on first drafts. This is the training signal:
 * it tells marketing which mistakes to stop making.
 */
export function topRules(subs: MetricSubmission[], limit = 5): RuleFrequency[] {
  const counts = new Map<string, number>();
  for (const sub of subs) {
    for (const ruleId of new Set(sub.rounds[0]?.ruleIds ?? [])) {
      counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([ruleId, submissions]) => ({ ruleId, submissions }))
    .sort((a, b) => b.submissions - a.submissions || a.ruleId.localeCompare(b.ruleId))
    .slice(0, limit);
}
