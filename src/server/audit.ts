import "server-only";
import type { Executor } from "@/db/client";
import { auditEvents } from "@/db/schema";
import type { AuditAction } from "@/domain/audit";
import type { CurrentUser } from "./auth";

export interface AuditEntry {
  action: AuditAction;
  summary: string;
  submission?: { id: string; reference: string };
  details?: Record<string, unknown>;
}

/**
 * Appends to the audit trail. Callers pass the transaction they are already
 * in, so an event is written if and only if the change it describes commits.
 * A `null` actor records the system itself (e.g. the automated pre-check).
 */
export async function recordAudit(
  db: Executor,
  actor: CurrentUser | null,
  entry: AuditEntry,
  occurredAt: Date = new Date(),
): Promise<void> {
  await recordAuditMany(db, [{ actor, entry }], occurredAt);
}

/** Same as `recordAudit`, in one statement: imports write hundreds of events at once. */
export async function recordAuditMany(
  db: Executor,
  events: { actor: CurrentUser | null; entry: AuditEntry }[],
  occurredAt: Date = new Date(),
): Promise<void> {
  if (events.length === 0) return;
  await db.insert(auditEvents).values(
    events.map(({ actor, entry }) => ({
      occurredAt,
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      sessionId: actor?.sessionId ?? null,
      action: entry.action,
      summary: entry.summary,
      submissionId: entry.submission?.id ?? null,
      reference: entry.submission?.reference ?? null,
      details: entry.details ?? {},
    })),
  );
}
