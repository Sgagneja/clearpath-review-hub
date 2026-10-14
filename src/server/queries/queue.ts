import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { submissions, submissionVersions } from "@/db/schema";
import { can } from "@/domain/permissions";
import { slaStatus, threatensLaunch, type SlaView } from "@/domain/sla";
import type { Channel, ProductLine, RiskLevel, Status } from "@/domain/types";
import type { QueueFilters } from "@/lib/validation";
import type { CurrentUser } from "../auth";
import { getDirectory, type Person } from "./directory";

export interface QueueRow {
  reference: string;
  title: string;
  productLine: ProductLine;
  channel: Channel;
  status: Status;
  version: number;
  riskScore: number;
  riskLevel: RiskLevel;
  submitter: Person | null;
  assignee: Person | null;
  sla: SlaView;
  targetLaunchDate: string;
  /** Still open and the SLA lands on or after launch day. */
  launchAtRisk: boolean;
  updatedAt: Date;
}

export interface QueueSummary {
  /** Awaiting review or in review: the ball is in compliance's court. */
  active: number;
  overdue: number;
  dueSoon: number;
  launchAtRisk: number;
  unassigned: number;
  byStatus: Record<Status | "open" | "all", number>;
}

const CLOSED: Status[] = ["approved", "rejected"];
const ACTIVE: Status[] = ["submitted", "in_review"];
const MAX_ROWS = 200;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function deriveSla(
  status: Status,
  round: { submittedAt: Date | null; decidedAt: Date | null },
  dueAt: Date,
  now: Date,
): SlaView {
  if (status === "changes_requested" && round.decidedAt) {
    return { state: "paused", since: round.decidedAt };
  }
  const result = slaStatus({
    submittedAt: round.submittedAt ?? dueAt,
    dueAt,
    now,
    decidedAt: CLOSED.includes(status) ? round.decidedAt : null,
  });
  return { ...result, dueAt };
}

/** `canOpen` in src/domain/permissions.ts, in SQL: the queue lists only what its reader can open. */
function visibleTo(actor: CurrentUser): SQL | undefined {
  if (can(actor, "queue.view_all")) return undefined;
  const own = eq(submissions.submitterId, actor.id);
  if (!can(actor, "queue.review")) return own;
  return or(
    own,
    eq(submissions.assigneeId, actor.id),
    and(isNull(submissions.assigneeId), eq(submissions.status, "submitted")),
  );
}

function filterConditions(actor: CurrentUser, filters: QueueFilters): SQL[] {
  const conditions: (SQL | undefined)[] = [visibleTo(actor)];

  if (filters.status === "open") conditions.push(notInArray(submissions.status, CLOSED));
  else if (filters.status !== "all") conditions.push(eq(submissions.status, filters.status));

  if (filters.product !== "all") conditions.push(eq(submissions.productLine, filters.product));
  if (filters.risk !== "all") conditions.push(eq(submissions.riskLevel, filters.risk));

  if (filters.assignee === "me") conditions.push(eq(submissions.assigneeId, actor.id));
  else if (filters.assignee === "unassigned") conditions.push(isNull(submissions.assigneeId));
  else if (filters.assignee !== "all") conditions.push(eq(submissions.assigneeId, filters.assignee));

  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    conditions.push(or(ilike(submissions.title, pattern), ilike(submissions.reference, pattern)));
  }
  return conditions.filter((c): c is SQL => c !== undefined);
}

function ordering(filters: QueueFilters): SQL[] {
  const dir = filters.dir === "asc" ? asc : desc;
  // Work compliance can act on first, then work parked with submitters, then history.
  const lane = sql`CASE
    WHEN ${submissions.status} IN ('submitted', 'in_review') THEN 0
    WHEN ${submissions.status} = 'changes_requested' THEN 1
    ELSE 2 END`;
  switch (filters.sort) {
    case "risk":
      return [dir(submissions.riskScore), asc(submissions.slaDueAt)];
    case "launch":
      return [dir(submissions.targetLaunchDate), asc(submissions.slaDueAt)];
    case "updated":
      return [dir(submissions.updatedAt)];
    case "reference":
      return [dir(submissions.createdAt)];
    case "sla":
    default:
      return [asc(lane), dir(submissions.slaDueAt)];
  }
}

export async function getQueue(actor: CurrentUser, filters: QueueFilters, now = new Date()) {
  const db = getDb();
  const directory = await getDirectory();
  const currentRound = and(
    eq(submissionVersions.submissionId, submissions.id),
    eq(submissionVersions.version, submissions.currentVersion),
  );

  const [rows, visible] = await Promise.all([
    db
      .select({
        reference: submissions.reference,
        title: submissions.title,
        productLine: submissions.productLine,
        channel: submissions.channel,
        status: submissions.status,
        version: submissions.currentVersion,
        riskScore: submissions.riskScore,
        riskLevel: submissions.riskLevel,
        submitterId: submissions.submitterId,
        assigneeId: submissions.assigneeId,
        slaDueAt: submissions.slaDueAt,
        targetLaunchDate: submissions.targetLaunchDate,
        updatedAt: submissions.updatedAt,
        submittedAt: submissionVersions.submittedAt,
        decidedAt: submissionVersions.decidedAt,
      })
      .from(submissions)
      .leftJoin(submissionVersions, currentRound)
      .where(and(...filterConditions(actor, filters)))
      .orderBy(...ordering(filters))
      .limit(MAX_ROWS),
    db
      .select({
        status: submissions.status,
        assigneeId: submissions.assigneeId,
        slaDueAt: submissions.slaDueAt,
        targetLaunchDate: submissions.targetLaunchDate,
        submittedAt: submissionVersions.submittedAt,
      })
      .from(submissions)
      .leftJoin(submissionVersions, currentRound)
      .where(visibleTo(actor)),
  ]);

  const queue: QueueRow[] = rows.map((row) => ({
    reference: row.reference,
    title: row.title,
    productLine: row.productLine,
    channel: row.channel,
    status: row.status,
    version: row.version,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    submitter: directory.get(row.submitterId),
    assignee: directory.get(row.assigneeId),
    sla: deriveSla(row.status, row, row.slaDueAt, now),
    targetLaunchDate: row.targetLaunchDate,
    launchAtRisk: ACTIVE.includes(row.status) && threatensLaunch(row.slaDueAt, row.targetLaunchDate),
    updatedAt: row.updatedAt,
  }));

  const byStatus: QueueSummary["byStatus"] = {
    submitted: 0, in_review: 0, changes_requested: 0, approved: 0, rejected: 0, open: 0, all: visible.length,
  };
  const summary: QueueSummary = { active: 0, overdue: 0, dueSoon: 0, launchAtRisk: 0, unassigned: 0, byStatus };
  for (const row of visible) {
    byStatus[row.status]++;
    if (!CLOSED.includes(row.status)) byStatus.open++;
    if (!ACTIVE.includes(row.status)) continue;
    summary.active++;
    if (!row.assigneeId) summary.unassigned++;
    const sla = slaStatus({ submittedAt: row.submittedAt ?? row.slaDueAt, dueAt: row.slaDueAt, now });
    if (sla.state === "overdue") summary.overdue++;
    if (sla.state === "due_soon") summary.dueSoon++;
    if (threatensLaunch(row.slaDueAt, row.targetLaunchDate)) summary.launchAtRisk++;
  }

  return { rows: queue, summary, truncated: rows.length === MAX_ROWS };
}

/** Badge count for the sidebar: work waiting on this person. */
export async function countMyQueue(actor: CurrentUser): Promise<number> {
  const db = getDb();
  if (actor.role === "submitter") {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(submissions)
      .where(and(eq(submissions.submitterId, actor.id), eq(submissions.status, "changes_requested")));
    return row?.n ?? 0;
  }
  const mine = actor.role === "compliance_lead"
    ? or(eq(submissions.assigneeId, actor.id), isNull(submissions.assigneeId))
    : eq(submissions.assigneeId, actor.id);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(and(inArray(submissions.status, ACTIVE), mine));
  return row?.n ?? 0;
}
