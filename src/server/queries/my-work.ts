import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { submissions, submissionVersions } from "@/db/schema";
import { decisionRecord } from "@/domain/metrics";
import { assertCan } from "@/domain/permissions";
import type { VersionOutcome } from "@/domain/types";
import { queueFiltersSchema } from "@/lib/validation";
import type { CurrentUser } from "../auth";
import { getQueue } from "./queue";

export interface RecentDecision {
  reference: string;
  title: string;
  version: number;
  outcome: VersionOutcome;
  decidedAt: Date;
  onTime: boolean;
}

const RECENT_DECISIONS = 5;

/**
 * One person's slice of the team's work: what is assigned to them, what is
 * still waiting for anyone at all, what they sent back, and how their own
 * decisions have gone. It reads the same rows as the queue, so the two never
 * disagree.
 */
export async function getMyWork(actor: CurrentUser, now = new Date()) {
  assertCan(actor, "mywork.view");
  const base = queueFiltersSchema.parse({});
  const [mine, unclaimed, rounds] = await Promise.all([
    getQueue(actor, { ...base, assignee: "me" }, now),
    getQueue(actor, { ...base, status: "submitted", assignee: "unassigned" }, now),
    getDb()
      .select({
        reference: submissions.reference,
        title: submissions.title,
        version: submissionVersions.version,
        outcome: submissionVersions.outcome,
        slaDueAt: submissionVersions.slaDueAt,
        reviewStartedAt: submissionVersions.reviewStartedAt,
        decidedAt: submissionVersions.decidedAt,
      })
      .from(submissionVersions)
      .innerJoin(submissions, eq(submissionVersions.submissionId, submissions.id))
      .where(and(eq(submissionVersions.decidedById, actor.id), isNotNull(submissionVersions.decidedAt)))
      .orderBy(desc(submissionVersions.decidedAt)),
  ]);

  const open = mine.rows.filter((r) => r.status === "submitted" || r.status === "in_review");
  const recent: RecentDecision[] = rounds.slice(0, RECENT_DECISIONS).flatMap((r) =>
    r.outcome && r.decidedAt
      ? [{
          reference: r.reference,
          title: r.title,
          version: r.version,
          outcome: r.outcome,
          decidedAt: r.decidedAt,
          onTime: r.decidedAt.getTime() <= r.slaDueAt.getTime(),
        }]
      : [],
  );

  return {
    open,
    toStart: open.filter((r) => r.status === "submitted").length,
    inReview: open.filter((r) => r.status === "in_review").length,
    overdue: open.filter((r) => r.sla.state === "overdue").length,
    /** Sent back for changes. The deadline is paused and the work returns to this person. */
    sentBack: mine.rows.filter((r) => r.status === "changes_requested"),
    unclaimed: unclaimed.rows,
    record: decisionRecord(rounds),
    recent,
  };
}

export type MyWork = Awaited<ReturnType<typeof getMyWork>>;
