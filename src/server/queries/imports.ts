import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { imports, submissions, users } from "@/db/schema";
import { assertCan } from "@/domain/permissions";
import { slaStatus, type SlaState } from "@/domain/sla";
import { OPEN_REVIEW_STATUSES, type RiskLevel, type Status } from "@/domain/types";
import type { CurrentUser } from "../auth";
import { getDirectory, type Person } from "./directory";

export interface ImportSummary {
  id: string;
  kind: "spreadsheet" | "email";
  fileName: string | null;
  importedAt: Date;
  importedBy: string;
  count: number;
}

export async function listImports(actor: CurrentUser, limit = 12): Promise<ImportSummary[]> {
  assertCan(actor, "import.run");
  return getDb()
    .select({
      id: imports.id,
      kind: imports.kind,
      fileName: imports.fileName,
      importedAt: imports.importedAt,
      importedBy: users.name,
      count: imports.submissionCount,
    })
    .from(imports)
    .innerJoin(users, eq(users.id, imports.importedById))
    .orderBy(desc(imports.importedAt))
    .limit(limit);
}

export interface ImportedItem {
  reference: string;
  title: string;
  status: Status;
  riskLevel: RiskLevel;
  assignee: Person | null;
  sourceLabel: string | null;
  /** Live deadline state for open items; null once a review is out of compliance's hands. */
  sla: SlaState | null;
  dueAt: Date;
}

export async function getImport(actor: CurrentUser, id: string, now = new Date()) {
  assertCan(actor, "import.run");
  const db = getDb();
  const [batch] = await db
    .select({
      id: imports.id,
      kind: imports.kind,
      fileName: imports.fileName,
      importedAt: imports.importedAt,
      importedBy: users.name,
      count: imports.submissionCount,
    })
    .from(imports)
    .innerJoin(users, eq(users.id, imports.importedById))
    .where(eq(imports.id, id))
    .limit(1);
  if (!batch) return null;

  const [rows, directory] = await Promise.all([
    db
      .select({
        reference: submissions.reference,
        title: submissions.title,
        status: submissions.status,
        riskLevel: submissions.riskLevel,
        assigneeId: submissions.assigneeId,
        sourceLabel: submissions.sourceLabel,
        createdAt: submissions.createdAt,
        slaDueAt: submissions.slaDueAt,
      })
      .from(submissions)
      .where(eq(submissions.importId, id))
      .orderBy(asc(submissions.slaDueAt)),
    getDirectory(),
  ]);

  const items: ImportedItem[] = rows.map((r) => ({
    reference: r.reference,
    title: r.title,
    status: r.status,
    riskLevel: r.riskLevel,
    assignee: directory.get(r.assigneeId),
    sourceLabel: r.sourceLabel,
    sla: OPEN_REVIEW_STATUSES.includes(r.status) ? slaStatus({ submittedAt: r.createdAt, dueAt: r.slaDueAt, now }).state : null,
    dueAt: r.slaDueAt,
  }));
  // Open work first, most urgent at the top: that's what the reviewer opens next.
  const open = items.filter((i) => i.sla !== null);
  const closed = items.filter((i) => i.sla === null).sort((a, b) => a.reference.localeCompare(b.reference));
  return { ...batch, open, closed };
}

export type ImportDetail = NonNullable<Awaited<ReturnType<typeof getImport>>>;
