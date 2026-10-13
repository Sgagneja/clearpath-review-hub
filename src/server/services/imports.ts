import "server-only";
import { createHash } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { comments, imports, submissions, submissionVersions, users } from "@/db/schema";
import { checkTracker, TRACKER_MAX_ROWS, TRACKER_TAB, type ImportProblem, type TrackerPerson, type TrackerRow } from "@/domain/import/tracker";
import { assertCan } from "@/domain/permissions";
import { runPrecheck } from "@/domain/precheck/engine";
import { slaDueAt } from "@/domain/sla";
import {
  OPEN_REVIEW_STATUSES,
  STATUSES,
  type Channel,
  type PrecheckResult,
  type ProductLine,
  type RiskLevel,
  type Status,
  type VersionOutcome,
} from "@/domain/types";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { readSpreadsheet, SpreadsheetFileError } from "@/lib/spreadsheet";
import { recordAuditMany, type AuditEntry } from "../audit";
import type { CurrentUser } from "../auth";
import { UserFacingError } from "../errors";
import { precheckDetails, precheckSummary } from "./submissions";

/**
 * Bringing the old Excel-and-email process into Review Hub.
 *
 * Both paths end the same way as a normal submission: the pre-check runs on
 * the copy, the review deadline is set from its risk, and the audit trail
 * records who brought it in and from where. Open items land in the queue
 * with their real age, so a request that has waited four days in someone's
 * inbox shows up as overdue rather than starting a fresh clock.
 */

const sha256 = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");

/** File names are user input: keep them readable and harmless in the UI and audit log. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001F\u007F"<>]/g, "").trim();
  return (cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned) || "spreadsheet";
}

const isUniqueViolation = (error: unknown): boolean => {
  const code = (e: unknown) => (typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : undefined);
  return code(error) === "23505" || code((error as { cause?: unknown })?.cause) === "23505";
};

async function loadPeople(): Promise<TrackerPerson[]> {
  return getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users);
}

/* ------------------------------------------------------------------ */
/* Spreadsheet                                                         */
/* ------------------------------------------------------------------ */

export interface TrackerPreviewRow {
  row: number;
  trackerId: string | null;
  title: string;
  productLine: ProductLine;
  channel: Channel;
  status: Status;
  submitter: string;
  reviewer: string | null;
  submittedAt: string;
  riskLevel: RiskLevel;
  findings: number;
  overdue: boolean;
}

export type TrackerPreview =
  | {
      ok: false;
      fileName: string;
      problems: ImportProblem[];
      moreProblems: number;
      ignoredColumns: string[];
      rowCount: number;
    }
  | {
      ok: true;
      fileName: string;
      tabName: string;
      rows: TrackerPreviewRow[];
      byStatus: Record<Status, number>;
      /** Open reviews that will join the queue. */
      open: number;
      /** …of which already past their deadline. */
      overdueOnArrival: number;
      /** Approved in the old tracker, but the pre-check would flag high risk today. */
      flaggedApprovals: number;
      ignoredColumns: string[];
    };

interface PreparedRow extends TrackerRow {
  fingerprintHash: string;
  precheck: PrecheckResult;
  dueAt: Date;
}

type Prepared =
  | { ok: false; preview: Extract<TrackerPreview, { ok: false }> }
  | { ok: true; fileName: string; fileSha256: string; tabName: string; ignoredColumns: string[]; rows: PreparedRow[]; people: TrackerPerson[] };

async function prepareTracker(file: { name: string; bytes: Uint8Array }, now: Date): Promise<Prepared> {
  const fileName = cleanFileName(file.name);
  const fail = (problems: ImportProblem[], extra: Partial<Extract<TrackerPreview, { ok: false }>> = {}): Prepared => ({
    ok: false,
    preview: { ok: false, fileName, problems, moreProblems: 0, ignoredColumns: [], rowCount: 0, ...extra },
  });

  let sheet;
  try {
    // One extra row past the limit (plus the header) tells us the file is too long.
    sheet = readSpreadsheet(fileName, file.bytes, { preferredTab: TRACKER_TAB, maxRows: TRACKER_MAX_ROWS + 2, maxColumns: 40 });
  } catch (error) {
    if (error instanceof SpreadsheetFileError) return fail([{ row: null, column: null, message: error.message }]);
    throw error;
  }

  const db = getDb();
  const fileSha256 = sha256(file.bytes);
  const [previous] = await db
    .select({ importedAt: imports.importedAt, count: imports.submissionCount, by: users.name })
    .from(imports)
    .innerJoin(users, eq(users.id, imports.importedById))
    .where(eq(imports.fileSha256, fileSha256))
    .orderBy(desc(imports.importedAt))
    .limit(1);
  if (previous) {
    return fail([
      {
        row: null,
        column: null,
        message: `${previous.by} already imported this exact file on ${formatDateTime(previous.importedAt)} (${pluralize(previous.count, "review")}). There's nothing new in it to bring in.`,
      },
    ]);
  }

  const people = await loadPeople();
  const check = checkTracker(sheet, people, now);
  if (check.problems.length > 0) {
    return fail(check.problems, { moreProblems: check.moreProblems, ignoredColumns: check.ignoredColumns, rowCount: check.dataRowCount });
  }

  const rows: PreparedRow[] = check.rows.map((row) => {
    const precheck = runPrecheck({ text: row.body, productLine: row.productLine, channel: row.channel });
    return { ...row, fingerprintHash: sha256(row.fingerprint), precheck, dueAt: slaDueAt(row.submittedAt, precheck.level) };
  });

  const existing = await db
    .select({ reference: submissions.reference, fingerprint: submissions.sourceFingerprint })
    .from(submissions)
    .where(inArray(submissions.sourceFingerprint, rows.map((r) => r.fingerprintHash)));
  if (existing.length > 0) {
    const referenceOf = new Map(existing.map((e) => [e.fingerprint, e.reference]));
    return fail(
      rows
        .filter((r) => referenceOf.has(r.fingerprintHash))
        .map((r) => ({
          row: r.rowNumber,
          column: null,
          message: `Already in Review Hub as ${referenceOf.get(r.fingerprintHash)}. Delete this row so it isn't imported twice.`,
        })),
      { rowCount: check.dataRowCount, ignoredColumns: check.ignoredColumns },
    );
  }

  return { ok: true, fileName, fileSha256, tabName: check.tabName, ignoredColumns: check.ignoredColumns, rows, people };
}

export async function checkTrackerFile(actor: CurrentUser, file: { name: string; bytes: Uint8Array }): Promise<TrackerPreview> {
  assertCan(actor, "import.run");
  const now = new Date();
  const prepared = await prepareTracker(file, now);
  if (!prepared.ok) return prepared.preview;

  const nameOf = new Map(prepared.people.map((p) => [p.id, p.name]));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const r of prepared.rows) byStatus[r.status] += 1;
  const openRows = prepared.rows.filter((r) => OPEN_REVIEW_STATUSES.includes(r.status));

  return {
    ok: true,
    fileName: prepared.fileName,
    tabName: prepared.tabName,
    ignoredColumns: prepared.ignoredColumns,
    byStatus,
    open: openRows.length,
    overdueOnArrival: openRows.filter((r) => r.dueAt < now).length,
    flaggedApprovals: prepared.rows.filter((r) => r.status === "approved" && r.precheck.level === "high").length,
    rows: prepared.rows.map((r) => ({
      row: r.rowNumber,
      trackerId: r.trackerId,
      title: r.title,
      productLine: r.productLine,
      channel: r.channel,
      status: r.status,
      submitter: nameOf.get(r.submitterId) ?? "",
      reviewer: r.reviewerId ? (nameOf.get(r.reviewerId) ?? null) : null,
      submittedAt: r.submittedAt.toISOString(),
      riskLevel: r.precheck.level,
      findings: r.precheck.findings.length,
      overdue: OPEN_REVIEW_STATUSES.includes(r.status) && r.dueAt < now,
    })),
  };
}

const DECIDED: readonly Status[] = ["changes_requested", "approved", "rejected"];

function trackerStory(row: TrackerRow, reviewer: string | null): string {
  const on = row.decidedAt ? ` on ${formatDate(row.decidedAt)}` : "";
  switch (row.status) {
    case "submitted":
      return reviewer ? `awaiting review, assigned to ${reviewer}` : "awaiting review";
    case "in_review":
      return `in review with ${reviewer}`;
    case "changes_requested":
      return `sent back for changes by ${reviewer}${on}`;
    case "approved":
      return `approved by ${reviewer}${on}`;
    case "rejected":
      return `rejected by ${reviewer}${on}`;
  }
}

export type TrackerImportResult = { ok: true; importId: string } | { ok: false; preview: Extract<TrackerPreview, { ok: false }> };

/**
 * Re-checks the file from scratch (the browser may have been sitting on an
 * old preview) and writes every row, or none, in one transaction.
 */
export async function importTrackerFile(actor: CurrentUser, file: { name: string; bytes: Uint8Array }): Promise<TrackerImportResult> {
  assertCan(actor, "import.run");
  const now = new Date();
  const prepared = await prepareTracker(file, now);
  if (!prepared.ok) return prepared;
  const { fileName, rows } = prepared;
  const nameOf = new Map(prepared.people.map((p) => [p.id, p.name]));

  try {
    return await getDb().transaction(async (tx) => {
      const [batch] = await tx
        .insert(imports)
        .values({ kind: "spreadsheet", fileName, fileSha256: prepared.fileSha256, importedById: actor.id, importedAt: now, submissionCount: rows.length })
        .returning({ id: imports.id });

      const created = await tx
        .insert(submissions)
        .values(
          rows.map((r) => ({
            title: r.title,
            productLine: r.productLine,
            channel: r.channel,
            targetLaunchDate: r.targetLaunchDate,
            status: r.status,
            submitterId: r.submitterId,
            assigneeId: r.reviewerId,
            riskScore: r.precheck.score,
            riskLevel: r.precheck.level,
            slaDueAt: r.dueAt,
            createdAt: r.submittedAt,
            updatedAt: r.decidedAt ?? r.submittedAt,
            closedAt: r.status === "approved" || r.status === "rejected" ? r.decidedAt : null,
            importId: batch.id,
            sourceLabel: `“${fileName}” · row ${r.rowNumber}${r.trackerId ? ` · tracker ID ${r.trackerId}` : ""}`,
            sourceFingerprint: r.fingerprintHash,
          })),
        )
        .returning({ id: submissions.id, reference: submissions.reference, fingerprint: submissions.sourceFingerprint });
      const submissionOf = new Map(created.map((c) => [c.fingerprint, { id: c.id, reference: c.reference }]));
      const target = (r: PreparedRow) => submissionOf.get(r.fingerprintHash)!;

      await tx.insert(submissionVersions).values(
        rows.map((r) => {
          const decided = DECIDED.includes(r.status);
          return {
            submissionId: target(r).id,
            version: 1,
            body: r.body,
            findings: r.precheck.findings,
            riskScore: r.precheck.score,
            riskLevel: r.precheck.level,
            engineVersion: r.precheck.engineVersion,
            submittedById: r.submitterId,
            submittedAt: r.submittedAt,
            slaDueAt: r.dueAt,
            // The tracker never recorded when a reviewer picked an item up.
            // In-review items count as picked up on arrival; decided ones leave it blank.
            reviewStartedAt: r.status === "in_review" ? r.submittedAt : null,
            reviewerId: r.status === "submitted" ? null : r.reviewerId,
            decidedAt: decided ? r.decidedAt : null,
            decidedById: decided ? r.reviewerId : null,
            outcome: decided ? (r.status as VersionOutcome) : null,
          };
        }),
      );

      const notes = rows.filter((r) => r.reviewerNotes && r.reviewerId);
      if (notes.length > 0) {
        await tx.insert(comments).values(
          notes.map((r) => {
            const decided = DECIDED.includes(r.status);
            return {
              submissionId: target(r).id,
              version: 1,
              authorId: r.reviewerId!,
              kind: decided ? ("decision" as const) : ("comment" as const),
              body: decided ? r.reviewerNotes! : `From the old tracker: ${r.reviewerNotes}`,
              createdAt: decided ? r.decidedAt! : now,
            };
          }),
        );
      }

      const events: { actor: CurrentUser | null; entry: AuditEntry }[] = rows.flatMap((r) => {
        const submission = target(r);
        const reviewer = r.reviewerId ? (nameOf.get(r.reviewerId) ?? null) : null;
        return [
          {
            actor,
            entry: {
              action: "submission.imported" as const,
              submission,
              summary: `${actor.name} imported this from “${fileName}”, row ${r.rowNumber}. The tracker had it as ${trackerStory(r, reviewer)}.`,
              details: { version: 1, importId: batch.id, row: r.rowNumber, trackerId: r.trackerId, status: r.status, riskScore: r.precheck.score },
            },
          },
          {
            actor: null,
            entry: { action: "precheck.completed" as const, submission, summary: precheckSummary(1, r.precheck), details: precheckDetails(1, r.precheck) },
          },
        ];
      });
      const open = rows.filter((r) => OPEN_REVIEW_STATUSES.includes(r.status)).length;
      events.push({
        actor,
        entry: {
          action: "import.tracker",
          summary: `${actor.name} imported ${pluralize(rows.length, "review")} from “${fileName}” (${open} still open)`,
          details: { importId: batch.id, fileName, reviews: rows.length, open },
        },
      });
      await recordAuditMany(tx, events, now);

      return { ok: true as const, importId: batch.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserFacingError("Some of these reviews were brought in by someone else a moment ago. Check the file again to see what's left.");
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

export interface EmailImportInput {
  title: string;
  productLine: ProductLine;
  channel: Channel;
  targetLaunchDate: string;
  body: string;
  senderId: string;
  receivedAt: Date;
  subject: string;
  /** The email's Message-ID header, when we had the original file. */
  messageId: string;
  fileName: string;
}

/**
 * One review request from the compliance inbox becomes a submission from
 * the person who sent it, with its deadline counted from when it arrived.
 */
export async function importEmail(actor: CurrentUser, input: EmailImportInput) {
  assertCan(actor, "import.run");
  const now = new Date();
  const db = getDb();

  const [sender] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, input.senderId))
    .limit(1);
  if (!sender) throw new UserFacingError("Choose who sent the email from the list.", "senderId");
  if (sender.role !== "submitter") {
    throw new UserFacingError(
      `${sender.name} is on the compliance team, so they can't be the one asking for review. Choose the marketing teammate who wrote the copy.`,
      "senderId",
    );
  }

  const key = input.messageId
    ? `email|id|${input.messageId.toLowerCase()}`
    : `email|${sender.id}|${input.receivedAt.toISOString().slice(0, 16)}|${input.body.toLowerCase().replace(/\s+/g, " ").trim()}`;
  const fingerprint = sha256(key);
  const [duplicate] = await db
    .select({ reference: submissions.reference })
    .from(submissions)
    .where(eq(submissions.sourceFingerprint, fingerprint))
    .limit(1);
  if (duplicate) throw new UserFacingError(`This email is already in Review Hub as ${duplicate.reference}.`);

  const precheck = runPrecheck({ text: input.body, productLine: input.productLine, channel: input.channel });
  const dueAt = slaDueAt(input.receivedAt, precheck.level);
  const sentOn = formatDateTime(input.receivedAt);

  try {
    return await db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(imports)
        .values({ kind: "email", fileName: input.fileName ? cleanFileName(input.fileName) : null, importedById: actor.id, importedAt: now, submissionCount: 1 })
        .returning({ id: imports.id });
      const [created] = await tx
        .insert(submissions)
        .values({
          title: input.title,
          productLine: input.productLine,
          channel: input.channel,
          targetLaunchDate: input.targetLaunchDate,
          submitterId: sender.id,
          riskScore: precheck.score,
          riskLevel: precheck.level,
          slaDueAt: dueAt,
          createdAt: input.receivedAt,
          updatedAt: now,
          importId: batch.id,
          sourceLabel: `Email from ${sender.name} · ${sentOn}${input.subject ? ` · “${input.subject}”` : ""}`,
          sourceFingerprint: fingerprint,
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
        submittedById: sender.id,
        submittedAt: input.receivedAt,
        slaDueAt: dueAt,
      });
      await recordAuditMany(
        tx,
        [
          {
            actor,
            entry: {
              action: "submission.imported",
              submission: created,
              summary: `${actor.name} brought this in from an email ${sender.name} sent on ${sentOn}`,
              details: { version: 1, importId: batch.id, source: "email", subject: input.subject || null },
            },
          },
          { actor: null, entry: { action: "precheck.completed", submission: created, summary: precheckSummary(1, precheck), details: precheckDetails(1, precheck) } },
        ],
        now,
      );
      return { reference: created.reference };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("This email was brought in by someone else a moment ago.");
    throw error;
  }
}
