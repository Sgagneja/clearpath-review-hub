import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import type { AuditAction } from "../src/domain/audit";
import { runPrecheck } from "../src/domain/precheck/engine";
import { slaDueAt } from "../src/domain/sla";
import type { PrecheckResult, Status, VersionOutcome } from "../src/domain/types";
import { describeTarget, scriptConnection } from "./env";
import { DEMO_USERS, SCENARIOS, type SeedScenario } from "./seed-data";

/**
 * Resets the database to the demo dataset.
 *
 *   npm run db:seed               local database
 *   npm run db:seed -- --yes      any other host (asks for explicit consent)
 *   npm run db:seed -- --dry-run  print the plan, touch nothing
 */

const HOUR = 3_600_000;
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * HOUR);
const userName = (id: string) => DEMO_USERS.find((u) => u.id === id)!.name;
const userRole = (id: string) => DEMO_USERS.find((u) => u.id === id)!.role;

interface PlannedRound {
  version: number;
  body: string;
  note: string | null;
  precheck: PrecheckResult;
  submittedAt: Date;
  slaDueAt: Date;
  reviewerId: string | null;
  reviewStartedAt: Date | null;
  decidedAt: Date | null;
  decidedById: string | null;
  outcome: VersionOutcome | null;
}

interface PlannedEvent {
  occurredAt: Date;
  actorId: string | null;
  action: AuditAction;
  summary: string;
  details: Record<string, unknown>;
}

interface PlannedComment {
  version: number;
  authorId: string;
  kind: "comment" | "decision" | "resubmission";
  body: string;
  createdAt: Date;
}

interface PlannedSubmission {
  scenario: SeedScenario;
  createdAt: Date;
  targetLaunchDate: string;
  status: Status;
  assigneeId: string | null;
  closedAt: Date | null;
  updatedAt: Date;
  rounds: PlannedRound[];
  comments: PlannedComment[];
  events: PlannedEvent[];
}

const OUTCOME_STATUS: Record<VersionOutcome, Status> = {
  approved: "approved",
  changes_requested: "changes_requested",
  rejected: "rejected",
};

const OUTCOME_ACTION: Record<VersionOutcome, AuditAction> = {
  approved: "decision.approved",
  changes_requested: "decision.changes_requested",
  rejected: "decision.rejected",
};

const OUTCOME_VERB: Record<VersionOutcome, string> = {
  approved: "approved",
  changes_requested: "requested changes on",
  rejected: "rejected",
};

function plan(scenario: SeedScenario, now: Date): PlannedSubmission {
  const createdAt = addHours(now, -scenario.createdHoursAgo);
  const rounds: PlannedRound[] = [];
  const comments: PlannedComment[] = [];
  const events: PlannedEvent[] = [];
  const submitter = scenario.submitter;

  scenario.rounds.forEach((seed, index) => {
    const version = index + 1;
    const previous = rounds[index - 1];
    const submittedAt =
      index === 0 ? createdAt : addHours(previous.decidedAt!, seed.submittedAfterHours ?? 24);
    const precheck = runPrecheck({
      text: seed.body,
      productLine: scenario.productLine,
      channel: scenario.channel,
    });
    const reviewStartedAt =
      seed.pickupAfterHours === undefined ? null : addHours(submittedAt, seed.pickupAfterHours);
    const decidedAt =
      reviewStartedAt && seed.decideAfterHours !== undefined
        ? addHours(reviewStartedAt, seed.decideAfterHours)
        : null;
    const decidedById = decidedAt ? (seed.decidedBy ?? seed.reviewer ?? null) : null;

    rounds.push({
      version,
      body: seed.body,
      note: seed.note ?? null,
      precheck,
      submittedAt,
      slaDueAt: slaDueAt(submittedAt, precheck.level),
      reviewerId: seed.reviewer ?? null,
      reviewStartedAt,
      decidedAt,
      decidedById,
      outcome: decidedAt ? (seed.outcome ?? null) : null,
    });

    events.push({
      occurredAt: submittedAt,
      actorId: submitter,
      action: version === 1 ? "submission.created" : "submission.resubmitted",
      summary:
        version === 1
          ? `${userName(submitter)} submitted “${scenario.title}”`
          : `${userName(submitter)} resubmitted as version ${version}`,
      details: { version, riskScore: precheck.score, riskLevel: precheck.level },
    });
    events.push({
      occurredAt: new Date(submittedAt.getTime() + 1500),
      actorId: null,
      action: "precheck.completed",
      summary: `Pre-check on version ${version}: ${precheck.findings.length} finding${
        precheck.findings.length === 1 ? "" : "s"
      }, risk ${precheck.score} (${precheck.level})`,
      details: {
        version,
        engineVersion: precheck.engineVersion,
        score: precheck.score,
        ruleIds: precheck.findings.map((f) => f.ruleId),
      },
    });

    if (seed.note) {
      comments.push({ version, authorId: submitter, kind: "resubmission", body: seed.note, createdAt: submittedAt });
    }
    if (seed.assignedBy && seed.reviewer) {
      events.push({
        occurredAt: addHours(submittedAt, 0.5),
        actorId: seed.assignedBy,
        action: "reviewer.assigned",
        summary: `${userName(seed.assignedBy)} assigned ${userName(seed.reviewer)}`,
        details: { version, assigneeId: seed.reviewer },
      });
    }
    if (reviewStartedAt && seed.reviewer) {
      events.push({
        occurredAt: reviewStartedAt,
        actorId: seed.reviewer,
        action: "review.started",
        summary: `${userName(seed.reviewer)} started reviewing version ${version}`,
        details: { version },
      });
    }
    for (const c of seed.comments ?? []) {
      const createdAtComment = addHours(submittedAt, c.afterHours);
      comments.push({ version, authorId: c.author, kind: "comment", body: c.body, createdAt: createdAtComment });
      events.push({
        occurredAt: createdAtComment,
        actorId: c.author,
        action: "comment.added",
        summary: `${userName(c.author)} commented on version ${version}`,
        details: { version, excerpt: c.body.slice(0, 140) },
      });
    }
    if (decidedAt && seed.outcome && decidedById) {
      if (seed.decisionComment) {
        comments.push({
          version,
          authorId: decidedById,
          kind: "decision",
          body: seed.decisionComment,
          createdAt: decidedAt,
        });
      }
      events.push({
        occurredAt: decidedAt,
        actorId: decidedById,
        action: OUTCOME_ACTION[seed.outcome],
        summary: `${userName(decidedById)} ${OUTCOME_VERB[seed.outcome]} version ${version}`,
        details: {
          version,
          riskScore: precheck.score,
          openFindings: precheck.findings.length,
          comment: seed.decisionComment ?? null,
        },
      });
    }
  });

  const last = rounds[rounds.length - 1];
  const status: Status = last.outcome
    ? OUTCOME_STATUS[last.outcome]
    : last.reviewStartedAt
      ? "in_review"
      : "submitted";
  const closed = status === "approved" || status === "rejected";

  const latestActivity = [...events.map((e) => e.occurredAt), ...comments.map((c) => c.createdAt)]
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (latestActivity.getTime() > now.getTime()) {
    throw new Error(`Scenario “${scenario.title}” has activity in the future; shorten its timings.`);
  }

  return {
    scenario,
    createdAt,
    targetLaunchDate: addHours(createdAt, scenario.launchAfterDays * 24).toISOString().slice(0, 10),
    status,
    assigneeId: last.reviewerId,
    closedAt: closed ? last.decidedAt : null,
    updatedAt: latestActivity,
    rounds,
    comments,
    events,
  };
}

function printPlan(plans: PlannedSubmission[]) {
  for (const [i, p] of plans.entries()) {
    const reference = `MKT-${1001 + i}`;
    console.log(`\n${reference}  ${p.status.padEnd(17)} ${p.scenario.title}`);
    for (const r of p.rounds) {
      const rules = r.precheck.findings.map((f) => `${f.ruleId}(${f.severity[0]})`).join(", ");
      console.log(`   v${r.version} risk ${String(r.precheck.score).padStart(3)} ${r.precheck.level.padEnd(6)} ${rules || "— clean"}`);
    }
  }
}

async function main() {
  const now = new Date();
  const plans = SCENARIOS.map((s) => plan(s, now)).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  if (process.argv.includes("--dry-run")) {
    printPlan(plans);
    return;
  }

  const target = describeTarget();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])/.test(target);
  if (!isLocal && !process.argv.includes("--yes")) {
    console.error(`✖ This erases every row in ${target}. Re-run with --yes to confirm.`);
    process.exit(1);
  }

  const client = scriptConnection();
  const db = drizzle(client, { schema, casing: "snake_case" });
  console.log(`→ Seeding ${target}`);

  try {
    await db.transaction(async (tx) => {
      // The audit table refuses TRUNCATE. Only the schema owner can lift that,
      // and only for the length of this transaction.
      await tx.execute(sql`ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_truncate`);
      await tx.execute(
        sql`TRUNCATE audit_events, comments, submission_versions, submissions, imports, users RESTART IDENTITY CASCADE`,
      );
      await tx.execute(sql`ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_truncate`);
      await tx.execute(sql`ALTER SEQUENCE submission_reference_seq RESTART WITH 1001`);

      await tx.insert(schema.users).values(
        DEMO_USERS.map((u) => ({ ...u, createdAt: addHours(now, -70 * 24) })),
      );

      const auditRows: (typeof schema.auditEvents.$inferInsert)[] = [];

      for (const p of plans) {
        const last = p.rounds[p.rounds.length - 1];
        const [submission] = await tx
          .insert(schema.submissions)
          .values({
            title: p.scenario.title,
            productLine: p.scenario.productLine,
            channel: p.scenario.channel,
            targetLaunchDate: p.targetLaunchDate,
            status: p.status,
            submitterId: p.scenario.submitter,
            assigneeId: p.assigneeId,
            currentVersion: last.version,
            riskScore: last.precheck.score,
            riskLevel: last.precheck.level,
            slaDueAt: last.slaDueAt,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            closedAt: p.closedAt,
          })
          .returning({ id: schema.submissions.id, reference: schema.submissions.reference });

        await tx.insert(schema.submissionVersions).values(
          p.rounds.map((r) => ({
            submissionId: submission.id,
            version: r.version,
            body: r.body,
            findings: r.precheck.findings,
            riskScore: r.precheck.score,
            riskLevel: r.precheck.level,
            engineVersion: r.precheck.engineVersion,
            note: r.note,
            submittedById: p.scenario.submitter,
            submittedAt: r.submittedAt,
            slaDueAt: r.slaDueAt,
            reviewStartedAt: r.reviewStartedAt,
            reviewerId: r.reviewStartedAt ? r.reviewerId : null,
            decidedAt: r.decidedAt,
            decidedById: r.decidedById,
            outcome: r.outcome,
          })),
        );

        if (p.comments.length > 0) {
          await tx.insert(schema.comments).values(
            p.comments.map((c) => ({ ...c, submissionId: submission.id })),
          );
        }

        auditRows.push(
          ...p.events.map((e) => ({
            ...e,
            actorRole: e.actorId ? userRole(e.actorId) : null,
            submissionId: submission.id,
            reference: submission.reference,
          })),
        );
      }

      auditRows.push({
        occurredAt: addHours(now, -8 * 24),
        actorId: "u_dana",
        actorRole: "compliance_lead",
        action: "audit.exported",
        summary: "Dana Okafor exported the audit trail (CSV) for the Q3 exam binder",
        details: { format: "csv" },
      });

      auditRows.sort((a, b) => a.occurredAt!.getTime() - b.occurredAt!.getTime());
      await tx.insert(schema.auditEvents).values(auditRows);

      console.log(
        `✓ ${DEMO_USERS.length} users, ${plans.length} submissions, ${plans.reduce(
          (n, p) => n + p.rounds.length,
          0,
        )} versions, ${auditRows.length} audit events`,
      );
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("✖ Seed failed:", error);
  process.exit(1);
});
