import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, submissions } from "@/db/schema";
import { ACTIVITY_ACTIONS, AUDIT_ACTIONS, isAuditAction, type AuditAction } from "@/domain/audit";
import { assertCan } from "@/domain/permissions";
import { ROLE_LABELS, type Role, type Status } from "@/domain/types";
import { toCsv } from "@/lib/csv";
import type { AuditFilters, AuditItemFilters } from "@/lib/validation";
import { recordAudit } from "../audit";
import type { CurrentUser } from "../auth";
import { UserFacingError } from "../errors";
import { getDirectory, type Person } from "./directory";

export const AUDIT_PAGE_SIZE = 40;
export const AUDIT_ITEMS_PAGE_SIZE = 25;

export interface AuditRow {
  id: number;
  occurredAt: Date;
  action: AuditAction;
  summary: string;
  actor: Person | null;
  actorRole: Role | null;
  reference: string | null;
  sessionId: string | null;
}

/** One queue item and the shape of its trail, for the audit trail's main list. */
export interface AuditItem {
  reference: string;
  title: string;
  status: Status;
  submitter: Person | null;
  events: number;
  lastAt: Date;
  lastAction: AuditAction | null;
  lastSummary: string;
}

type Directory = Awaited<ReturnType<typeof getDirectory>>;
type EventRecord = typeof auditEvents.$inferSelect;

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function toRow(r: EventRecord, directory: Directory): AuditRow {
  return {
    id: r.id,
    occurredAt: r.occurredAt,
    action: isAuditAction(r.action) ? r.action : "precheck.completed",
    summary: r.summary,
    actor: directory.get(r.actorId),
    actorRole: r.actorRole,
    reference: r.reference,
    sessionId: r.sessionId,
  };
}

function pageOf(total: number, requested: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(requested, pageCount);
  return { page, pageCount, offset: (page - 1) * size };
}

/** How much sits under each tab of the audit trail. */
export async function getAuditCounts(actor: CurrentUser) {
  assertCan(actor, "audit.view");
  const db = getDb();
  const [[{ items }], [{ activity }]] = await Promise.all([
    db.select({ items: sql<number>`count(*)::int` }).from(submissions),
    db.select({ activity: sql<number>`count(*)::int` }).from(auditEvents).where(isNull(auditEvents.submissionId)),
  ]);
  return { items, activity };
}

/**
 * Every queue item with its trail summarised: how many events, and the latest.
 * Searches the reference, the asset name, and the submitter or reviewer.
 */
export async function getAuditItems(actor: CurrentUser, filters: AuditItemFilters) {
  assertCan(actor, "audit.view");
  const db = getDb();
  const directory = await getDirectory();

  const parts: (SQL | undefined)[] = [];
  if (filters.status !== "all") parts.push(eq(submissions.status, filters.status));
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const people = directory.people.filter((p) => p.name.toLowerCase().includes(q)).map((p) => p.id);
    parts.push(
      or(
        ilike(submissions.reference, likePattern(filters.q)),
        ilike(submissions.title, likePattern(filters.q)),
        people.length > 0 ? inArray(submissions.submitterId, people) : undefined,
        people.length > 0 ? inArray(submissions.assigneeId, people) : undefined,
      ),
    );
  }
  const where = and(...parts);

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(submissions).where(where);
  const { page, pageCount, offset } = pageOf(total, filters.page, AUDIT_ITEMS_PAGE_SIZE);

  const lastAt = sql<Date>`max(${auditEvents.occurredAt})`.mapWith(auditEvents.occurredAt);
  const rows = await db
    .select({
      id: submissions.id,
      reference: submissions.reference,
      title: submissions.title,
      status: submissions.status,
      submitterId: submissions.submitterId,
      events: sql<number>`count(${auditEvents.id})::int`,
      lastAt,
    })
    .from(submissions)
    .innerJoin(auditEvents, eq(auditEvents.submissionId, submissions.id))
    .where(where)
    .groupBy(submissions.id)
    .orderBy(desc(lastAt), desc(submissions.reference))
    .limit(AUDIT_ITEMS_PAGE_SIZE)
    .offset(offset);

  const latest =
    rows.length === 0
      ? []
      : await db
          .selectDistinctOn([auditEvents.submissionId], {
            submissionId: auditEvents.submissionId,
            action: auditEvents.action,
            summary: auditEvents.summary,
          })
          .from(auditEvents)
          .where(inArray(auditEvents.submissionId, rows.map((r) => r.id)))
          .orderBy(auditEvents.submissionId, desc(auditEvents.occurredAt), desc(auditEvents.id));
  const latestById = new Map(latest.map((l) => [l.submissionId, l]));

  return {
    items: rows.map((r): AuditItem => {
      const last = latestById.get(r.id);
      return {
        reference: r.reference,
        title: r.title,
        status: r.status,
        submitter: directory.get(r.submitterId),
        events: r.events,
        lastAt: r.lastAt,
        lastAction: last && isAuditAction(last.action) ? last.action : null,
        lastSummary: last?.summary ?? "",
      };
    }),
    total,
    page,
    pageCount,
  };
}

/** One queue item's complete trail, oldest first, or null if there's no such item. */
export async function getAuditTrail(actor: CurrentUser, reference: string) {
  assertCan(actor, "audit.view");
  const db = getDb();
  const [item] = await db
    .select({
      id: submissions.id,
      reference: submissions.reference,
      title: submissions.title,
      status: submissions.status,
      productLine: submissions.productLine,
      channel: submissions.channel,
      submitterId: submissions.submitterId,
      assigneeId: submissions.assigneeId,
    })
    .from(submissions)
    .where(eq(submissions.reference, reference))
    .limit(1);
  if (!item) return null;

  const [events, directory] = await Promise.all([
    db.select().from(auditEvents).where(eq(auditEvents.submissionId, item.id)).orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id)),
    getDirectory(),
  ]);
  return {
    item: {
      reference: item.reference,
      title: item.title,
      status: item.status,
      productLine: item.productLine,
      channel: item.channel,
      submitter: directory.get(item.submitterId),
      assignee: directory.get(item.assigneeId),
    },
    events: events.map((e) => toRow(e, directory)),
  };
}

/** Sign-ins, sign-outs, tracker imports and full-trail downloads: everything not about one queue item. */
export async function getAuditActivity(actor: CurrentUser, filters: AuditFilters) {
  assertCan(actor, "audit.view");
  const db = getDb();
  const parts: (SQL | undefined)[] = [isNull(auditEvents.submissionId)];
  if ((ACTIVITY_ACTIONS as readonly string[]).includes(filters.action)) parts.push(eq(auditEvents.action, filters.action));
  if (filters.q) parts.push(ilike(auditEvents.summary, likePattern(filters.q)));
  const where = and(...parts);

  const [[{ total }], directory] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(auditEvents).where(where),
    getDirectory(),
  ]);
  const { page, pageCount, offset } = pageOf(total, filters.page, AUDIT_PAGE_SIZE);
  const rows = await db
    .select()
    .from(auditEvents)
    .where(where)
    .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset(offset);

  return { rows: rows.map((r) => toRow(r, directory)), total, page, pageCount };
}

/**
 * The audit trail as CSV for an examiner: everything, or one queue item's
 * trail. Exporting is itself an audited event, recorded before the file is
 * handed over, and on the item's own trail when it's for one item.
 */
export async function exportAuditCsv(actor: CurrentUser, options: { reference?: string } = {}, now = new Date()) {
  assertCan(actor, "audit.export");
  const db = getDb();

  let item: { id: string; reference: string } | undefined;
  if (options.reference) {
    [item] = await db
      .select({ id: submissions.id, reference: submissions.reference })
      .from(submissions)
      .where(eq(submissions.reference, options.reference))
      .limit(1);
    if (!item) throw new UserFacingError(`There's no queue item ${options.reference} to download.`);
  }

  const [rows, directory] = await Promise.all([
    db
      .select()
      .from(auditEvents)
      .where(item ? eq(auditEvents.submissionId, item.id) : undefined)
      .orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id)),
    getDirectory(),
  ]);

  const csv = toCsv(
    ["event_id", "occurred_at_utc", "action", "action_label", "reference", "actor_id", "actor_name", "actor_role", "summary", "details", "session_id"],
    rows.map((r) => [
      r.id,
      r.occurredAt,
      r.action,
      isAuditAction(r.action) ? AUDIT_ACTIONS[r.action] : r.action,
      r.reference,
      r.actorId ?? "system",
      directory.get(r.actorId)?.name ?? "Review Hub (automatic)",
      r.actorRole ? ROLE_LABELS[r.actorRole] : "System",
      r.summary,
      JSON.stringify(r.details),
      r.sessionId,
    ]),
  );

  const scope = item ? ` for ${item.reference}` : "";
  await recordAudit(
    db,
    actor,
    {
      action: "audit.exported",
      summary: `${actor.name} exported the audit trail${scope} (${rows.length} events, CSV)`,
      details: { format: "csv", events: rows.length, ...(item ? { reference: item.reference } : {}) },
      ...(item ? { submission: item } : {}),
    },
    now,
  );

  const stamp = now.toISOString().slice(0, 10);
  return { csv, filename: `clearpath-audit-trail-${item ? `${item.reference}-` : ""}${stamp}.csv` };
}
