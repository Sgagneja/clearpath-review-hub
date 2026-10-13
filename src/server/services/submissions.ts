import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, type Transaction } from "@/db/client";
import { comments, submissions, submissionVersions, users } from "@/db/schema";
import { compareFindings, runPrecheck } from "@/domain/precheck/engine";
import { assertCan, ForbiddenError, isEligibleAssignee } from "@/domain/permissions";
import { slaDueAt } from "@/domain/sla";
import type { Decision, PrecheckResult } from "@/domain/types";
import { DECISION_OUTCOME, isTerminal, transition } from "@/domain/workflow";
import { approvalNeedsRationale, LIMITS } from "@/lib/validation";
import { pluralize } from "@/lib/format";
import { recordAudit } from "../audit";
import type { CurrentUser } from "../auth";
import { ConflictError, NotFoundError, UserFacingError } from "../errors";

/**
 * Every state change in the workflow. Each function:
 *   1. locks the submission row (SELECT … FOR UPDATE), so two reviewers
 *      deciding at once can't both win,
 *   2. checks the permission policy against the *locked* row,
 *   3. moves the state machine, which throws on an illegal move,
 *   4. writes the change and its audit events in the same transaction.
 *
 * Inputs are already zod-validated by the server action. The pre-check always
 * re-runs here: the live preview in the browser is a convenience, never trusted.
 */

async function lockSubmission(tx: Transaction, reference: string) {
  const [row] = await tx
    .select()
    .from(submissions)
    .where(eq(submissions.reference, reference))
    .for("update");
  if (!row) throw new NotFoundError();
  return row;
}

async function currentVersion(tx: Transaction, submissionId: string, version: number) {
  const [row] = await tx
    .select()
    .from(submissionVersions)
    .where(and(eq(submissionVersions.submissionId, submissionId), eq(submissionVersions.version, version)))
    .limit(1);
  if (!row) throw new ConflictError();
  return row;
}

export function precheckSummary(version: number, result: PrecheckResult): string {
  return `Pre-check on v${version}: ${pluralize(result.findings.length, "finding")}, risk ${result.score} (${result.level})`;
}

export function precheckDetails(version: number, result: PrecheckResult) {
  return {
    version,
    engineVersion: result.engineVersion,
    score: result.score,
    ruleIds: result.findings.map((f) => f.ruleId),
  };
}

export interface CreateSubmissionInput {
  title: string;
  productLine: (typeof submissions.$inferInsert)["productLine"];
  channel: (typeof submissions.$inferInsert)["channel"];
  targetLaunchDate: string;
  body: string;
}

export async function createSubmission(actor: CurrentUser, input: CreateSubmissionInput) {
  assertCan(actor, "submission.create");
  const now = new Date();
  const precheck = runPrecheck({ text: input.body, productLine: input.productLine, channel: input.channel });
  const dueAt = slaDueAt(now, precheck.level);

  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(submissions)
      .values({
        title: input.title,
        productLine: input.productLine,
        channel: input.channel,
        targetLaunchDate: input.targetLaunchDate,
        submitterId: actor.id,
        riskScore: precheck.score,
        riskLevel: precheck.level,
        slaDueAt: dueAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: submissions.id, reference: submissions.reference });

    await tx.insert(submissionVersions).values({
      submissionId: created.id,
      version: 1,
      body: input.body,
      findings: precheck.findings,
      riskScore: precheck.score,
      riskLevel: precheck.level,
      engineVersion: precheck.engineVersion,
      submittedById: actor.id,
      submittedAt: now,
      slaDueAt: dueAt,
    });

    await recordAudit(tx, actor, {
      action: "submission.created",
      submission: created,
      summary: `${actor.name} submitted “${input.title}”`,
      details: { version: 1, riskScore: precheck.score, riskLevel: precheck.level },
    }, now);
    await recordAudit(tx, null, {
      action: "precheck.completed",
      submission: created,
      summary: precheckSummary(1, precheck),
      details: precheckDetails(1, precheck),
    }, now);

    return { reference: created.reference };
  });
}

/** A reviewer picks up a submission (or a lead takes over an assigned one). */
export async function startReview(actor: CurrentUser, reference: string) {
  const now = new Date();
  await getDb().transaction(async (tx) => {
    const sub = await lockSubmission(tx, reference);
    assertCan(actor, "submission.claim", sub);
    const status = transition(sub.status, "start_review");

    await tx
      .update(submissions)
      .set({ status, assigneeId: actor.id, updatedAt: now })
      .where(eq(submissions.id, sub.id));
    await tx
      .update(submissionVersions)
      .set({ reviewStartedAt: now, reviewerId: actor.id })
      .where(and(eq(submissionVersions.submissionId, sub.id), eq(submissionVersions.version, sub.currentVersion)));

    await recordAudit(tx, actor, {
      action: "review.started",
      submission: sub,
      summary: `${actor.name} started reviewing v${sub.currentVersion}`,
      details: { version: sub.currentVersion, previousAssigneeId: sub.assigneeId },
    }, now);
  });
}

export async function assignReviewer(actor: CurrentUser, reference: string, assigneeId: string) {
  const now = new Date();
  await getDb().transaction(async (tx) => {
    const sub = await lockSubmission(tx, reference);
    assertCan(actor, "submission.assign", sub);

    const [assignee] = await tx
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);
    if (!assignee) throw new UserFacingError("Choose a reviewer from the list.", "assigneeId");
    if (!isEligibleAssignee(assignee, sub)) {
      throw new ForbiddenError(
        assignee.id === sub.submitterId
          ? `${assignee.name} wrote this submission, so they can't review it.`
          : `${assignee.name} isn't on the compliance team.`,
      );
    }
    if (assignee.id === sub.assigneeId) return;

    await tx
      .update(submissions)
      .set({ assigneeId: assignee.id, updatedAt: now })
      .where(eq(submissions.id, sub.id));
    if (sub.status === "in_review") {
      // Mid-review handover: the new reviewer owns the open round from here.
      await tx
        .update(submissionVersions)
        .set({ reviewerId: assignee.id })
        .where(and(eq(submissionVersions.submissionId, sub.id), eq(submissionVersions.version, sub.currentVersion)));
    }

    await recordAudit(tx, actor, {
      action: "reviewer.assigned",
      submission: sub,
      summary: `${actor.name} assigned ${assignee.name}`,
      details: { version: sub.currentVersion, assigneeId: assignee.id, previousAssigneeId: sub.assigneeId },
    }, now);
  });
}

export async function decide(
  actor: CurrentUser,
  input: { reference: string; decision: Decision; comment: string },
) {
  const now = new Date();
  await getDb().transaction(async (tx) => {
    const sub = await lockSubmission(tx, input.reference);
    assertCan(actor, "submission.decide", sub);
    const version = await currentVersion(tx, sub.id, sub.currentVersion);

    const openHigh = version.findings.filter((f) => f.severity === "high").length;
    if (approvalNeedsRationale(input.decision, openHigh) && input.comment.length < LIMITS.rationaleMin) {
      throw new UserFacingError(
        `This version still has ${pluralize(openHigh, "high-severity finding")}. Record why it's safe to approve anyway.`,
        "comment",
      );
    }

    const status = transition(sub.status, input.decision);
    const outcome = DECISION_OUTCOME[input.decision];

    await tx
      .update(submissions)
      .set({ status, updatedAt: now, closedAt: isTerminal(status) ? now : null })
      .where(eq(submissions.id, sub.id));
    await tx
      .update(submissionVersions)
      .set({ decidedAt: now, decidedById: actor.id, outcome })
      .where(eq(submissionVersions.id, version.id));
    if (input.comment) {
      await tx.insert(comments).values({
        submissionId: sub.id,
        version: sub.currentVersion,
        authorId: actor.id,
        kind: "decision",
        body: input.comment,
        createdAt: now,
      });
    }

    const verb = { approve: "approved", request_changes: "requested changes on", reject: "rejected" }[input.decision];
    await recordAudit(tx, actor, {
      action: `decision.${outcome}`,
      submission: sub,
      summary: `${actor.name} ${verb} v${sub.currentVersion}`,
      details: {
        version: sub.currentVersion,
        riskScore: version.riskScore,
        openFindings: version.findings.length,
        openHighFindings: openHigh,
        comment: input.comment || null,
      },
    }, now);
  });
}

export async function resubmit(
  actor: CurrentUser,
  input: { reference: string; body: string; note: string },
) {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const sub = await lockSubmission(tx, input.reference);
    assertCan(actor, "submission.resubmit", sub);
    const previous = await currentVersion(tx, sub.id, sub.currentVersion);
    if (previous.body.trim() === input.body.trim()) {
      throw new UserFacingError(`The copy is identical to v${previous.version}. Make the requested changes first.`, "body");
    }

    const status = transition(sub.status, "resubmit");
    const version = sub.currentVersion + 1;
    const precheck = runPrecheck({ text: input.body, productLine: sub.productLine, channel: sub.channel });
    const dueAt = slaDueAt(now, precheck.level);
    const delta = compareFindings(previous.findings, precheck.findings);

    await tx.insert(submissionVersions).values({
      submissionId: sub.id,
      version,
      body: input.body,
      findings: precheck.findings,
      riskScore: precheck.score,
      riskLevel: precheck.level,
      engineVersion: precheck.engineVersion,
      note: input.note || null,
      submittedById: actor.id,
      submittedAt: now,
      slaDueAt: dueAt,
    });
    // The previous reviewer stays assigned: they already know the asset.
    await tx
      .update(submissions)
      .set({
        status,
        currentVersion: version,
        riskScore: precheck.score,
        riskLevel: precheck.level,
        slaDueAt: dueAt,
        updatedAt: now,
      })
      .where(eq(submissions.id, sub.id));
    if (input.note) {
      await tx.insert(comments).values({
        submissionId: sub.id,
        version,
        authorId: actor.id,
        kind: "resubmission",
        body: input.note,
        createdAt: now,
      });
    }

    await recordAudit(tx, actor, {
      action: "submission.resubmitted",
      submission: sub,
      summary: `${actor.name} resubmitted as v${version}`,
      details: {
        version,
        riskScore: precheck.score,
        riskLevel: precheck.level,
        resolved: delta.resolved.map((f) => f.ruleId),
        introduced: delta.introduced.map((f) => f.ruleId),
      },
    }, now);
    await recordAudit(tx, null, {
      action: "precheck.completed",
      submission: sub,
      summary: precheckSummary(version, precheck),
      details: precheckDetails(version, precheck),
    }, now);

    return { version };
  });
}

export async function addComment(actor: CurrentUser, input: { reference: string; body: string }) {
  const now = new Date();
  await getDb().transaction(async (tx) => {
    const sub = await lockSubmission(tx, input.reference);
    assertCan(actor, "submission.comment", sub);

    await tx.insert(comments).values({
      submissionId: sub.id,
      version: sub.currentVersion,
      authorId: actor.id,
      kind: "comment",
      body: input.body,
      createdAt: now,
    });
    await tx.update(submissions).set({ updatedAt: now }).where(eq(submissions.id, sub.id));
    await recordAudit(tx, actor, {
      action: "comment.added",
      submission: sub,
      summary: `${actor.name} commented on v${sub.currentVersion}`,
      details: { version: sub.currentVersion, excerpt: input.body.slice(0, 140) },
    }, now);
  });
}
