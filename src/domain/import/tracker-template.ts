import { companyToday, partsToExcelSerial, type DateParts } from "@/lib/dates";
import { writeXlsx, type CellStyle, type WriteCell, type WriteColumn } from "@/lib/spreadsheet/write-xlsx";
import { TRACKER_COLUMNS, TRACKER_MAX_ROWS, TRACKER_TAB, type TrackerColumn, type TrackerField } from "./tracker";

/**
 * The two workbooks people can download from the import page: a blank
 * template, and the same template filled in with a realistic slice of an old
 * tracker so they can see (and test-import) exactly what we expect.
 */

const WIDTHS: Record<TrackerField, number> = {
  trackerId: 12,
  title: 34,
  productLine: 18,
  channel: 15,
  targetLaunchDate: 13,
  submittedBy: 18,
  submittedOn: 20,
  body: 64,
  status: 19,
  reviewer: 18,
  decisionDate: 20,
  reviewerNotes: 46,
};

const KIND_STYLE: Partial<Record<TrackerColumn["kind"], CellStyle>> = {
  date: "date",
  dateTime: "dateTime",
  longText: "wrap",
  text: "wrap",
};

function reviewColumns(): WriteColumn[] {
  return TRACKER_COLUMNS.map((c) => ({
    width: WIDTHS[c.field],
    style: KIND_STYLE[c.kind],
    list: c.allowed,
    date: c.kind === "date" || c.kind === "dateTime",
    prompt: `${c.requirement}. ${c.description}`,
  }));
}

function instructionsSheet() {
  const header = (value: string): WriteCell => ({ value, style: "header" });
  const note = (value: string): WriteCell => ({ value, style: "note" });
  return {
    name: "How to fill this in",
    columns: [{ width: 18 }, { width: 30, style: "wrap" as const }, { width: 70, style: "wrap" as const }, { width: 34, style: "wrap" as const }],
    rows: [
      [`Fill in the “${TRACKER_TAB}” tab: one review per row.`],
      [note("Keep the column names on row 1 exactly as they are. Dropdowns show the allowed values.")],
      [],
      [header("Column"), header("Required?"), header("What to enter"), header("Example")],
      ...TRACKER_COLUMNS.map((c) => [
        c.header,
        c.requirement,
        c.allowed ? `${c.description} Options: ${c.allowed.join(", ")}.` : c.description,
        c.example,
      ]),
      [],
      ["Good to know"],
      ...[
        `Up to ${TRACKER_MAX_ROWS} reviews per file. Save it as an Excel Workbook (.xlsx) or as CSV.`,
        "Nothing is imported until every row passes the checks. If something needs fixing, you'll see the exact row and column.",
        "The same review is never imported twice, so it's safe to upload a file again after fixing it.",
        "Open reviews (Awaiting review, In review) join the queue. Their deadline is counted from “Submitted on”.",
        "Dates are month/day/year, Eastern time. Without a time, we use midday.",
      ].map((line) => [null, note(line)]),
    ],
  };
}

export function buildTrackerTemplate(): Uint8Array {
  return writeXlsx([
    {
      name: TRACKER_TAB,
      columns: reviewColumns(),
      rows: [TRACKER_COLUMNS.map((c) => c.header)],
      header: true,
      validationRows: TRACKER_MAX_ROWS,
    },
    instructionsSheet(),
  ]);
}

interface ExampleRow {
  trackerId: string;
  title: string;
  productLine: string;
  channel: string;
  launchInDays: number;
  submittedBy: string;
  submitted: [daysAgo: number, hour: number, minute: number];
  body: string;
  status: string;
  reviewer?: string;
  decided?: [daysAgo: number, hour: number, minute: number];
  notes?: string;
}

/** A slice of a typical tracker: mostly closed history, a few still open. */
const EXAMPLE_ROWS: ExampleRow[] = [
  {
    trackerId: "Q3-031",
    title: "Summer refinance postcard",
    productLine: "Personal loan",
    channel: "Direct mail",
    launchInDays: -58,
    submittedBy: "Priya Raman",
    submitted: [74, 10, 5],
    body: "Refinance your high-interest debt with one fixed monthly payment.\n\nFixed rates from 8.99% APR to 29.99% APR, based on creditworthiness. Loan amounts from $2,000 to $40,000 with terms of 24 to 60 months. Checking your rate won't affect your credit score.\n\nAll loans are subject to credit approval. Terms apply.",
    status: "Approved",
    reviewer: "Marcus Bell",
    decided: [72, 15, 40],
    notes: "Disclosures complete. Approved as written.",
  },
  {
    trackerId: "Q3-034",
    title: "Cash+ card launch email",
    productLine: "Credit card",
    channel: "Email",
    launchInDays: -40,
    submittedBy: "Jordan Ellis",
    submitted: [57, 9, 20],
    body: "Subject: Meet Cash+\n\nEarn 3% cash back on everything you buy with the new ClearPath Cash+ card. 0% intro APR on purchases. No fees, ever.\n\nApply today.",
    status: "Changes requested",
    reviewer: "Kenji Watanabe",
    decided: [55, 11, 0],
    notes: "Add the intro APR period and the go-to APR, and qualify “no fees”: there's a foreign transaction fee.",
  },
  {
    trackerId: "Q3-036",
    title: "First-home prequal landing page",
    productLine: "Mortgage prequal",
    channel: "Landing page",
    launchInDays: -30,
    submittedBy: "Jordan Ellis",
    submitted: [44, 14, 10],
    body: "See what you could borrow for your first home. Getting prequalified takes about ten minutes and won't affect your credit score.\n\nPrequalification is not a commitment to lend. All loans are subject to credit approval and property appraisal.\n\nClearPath Home Lending, NMLS #402118. Equal Housing Lender.",
    status: "Approved",
    reviewer: "Alana Torres",
    decided: [41, 10, 25],
  },
  {
    trackerId: "Q3-040",
    title: "Holiday expenses Instagram post",
    productLine: "Personal loan",
    channel: "Social post",
    launchInDays: -21,
    submittedBy: "Sofia Marquez",
    submitted: [33, 16, 45],
    body: "Holiday bills piling up? Guaranteed approval on a ClearPath personal loan, money in your account tomorrow. Hurry, this offer won't last!",
    status: "Rejected",
    reviewer: "Marcus Bell",
    decided: [30, 9, 55],
    notes: "“Guaranteed approval” can't run in any form, and the urgency has no real deadline. Please rewrite from scratch.",
  },
  {
    trackerId: "Q4-002",
    title: "Balance transfer display ad (300×250)",
    productLine: "Credit card",
    channel: "Display ad",
    launchInDays: -6,
    submittedBy: "Jordan Ellis",
    submitted: [16, 11, 30],
    body: "Move your balance to ClearPath. 0% intro APR on balance transfers for 15 months, then 19.24%–28.24% variable APR. 3% balance transfer fee. Subject to credit approval. Terms apply.",
    status: "Approved",
    reviewer: "Kenji Watanabe",
    decided: [14, 13, 5],
  },
  {
    trackerId: "Q4-007",
    title: "October debt consolidation email",
    productLine: "Personal loan",
    channel: "Email",
    launchInDays: 9,
    submittedBy: "Priya Raman",
    submitted: [3, 9, 15],
    body: "Subject: One payment instead of five\n\nConsolidate your credit card balances into a single ClearPath personal loan. Rates as low as 7.99%. See your rate in two minutes.\n\nSubject to credit approval.",
    status: "In review",
    reviewer: "Marcus Bell",
  },
  {
    trackerId: "Q4-009",
    title: "Rate drop alert email",
    productLine: "Mortgage prequal",
    channel: "Email",
    launchInDays: 12,
    submittedBy: "Priya Raman",
    submitted: [2, 15, 50],
    body: "Subject: Rates just dropped\n\nYou're pre-approved to save on your next home. Get prequalified in minutes and lock in today's lowest rates.",
    status: "Awaiting review",
  },
  {
    trackerId: "Q4-010",
    title: "Student loan refinance landing page",
    productLine: "Personal loan",
    channel: "Landing page",
    launchInDays: 20,
    submittedBy: "Sofia Marquez",
    submitted: [1, 10, 0],
    body: "Refinance your student loans with ClearPath and you could lower your monthly payment. Fixed rates from 6.49% APR to 17.99% APR with autopay. Checking your rate won't affect your credit score. Subject to credit approval. Terms apply.",
    status: "Awaiting review",
  },
];

function companyDate(now: Date, daysFromToday: number, hour?: number, minute?: number): DateParts {
  const [y, m, d] = companyToday(now).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d + daysFromToday));
  return { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour, minute };
}

export function buildTrackerExample(now = new Date()): Uint8Array {
  const at = (when: [number, number, number] | undefined): WriteCell =>
    when ? partsToExcelSerial(companyDate(now, -when[0], when[1], when[2])) : null;
  const rows: WriteCell[][] = EXAMPLE_ROWS.map((r) => {
    const values: Record<TrackerField, WriteCell> = {
      trackerId: r.trackerId,
      title: r.title,
      productLine: r.productLine,
      channel: r.channel,
      targetLaunchDate: partsToExcelSerial(companyDate(now, r.launchInDays)),
      submittedBy: r.submittedBy,
      submittedOn: at(r.submitted),
      body: r.body,
      status: r.status,
      reviewer: r.reviewer ?? null,
      decisionDate: at(r.decided),
      reviewerNotes: r.notes ?? null,
    };
    return TRACKER_COLUMNS.map((c) => values[c.field]);
  });

  return writeXlsx([
    {
      name: TRACKER_TAB,
      columns: reviewColumns(),
      rows: [TRACKER_COLUMNS.map((c) => c.header), ...rows],
      header: true,
      validationRows: TRACKER_MAX_ROWS,
    },
    instructionsSheet(),
  ]);
}
