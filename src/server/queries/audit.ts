import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { AUDIT_ACTIONS, isAuditAction, type AuditAction } from "@/domain/audit";
import { assertCan } from "@/domain/permissions";
import { ROLE_LABELS, type Role } from "@/domain/types";
import { toCsv } from "@/lib/csv";
import type { AuditFilters } from "@/lib/validation";
import { recordAudit } from "../audit";
import type { CurrentUser } from "../auth";
import { getDirectory, type Person } from "./directory";

export const AUDIT_PAGE_SIZE = 40;

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

function conditions(filters: AuditFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (filters.action !== "all" && isAuditAction(filters.action)) {
    parts.push(eq(auditEvents.action, filters.action));
  }
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    parts.push(or(ilike(auditEvents.summary, pattern), ilike(auditEvents.reference, pattern)));
  }
  return and(...parts);
}

export async function getAuditLog(actor: CurrentUser, filters: AuditFilters) {
  assertCan(actor, "audit.view");
  const db = getDb();
  const where = conditions(filters);

  const [[{ total }], directory] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(auditEvents).where(where),
    getDirectory(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const rows = await db
    .select()
    .from(auditEvents)
    .where(where)
    .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset((page - 1) * AUDIT_PAGE_SIZE);

  return {
    rows: rows.map(
      (r): AuditRow => ({
        id: r.id,
        occurredAt: r.occurredAt,
        action: isAuditAction(r.action) ? r.action : "precheck.completed",
        summary: r.summary,
        actor: directory.get(r.actorId),
        actorRole: r.actorRole,
        reference: r.reference,
        sessionId: r.sessionId,
      }),
    ),
    total,
    page,
    pageCount,
  };
}

/**
 * Full audit trail as CSV for an examiner. Exporting is itself an audited
 * event, recorded before the file is handed over.
 */
export async function exportAuditCsv(actor: CurrentUser, now = new Date()) {
  assertCan(actor, "audit.export");
  const db = getDb();
  const [rows, directory] = await Promise.all([
    db.select().from(auditEvents).orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id)),
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

  await recordAudit(db, actor, {
    action: "audit.exported",
    summary: `${actor.name} exported the audit trail (${rows.length} events, CSV)`,
    details: { format: "csv", events: rows.length },
  }, now);

  const stamp = now.toISOString().slice(0, 10);
  return { csv, filename: `clearpath-audit-trail-${stamp}.csv` };
}
