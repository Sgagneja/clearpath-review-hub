import {
  companyToday,
  excelSerialToParts,
  fromCompanyWallTime,
  parseDateText,
  toIsoDate,
  type DateParts,
} from "@/lib/dates";
import { LIMITS } from "@/lib/validation";
import type { Sheet, CellValue } from "@/lib/spreadsheet";
import {
  CHANNEL_LABELS,
  CHANNELS,
  PRODUCT_LINE_LABELS,
  PRODUCT_LINES,
  STATUS_LABELS,
  STATUSES,
  type Channel,
  type ProductLine,
  type Role,
  type Status,
} from "../types";

/**
 * The review tracker template: the one spreadsheet layout we import.
 *
 * Teams arrive with years of history in hand-built Excel trackers, and every
 * one is laid out differently. Guessing at columns would quietly put wrong
 * data into a compliance record, so we accept exactly one documented layout
 * and explain precisely what to change when a file doesn't match. This list
 * drives the downloadable template, the on-screen guide and the checks
 * below, so the three can't disagree.
 */

export const TRACKER_TAB = "Reviews";
export const TRACKER_MAX_ROWS = 500;
const MAX_LISTED_PROBLEMS = 200;
const TRACKER_ID_MAX = 40;

export type TrackerField =
  | "trackerId"
  | "title"
  | "productLine"
  | "channel"
  | "targetLaunchDate"
  | "submittedBy"
  | "submittedOn"
  | "body"
  | "status"
  | "reviewer"
  | "decisionDate"
  | "reviewerNotes";

export interface TrackerColumn {
  field: TrackerField;
  header: string;
  /** Plain-language rule shown in the guide, e.g. "Required" or "Required for Approved". */
  requirement: string;
  /** False only for columns the file may leave out entirely. */
  mustBePresent: boolean;
  description: string;
  example: string;
  allowed?: readonly string[];
  kind: "text" | "longText" | "choice" | "date" | "dateTime" | "person";
}

const PRODUCT_CHOICES = PRODUCT_LINES.map((p) => PRODUCT_LINE_LABELS[p]);
const CHANNEL_CHOICES = CHANNELS.map((c) => CHANNEL_LABELS[c]);
const STATUS_CHOICES = STATUSES.map((s) => STATUS_LABELS[s]);

export const TRACKER_COLUMNS: readonly TrackerColumn[] = [
  {
    field: "trackerId",
    header: "Tracker ID",
    requirement: "Optional",
    mustBePresent: false,
    description: "The ID from your old tracker, if it had one. It's kept on the imported review so you can match the two up.",
    example: "Q3-041",
    kind: "text",
  },
  {
    field: "title",
    header: "Asset name",
    requirement: "Required",
    mustBePresent: true,
    description: `A short name for the piece of marketing (${LIMITS.titleMin}–${LIMITS.titleMax} characters).`,
    example: "Fall debt consolidation email",
    kind: "text",
  },
  {
    field: "productLine",
    header: "Product",
    requirement: "Required",
    mustBePresent: true,
    description: "The product being advertised. Pick from the dropdown.",
    example: "Personal loan",
    allowed: PRODUCT_CHOICES,
    kind: "choice",
  },
  {
    field: "channel",
    header: "Channel",
    requirement: "Required",
    mustBePresent: true,
    description: "Where customers will see it. Pick from the dropdown.",
    example: "Email",
    allowed: CHANNEL_CHOICES,
    kind: "choice",
  },
  {
    field: "targetLaunchDate",
    header: "Launch date",
    requirement: "Required",
    mustBePresent: true,
    description: "The day it goes out to customers.",
    example: "10/20/2026",
    kind: "date",
  },
  {
    field: "submittedBy",
    header: "Submitted by",
    requirement: "Required",
    mustBePresent: true,
    description: "Name or work email of the person who asked for the review. They must be on the team in Review Hub.",
    example: "Priya Raman",
    kind: "person",
  },
  {
    field: "submittedOn",
    header: "Submitted on",
    requirement: "Required",
    mustBePresent: true,
    description: "When the review was requested. Add a time if you have it. Review deadlines are counted from here.",
    example: "10/6/2026 9:30 AM",
    kind: "dateTime",
  },
  {
    field: "body",
    header: "Copy",
    requirement: "Required",
    mustBePresent: true,
    description: "Everything the customer reads: subject line, body and fine print, pasted into one cell.",
    example: "Subject: Consolidate your debt…",
    kind: "longText",
  },
  {
    field: "status",
    header: "Status",
    requirement: "Required",
    mustBePresent: true,
    description: "Where the review stands today. Pick from the dropdown.",
    example: "Approved",
    allowed: STATUS_CHOICES,
    kind: "choice",
  },
  {
    field: "reviewer",
    header: "Reviewer",
    requirement: `Required unless ${STATUS_LABELS.submitted}`,
    mustBePresent: true,
    description: "Name or work email of the compliance reviewer. It can't be the person who submitted it.",
    example: "Marcus Bell",
    kind: "person",
  },
  {
    field: "decisionDate",
    header: "Decision date",
    requirement: `Required for ${STATUS_LABELS.changes_requested}, ${STATUS_LABELS.approved}, ${STATUS_LABELS.rejected}`,
    mustBePresent: true,
    description: "When the reviewer made their decision. Leave blank while a review is still open.",
    example: "10/8/2026 3:15 PM",
    kind: "dateTime",
  },
  {
    field: "reviewerNotes",
    header: "Reviewer notes",
    requirement: `Required for ${STATUS_LABELS.changes_requested}, ${STATUS_LABELS.rejected}`,
    mustBePresent: true,
    description: `What the reviewer said and why (at least ${LIMITS.rationaleMin} characters when required).`,
    example: "Add the APR range and the credit-approval caveat.",
    kind: "longText",
  },
];

/** A person the import can attribute work to. Emails are matched, never shown. */
export interface TrackerPerson {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** One tracker row that passed every check. */
export interface TrackerRow {
  rowNumber: number;
  trackerId: string | null;
  title: string;
  productLine: ProductLine;
  channel: Channel;
  targetLaunchDate: string;
  submitterId: string;
  submittedAt: Date;
  body: string;
  status: Status;
  reviewerId: string | null;
  decidedAt: Date | null;
  reviewerNotes: string | null;
  /** Identifies the same review across uploads; hashed before it is stored. */
  fingerprint: string;
}

export interface ImportProblem {
  /** Excel row number, or null for a problem with the whole file. */
  row: number | null;
  /** Column header, when the problem is in one cell. */
  column: string | null;
  message: string;
}

export interface TrackerCheck {
  tabName: string;
  rows: TrackerRow[];
  problems: ImportProblem[];
  /** Problems past the listing cap, counted but not returned. */
  moreProblems: number;
  ignoredColumns: string[];
  dataRowCount: number;
}

/** "Asset Name *" and "asset name" both mean the Asset name column. */
function headerKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function joinList(values: readonly string[], word: "or" | "and"): string {
  return values.length <= 1 ? (values[0] ?? "") : `${values.slice(0, -1).join(", ")} ${word} ${values[values.length - 1]}`;
}

export const orList = (values: readonly string[]) => joinList(values, "or");
export const andList = (values: readonly string[]) => joinList(values, "and");

function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellText(cell: CellValue): string {
  if (cell === null) return "";
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell)
    .replace(/\r\n?/g, "\n")
    // Keep line breaks and tabs, drop other control characters.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

const quote = (text: string) => `“${text.length > 60 ? `${text.slice(0, 57)}…` : text}”`;

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** The fields that identify one review, independent of how the cells were typed. */
export function trackerFingerprint(row: Pick<TrackerRow, "title" | "submittedAt" | "body">): string {
  return ["tracker", normalizeForMatch(row.title), row.submittedAt.toISOString().slice(0, 10), normalizeForMatch(row.body)].join("|");
}

interface DateCell {
  parts: DateParts;
  iso: string;
}

function readDate(cell: CellValue, date1904: boolean): DateCell | null {
  const parts = typeof cell === "number" ? excelSerialToParts(cell, date1904) : parseDateText(cellText(cell));
  return parts ? { parts, iso: toIsoDate(parts) } : null;
}

function findHeaderRow(sheet: Sheet): number | null {
  const known = new Set(TRACKER_COLUMNS.map((c) => headerKey(c.header)));
  const candidate = sheet.rows.slice(0, 10).find((row) => row.cells.filter((c) => known.has(headerKey(cellText(c)))).length >= 3);
  return candidate?.number ?? null;
}

/**
 * Checks a whole sheet against the template. Nothing is imported unless this
 * returns no problems: a half-imported tracker is harder to reason about
 * than one that clearly says "fix these rows and upload again".
 */
export function checkTracker(sheet: Sheet, people: TrackerPerson[], now: Date): TrackerCheck {
  const problems: ImportProblem[] = [];
  let moreProblems = 0;
  const report = (row: number | null, column: string | null, message: string) => {
    if (problems.length < MAX_LISTED_PROBLEMS) problems.push({ row, column, message });
    else moreProblems += 1;
  };
  const result = (rows: TrackerRow[] = [], ignoredColumns: string[] = [], dataRowCount = 0): TrackerCheck => ({
    tabName: sheet.name,
    rows: problems.length === 0 ? rows : [],
    problems,
    moreProblems,
    ignoredColumns,
    dataRowCount,
  });

  const [header, ...dataRows] = sheet.rows;
  if (!header) {
    report(null, null, `The “${sheet.name}” tab is empty. Put the column names from the template on row 1, then one review per row.`);
    return result();
  }

  // 1. Column names on row 1, each known column exactly once.
  const columnIndex = new Map<TrackerField, number>();
  const ignoredColumns: string[] = [];
  if (header.number === 1) {
    header.cells.forEach((cell, index) => {
      const text = cellText(cell);
      if (!text) return;
      const column = TRACKER_COLUMNS.find((c) => headerKey(c.header) === headerKey(text));
      if (!column) {
        ignoredColumns.push(text);
      } else if (columnIndex.has(column.field)) {
        report(null, column.header, `The “${column.header}” column appears twice (columns ${columnLetter(columnIndex.get(column.field)!)} and ${columnLetter(index)}). Keep one.`);
      } else {
        columnIndex.set(column.field, index);
      }
    });
  }
  if (columnIndex.size === 0) {
    const foundAt = findHeaderRow(sheet);
    report(
      null,
      null,
      foundAt && foundAt !== 1
        ? `The column names are on row ${foundAt}. Delete the rows above them so they start on row 1.`
        : "Row 1 doesn't have the template's column names. Download the template and copy your reviews into it.",
    );
    return result();
  }
  const missing = TRACKER_COLUMNS.filter((c) => c.mustBePresent && !columnIndex.has(c.field)).map((c) => `“${c.header}”`);
  if (missing.length > 0) {
    report(null, null, `This file is missing ${missing.length === 1 ? "the column" : "these columns"}: ${andList(missing)}. Add ${missing.length === 1 ? "it" : "them"} to row 1, spelled as in the template.`);
    return result([], ignoredColumns);
  }

  // 2. Size.
  if (sheet.truncated || dataRows.length > TRACKER_MAX_ROWS) {
    report(null, null, `This file has more than ${TRACKER_MAX_ROWS} reviews. Split it into files of ${TRACKER_MAX_ROWS} or fewer and import them one after another.`);
    return result([], ignoredColumns, dataRows.length);
  }
  if (dataRows.length === 0) {
    report(null, null, "The column names are there, but there are no reviews under them.");
    return result([], ignoredColumns);
  }

  // 3. Every row.
  const byEmail = new Map(people.map((p) => [p.email.toLowerCase(), p]));
  const byName = new Map(people.map((p) => [normalizeForMatch(p.name), p]));
  const today = companyToday(now);
  const label = (field: TrackerField) => TRACKER_COLUMNS.find((c) => c.field === field)!.header;
  const rows: TrackerRow[] = [];
  const seenTrackerIds = new Map<string, number>();
  const seenFingerprints = new Map<string, number>();

  for (const row of dataRows) {
    const n = row.number;
    const raw = (field: TrackerField): CellValue => {
      const index = columnIndex.get(field);
      return index === undefined ? null : (row.cells[index] ?? null);
    };
    const text = (field: TrackerField) => cellText(raw(field));
    let rowOk = true;
    const fail = (field: TrackerField, message: string) => {
      rowOk = false;
      report(n, label(field), message);
    };

    const trackerId = text("trackerId") || null;
    if (trackerId && trackerId.length > TRACKER_ID_MAX) fail("trackerId", `Keep tracker IDs under ${TRACKER_ID_MAX} characters.`);

    const title = text("title").replace(/\s+/g, " ");
    if (!title) fail("title", "Add the asset's name.");
    else if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
      fail("title", `Names need ${LIMITS.titleMin}–${LIMITS.titleMax} characters; this one has ${title.length}.`);
    }

    const choice = <T extends string>(field: TrackerField, values: readonly T[], labels: Record<T, string>, noun: string): T | null => {
      const value = text(field);
      if (!value) {
        fail(field, `Pick the ${noun} from the dropdown.`);
        return null;
      }
      const match = values.find((v) => normalizeForMatch(labels[v]) === normalizeForMatch(value));
      if (!match) fail(field, `${quote(value)} isn't one of the options. Use ${orList(values.map((v) => labels[v]))}.`);
      return match ?? null;
    };
    const productLine = choice("productLine", PRODUCT_LINES, PRODUCT_LINE_LABELS, "product");
    const channel = choice("channel", CHANNELS, CHANNEL_LABELS, "channel");
    const status = choice("status", STATUSES, STATUS_LABELS, "status");

    const date = (field: TrackerField, required: boolean): DateCell | null => {
      const value = raw(field);
      if (value === null || cellText(value) === "") {
        if (required) fail(field, "Add a date.");
        return null;
      }
      const parsed = readDate(value, sheet.date1904);
      if (!parsed) {
        fail(field, `${quote(cellText(value))} isn't a date we can read. Use month/day/year, like 10/13/2026.`);
        return null;
      }
      return parsed;
    };
    const launch = date("targetLaunchDate", true);
    const submitted = date("submittedOn", true);
    if (submitted && submitted.iso > today) fail("submittedOn", "This date is in the future.");

    const person = (field: TrackerField): TrackerPerson | null => {
      const value = text(field);
      if (!value) return null;
      const email = value.match(/[^\s<>]+@[^\s<>]+/)?.[0]?.toLowerCase();
      const found = email ? byEmail.get(email) : byName.get(normalizeForMatch(value.replace(/<[^>]*>/, "")));
      if (!found) {
        fail(field, email
          ? `No one on the team uses ${email}. Use the work email of someone in Review Hub.`
          : `We don't have anyone called ${quote(value)} on the team. Use their full name as it appears in Review Hub, or their work email.`);
      }
      return found ?? null;
    };
    const submitter = person("submittedBy");
    if (!text("submittedBy")) fail("submittedBy", "Add who asked for the review.");

    const body = text("body");
    if (!body) fail("body", "Paste in the copy that was reviewed.");
    else if (body.length < LIMITS.bodyMin) fail("body", `This looks too short to be the full copy (${body.length} characters).`);
    else if (body.length > LIMITS.bodyMax) fail("body", `Copy is limited to ${LIMITS.bodyMax.toLocaleString("en-US")} characters; this has ${body.length.toLocaleString("en-US")}.`);

    // 4. What each status needs.
    const reviewer = person("reviewer");
    const decided = status === "changes_requested" || status === "approved" || status === "rejected";
    const decision = date("decisionDate", false);
    const notes = text("reviewerNotes") || null;

    if (status && status !== "submitted" && !text("reviewer")) {
      fail("reviewer", decided ? "Add who made the decision." : "Add who is reviewing it.");
    }
    if (reviewer && reviewer.role === "submitter") {
      fail("reviewer", `${reviewer.name} isn't on the compliance team, so they can't be the reviewer.`);
    } else if (reviewer && submitter && reviewer.id === submitter.id) {
      fail("reviewer", `${reviewer.name} can't review their own submission. Another reviewer has to be named.`);
    }
    if (status && decided && !decision && !text("decisionDate")) fail("decisionDate", `Add the date it was marked ${STATUS_LABELS[status]}.`);
    if (status && !decided && decision) {
      fail("decisionDate", `A review that's ${STATUS_LABELS[status]} can't have a decision date yet. Clear the date or change the status.`);
    }
    if (decision && decision.iso > today) fail("decisionDate", "This date is in the future.");
    if (decision && submitted && decision.iso < submitted.iso) fail("decisionDate", "The decision date is before the date it was submitted.");
    if ((status === "changes_requested" || status === "rejected") && (!notes || notes.length < LIMITS.rationaleMin)) {
      fail("reviewerNotes", notes ? `Say a little more (at least ${LIMITS.rationaleMin} characters) so the history explains the decision.` : "Add the reviewer's notes so the history explains the decision.");
    }
    if (notes && notes.length > LIMITS.commentMax) fail("reviewerNotes", `Notes are limited to ${LIMITS.commentMax.toLocaleString("en-US")} characters.`);

    if (!rowOk || !productLine || !channel || !status || !launch || !submitted || !submitter) continue;

    const submittedAt = clampToNow(fromCompanyWallTime(submitted.parts), now);
    let decidedAt = decision ? clampToNow(fromCompanyWallTime(decision.parts), now) : null;
    // A bare decision date on the day it was submitted still has to come after it.
    if (decidedAt && decidedAt < submittedAt) decidedAt = submittedAt;

    const parsed: TrackerRow = {
      rowNumber: n,
      trackerId,
      title,
      productLine,
      channel,
      targetLaunchDate: launch.iso,
      submitterId: submitter.id,
      submittedAt,
      body,
      status,
      reviewerId: reviewer?.id ?? null,
      decidedAt: decided ? decidedAt : null,
      reviewerNotes: notes,
      fingerprint: "",
    };
    parsed.fingerprint = trackerFingerprint(parsed);

    // 5. Repeats inside the file.
    const sameId = trackerId ? seenTrackerIds.get(trackerId.toLowerCase()) : undefined;
    const sameReview = seenFingerprints.get(parsed.fingerprint);
    if (sameId) {
      report(n, label("trackerId"), `Tracker ID ${quote(trackerId!)} is also used on row ${sameId}. Each review needs its own ID.`);
      continue;
    }
    if (sameReview) {
      report(n, null, `This is the same review as row ${sameReview} (same name, submission date and copy). Delete one of them.`);
      continue;
    }
    if (trackerId) seenTrackerIds.set(trackerId.toLowerCase(), n);
    seenFingerprints.set(parsed.fingerprint, n);
    rows.push(parsed);
  }

  return result(rows, ignoredColumns, dataRows.length);
}

function clampToNow(date: Date, now: Date): Date {
  return date.getTime() > now.getTime() ? now : date;
}
