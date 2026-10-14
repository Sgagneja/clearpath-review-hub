import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { submissions, submissionVersions } from "@/db/schema";
import {
  bottleneck,
  cycleTime,
  firstPassApprovalRate,
  reviewerWorkload,
  slaHitRate,
  stageDurations,
  topRules,
  unassignedLoad,
  weeklyThroughput,
  type MetricSubmission,
} from "@/domain/metrics";
import { assertCan } from "@/domain/permissions";
import { RULES } from "@/domain/precheck/rules";
import { slaStatus, threatensLaunch, type SlaStatus } from "@/domain/sla";
import type { RiskLevel } from "@/domain/types";
import type { CurrentUser } from "../auth";
import { getDirectory, type Person } from "./directory";

export interface AttentionItem {
  reference: string;
  title: string;
  riskLevel: RiskLevel;
  assignee: Person | null;
  sla: SlaStatus & { dueAt: Date };
  launchAtRisk: boolean;
}

const WEEKS = 8;

/**
 * Loads every submission with its rounds and hands them to the pure metric
 * functions in `src/domain/metrics.ts`. At ClearPath's volume (hundreds of
 * assets a quarter) that is cheaper and far easier to verify than SQL
 * aggregates; past a few thousand rows this would move to a rollup table.
 */
export async function getDashboard(actor: CurrentUser, now = new Date()) {
  assertCan(actor, "dashboard.view");
  const db = getDb();
  const [subRows, versionRows, directory] = await Promise.all([
    db.select().from(submissions).orderBy(asc(submissions.createdAt)),
    db.select().from(submissionVersions).orderBy(asc(submissionVersions.version)),
    getDirectory(),
  ]);

  const roundsBySubmission = new Map<string, typeof versionRows>();
  for (const v of versionRows) {
    roundsBySubmission.set(v.submissionId, [...(roundsBySubmission.get(v.submissionId) ?? []), v]);
  }
  const metricSubs: MetricSubmission[] = subRows.map((s) => ({
    id: s.id,
    status: s.status,
    assigneeId: s.assigneeId,
    createdAt: s.createdAt,
    rounds: (roundsBySubmission.get(s.id) ?? []).map((v) => ({
      version: v.version,
      submittedAt: v.submittedAt,
      slaDueAt: v.slaDueAt,
      reviewStartedAt: v.reviewStartedAt,
      decidedAt: v.decidedAt,
      outcome: v.outcome,
      decidedById: v.decidedById,
      ruleIds: v.findings.map((f) => f.ruleId),
    })),
  }));

  const stages = stageDurations(metricSubs, now);
  const reviewers = directory.people.filter((p) => p.role !== "submitter");
  const ruleById = new Map(RULES.map((r) => [r.id, r]));

  const waiting = subRows.filter((s) => s.status === "submitted");
  const reviewing = subRows.filter((s) => s.status === "in_review");
  const attention: AttentionItem[] = [...waiting, ...reviewing]
    .map((s) => {
      const round = roundsBySubmission.get(s.id)?.find((v) => v.version === s.currentVersion);
      return {
        reference: s.reference,
        title: s.title,
        riskLevel: s.riskLevel,
        assignee: directory.get(s.assigneeId),
        sla: { ...slaStatus({ submittedAt: round?.submittedAt ?? s.createdAt, dueAt: s.slaDueAt, now }), dueAt: s.slaDueAt },
        launchAtRisk: threatensLaunch(s.slaDueAt, s.targetLaunchDate),
      };
    })
    .sort((a, b) => a.sla.remainingMs - b.sla.remainingMs);

  const isOverdue = (s: (typeof subRows)[number]) => s.slaDueAt.getTime() < now.getTime();

  return {
    /** Open work at each stage of the review lifecycle, right now. */
    pipeline: {
      waiting: { count: waiting.length, overdue: waiting.filter(isOverdue).length, unassigned: waiting.filter((s) => !s.assigneeId).length },
      inReview: { count: reviewing.length, overdue: reviewing.filter(isOverdue).length },
      withMarketing: { count: subRows.filter((s) => s.status === "changes_requested").length },
    },
    totals: { submissions: subRows.length },
    cycleTime: cycleTime(metricSubs),
    firstPass: firstPassApprovalRate(metricSubs),
    slaHit: slaHitRate(metricSubs),
    stages,
    bottleneck: bottleneck(stages),
    weeks: weeklyThroughput(metricSubs, now, WEEKS),
    workload: reviewerWorkload(metricSubs, reviewers.map((r) => r.id), now).map((load) => ({
      ...load,
      reviewer: directory.get(load.reviewerId)!,
    })),
    unassigned: unassignedLoad(metricSubs, now),
    topRules: topRules(metricSubs, 6).map((r) => ({
      ...r,
      title: ruleById.get(r.ruleId)?.title ?? r.ruleId,
      citation: ruleById.get(r.ruleId)?.citation ?? "",
      severity: ruleById.get(r.ruleId)?.severity ?? "low",
    })),
    attention: attention.slice(0, 6),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
