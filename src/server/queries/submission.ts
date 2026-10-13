import "server-only";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, comments, imports, submissions, submissionVersions } from "@/db/schema";
import { isAuditAction, type AuditAction } from "@/domain/audit";
import { authorize, can, isEligibleAssignee, type AuthzResult } from "@/domain/permissions";
import { slaStatus, threatensLaunch, type SlaView } from "@/domain/sla";
import type {
  Channel,
  Finding,
  ProductLine,
  RiskLevel,
  Status,
  VersionOutcome,
} from "@/domain/types";
import type { CurrentUser } from "../auth";
import { getDirectory, type Person } from "./directory";

export interface VersionDetail {
  version: number;
  body: string;
  findings: Finding[];
  riskScore: number;
  riskLevel: RiskLevel;
  engineVersion: string;
  note: string | null;
  submittedBy: Person | null;
  submittedAt: Date;
  slaDueAt: Date;
  reviewStartedAt: Date | null;
  reviewer: Person | null;
  decidedAt: Date | null;
  decidedBy: Person | null;
  outcome: VersionOutcome | null;
}

export type TimelineItem =
  | {
      kind: "event";
      id: string;
      at: Date;
      action: AuditAction;
      summary: string;
      actor: Person | null;
      version: number | null;
      /** Decision rationale or resubmission note recorded with the event. */
      attachment: string | null;
    }
  | {
      kind: "comment";
      id: string;
      at: Date;
      author: Person | null;
      body: string;
      version: number;
    };

export interface SubmissionDetail {
  reference: string;
  title: string;
  productLine: ProductLine;
  channel: Channel;
  status: Status;
  targetLaunchDate: string;
  createdAt: Date;
  closedAt: Date | null;
  currentVersion: number;
  riskScore: number;
  riskLevel: RiskLevel;
  submitter: Person | null;
  assignee: Person | null;
  /** Where an imported review came from (tracker file and row, or email). */
  source: { kind: "spreadsheet" | "email"; label: string; importId: string } | null;
  sla: SlaView;
  launchAtRisk: boolean;
  versions: VersionDetail[];
  timeline: TimelineItem[];
  permissions: Record<"claim" | "assign" | "decide" | "resubmit" | "comment", AuthzResult>;
  /** Who the lead may assign, with their current open load. Empty for everyone else. */
  assignableReviewers: (Person & { openCount: number })[];
}

/**
 * Everything the review workspace needs. Returns null both when the reference
 * doesn't exist and when the actor isn't allowed to see it, so the page can
 * render one 404 without confirming that someone else's submission exists.
 */
export async function getSubmissionDetail(
  actor: CurrentUser,
  reference: string,
  now = new Date(),
): Promise<SubmissionDetail | null> {
  const db = getDb();
  const [sub] = await db.select().from(submissions).where(eq(submissions.reference, reference)).limit(1);
  if (!sub || !can(actor, "submission.view", sub)) return null;

  const [directory, versionRows, commentRows, eventRows] = await Promise.all([
    getDirectory(),
    db
      .select()
      .from(submissionVersions)
      .where(eq(submissionVersions.submissionId, sub.id))
      .orderBy(asc(submissionVersions.version)),
    db
      .select()
      .from(comments)
      .where(eq(comments.submissionId, sub.id))
      .orderBy(asc(comments.createdAt)),
    db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.submissionId, sub.id))
      .orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id)),
  ]);

  const versions: VersionDetail[] = versionRows.map((v) => ({
    version: v.version,
    body: v.body,
    findings: v.findings,
    riskScore: v.riskScore,
    riskLevel: v.riskLevel,
    engineVersion: v.engineVersion,
    note: v.note,
    submittedBy: directory.get(v.submittedById),
    submittedAt: v.submittedAt,
    slaDueAt: v.slaDueAt,
    reviewStartedAt: v.reviewStartedAt,
    reviewer: directory.get(v.reviewerId),
    decidedAt: v.decidedAt,
    decidedBy: directory.get(v.decidedById),
    outcome: v.outcome,
  }));

  const attachments = new Map<string, string>();
  for (const c of commentRows) {
    if (c.kind !== "comment") attachments.set(`${c.kind}:${c.version}`, c.body);
  }

  const timeline: TimelineItem[] = [
    ...eventRows
      .filter((e) => isAuditAction(e.action) && e.action !== "comment.added")
      .map((e): TimelineItem => {
        const action = e.action as AuditAction;
        const version = typeof e.details.version === "number" ? e.details.version : null;
        // Imported reviews carry the old tracker's decision note on the import event.
        const attachmentKey =
          action.startsWith("decision.") || action === "submission.imported"
            ? `decision:${version}`
            : action === "submission.resubmitted"
              ? `resubmission:${version}`
              : null;
        return {
          kind: "event",
          id: `e${e.id}`,
          at: e.occurredAt,
          action,
          summary: e.summary,
          actor: directory.get(e.actorId),
          version,
          attachment: attachmentKey ? (attachments.get(attachmentKey) ?? null) : null,
        };
      }),
    ...commentRows
      .filter((c) => c.kind === "comment")
      .map((c): TimelineItem => ({
        kind: "comment",
        id: `c${c.id}`,
        at: c.createdAt,
        author: directory.get(c.authorId),
        body: c.body,
        version: c.version,
      })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const current = versions[versions.length - 1];
  const sla: SlaView =
    sub.status === "changes_requested" && current.decidedAt
      ? { state: "paused", since: current.decidedAt }
      : {
          ...slaStatus({
            submittedAt: current.submittedAt,
            dueAt: sub.slaDueAt,
            now,
            decidedAt: sub.status === "approved" || sub.status === "rejected" ? current.decidedAt : null,
          }),
          dueAt: sub.slaDueAt,
        };

  const permissions = {
    claim: authorize(actor, "submission.claim", sub),
    assign: authorize(actor, "submission.assign", sub),
    decide: authorize(actor, "submission.decide", sub),
    resubmit: authorize(actor, "submission.resubmit", sub),
    comment: authorize(actor, "submission.comment", sub),
  };

  let source: SubmissionDetail["source"] = null;
  if (sub.importId && sub.sourceLabel) {
    const [batch] = await db.select({ kind: imports.kind }).from(imports).where(eq(imports.id, sub.importId)).limit(1);
    if (batch) source = { kind: batch.kind, label: sub.sourceLabel, importId: sub.importId };
  }

  let assignableReviewers: SubmissionDetail["assignableReviewers"] = [];
  if (permissions.assign.allowed) {
    const load = await db
      .select({ assigneeId: submissions.assigneeId, n: sql<number>`count(*)::int` })
      .from(submissions)
      .where(and(inArray(submissions.status, ["submitted", "in_review"]), isNotNull(submissions.assigneeId)))
      .groupBy(submissions.assigneeId);
    const openBy = new Map(load.map((l) => [l.assigneeId, l.n]));
    assignableReviewers = directory.people
      .filter((p) => isEligibleAssignee(p, sub))
      .map((p) => ({ ...p, openCount: openBy.get(p.id) ?? 0 }));
  }

  return {
    reference: sub.reference,
    title: sub.title,
    productLine: sub.productLine,
    channel: sub.channel,
    status: sub.status,
    targetLaunchDate: sub.targetLaunchDate,
    createdAt: sub.createdAt,
    closedAt: sub.closedAt,
    currentVersion: sub.currentVersion,
    riskScore: sub.riskScore,
    riskLevel: sub.riskLevel,
    submitter: directory.get(sub.submitterId),
    assignee: directory.get(sub.assigneeId),
    source,
    sla,
    launchAtRisk:
      (sub.status === "submitted" || sub.status === "in_review") &&
      threatensLaunch(sub.slaDueAt, sub.targetLaunchDate),
    versions,
    timeline,
    permissions,
    assignableReviewers,
  };
}
