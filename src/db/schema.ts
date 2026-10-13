import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CHANNELS,
  PRODUCT_LINES,
  ROLES,
  SEVERITIES,
  STATUSES,
  type Finding,
} from "../domain/types";

/**
 * Database schema. Column names are camelCase here and snake_case in Postgres
 * (Drizzle's `casing: "snake_case"`, set in both the client and drizzle-kit).
 *
 * Shape of the data:
 *   submissions          one row per marketing asset, holding its *current* state
 *   submission_versions  every revision of the copy, its pre-check findings and
 *                        how that review round went (picked up, decided, outcome)
 *   comments             reviewer/submitter discussion, tagged with a version
 *   imports              each spreadsheet or email brought in from the old
 *                        Excel-and-email process, and who brought it in
 *   audit_events         append-only log of everything that happened (see the
 *                        trigger in drizzle/0001_audit_append_only.sql)
 */

const timestamptz = () => timestamp({ withTimezone: true, mode: "date" });

export const roleEnum = pgEnum("role", ROLES);
export const productLineEnum = pgEnum("product_line", PRODUCT_LINES);
export const channelEnum = pgEnum("channel", CHANNELS);
export const statusEnum = pgEnum("submission_status", STATUSES);
export const riskLevelEnum = pgEnum("risk_level", SEVERITIES);
export const outcomeEnum = pgEnum("version_outcome", [
  "approved",
  "changes_requested",
  "rejected",
]);
export const commentKindEnum = pgEnum("comment_kind", ["comment", "decision", "resubmission"]);
export const importKindEnum = pgEnum("import_kind", ["spreadsheet", "email"]);

/** Feeds human-friendly references: MKT-1001, MKT-1002, … */
export const submissionReferenceSeq = pgSequence("submission_reference_seq", {
  startWith: 1001,
});

export const users = pgTable("users", {
  // Readable ids ("u_dana") keep the seed data and the audit export legible.
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  role: roleEnum().notNull(),
  title: text().notNull(),
  team: text().notNull(),
  createdAt: timestamptz().notNull().defaultNow(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    reference: text()
      .notNull()
      .unique()
      .default(sql`'MKT-' || nextval('submission_reference_seq')`),
    title: text().notNull(),
    productLine: productLineEnum().notNull(),
    channel: channelEnum().notNull(),
    targetLaunchDate: date({ mode: "string" }).notNull(),
    status: statusEnum().notNull().default("submitted"),
    submitterId: text()
      .notNull()
      .references(() => users.id),
    assigneeId: text().references(() => users.id),
    currentVersion: integer().notNull().default(1),
    // Denormalised from the current version so the queue can sort without joins.
    riskScore: integer().notNull(),
    riskLevel: riskLevelEnum().notNull(),
    slaDueAt: timestamptz().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
    updatedAt: timestamptz().notNull().defaultNow(),
    closedAt: timestamptz(),
    // Set only for reviews brought in from a tracker or an email.
    importId: uuid().references(() => imports.id),
    /** Where it came from, in words: “Q3 tracker.xlsx” · row 12. */
    sourceLabel: text(),
    /** SHA-256 of what identifies the original, so it can't be imported twice. */
    sourceFingerprint: text().unique(),
  },
  (t) => [
    index().on(t.status),
    index().on(t.assigneeId),
    index().on(t.submitterId),
    index().on(t.importId),
    check("submissions_risk_score_range", sql`${t.riskScore} BETWEEN 0 AND 100`),
    check("submissions_current_version_positive", sql`${t.currentVersion} >= 1`),
  ],
);

export const submissionVersions = pgTable(
  "submission_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    submissionId: uuid()
      .notNull()
      .references(() => submissions.id),
    version: integer().notNull(),
    body: text().notNull(),
    findings: jsonb().$type<Finding[]>().notNull(),
    riskScore: integer().notNull(),
    riskLevel: riskLevelEnum().notNull(),
    engineVersion: text().notNull(),
    note: text(),
    submittedById: text()
      .notNull()
      .references(() => users.id),
    submittedAt: timestamptz().notNull().defaultNow(),
    slaDueAt: timestamptz().notNull(),
    reviewStartedAt: timestamptz(),
    reviewerId: text().references(() => users.id),
    decidedAt: timestamptz(),
    decidedById: text().references(() => users.id),
    outcome: outcomeEnum(),
  },
  (t) => [
    uniqueIndex().on(t.submissionId, t.version),
    check(
      "submission_versions_decision_complete",
      sql`(${t.outcome} IS NULL) = (${t.decidedAt} IS NULL)`,
    ),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    submissionId: uuid()
      .notNull()
      .references(() => submissions.id),
    version: integer().notNull(),
    authorId: text()
      .notNull()
      .references(() => users.id),
    kind: commentKindEnum().notNull().default("comment"),
    body: text().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index().on(t.submissionId, t.createdAt)],
);

export const imports = pgTable(
  "imports",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: importKindEnum().notNull(),
    /** Uploaded file name; null when an email was pasted in. */
    fileName: text(),
    /** Lets us say "you imported this exact file on …" instead of listing every row. */
    fileSha256: text(),
    importedById: text()
      .notNull()
      .references(() => users.id),
    importedAt: timestamptz().notNull().defaultNow(),
    submissionCount: integer().notNull(),
  },
  (t) => [index().on(t.importedAt), index().on(t.fileSha256)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    occurredAt: timestamptz().notNull().defaultNow(),
    actorId: text().references(() => users.id),
    // Snapshot of the actor's role at the time: roles change, history doesn't.
    actorRole: roleEnum(),
    action: text().notNull(),
    submissionId: uuid().references(() => submissions.id),
    // Denormalised so the export reads well on its own.
    reference: text(),
    summary: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    sessionId: text(),
  },
  (t) => [
    index().on(t.occurredAt),
    index().on(t.submissionId),
    index().on(t.action),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type VersionRow = typeof submissionVersions.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type ImportRow = typeof imports.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
