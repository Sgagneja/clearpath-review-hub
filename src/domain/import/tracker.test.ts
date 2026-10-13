import { describe, expect, it } from "vitest";
import { readSpreadsheet, type CellValue, type Sheet } from "@/lib/spreadsheet";
import { DEMO_USERS } from "../../../scripts/seed-data";
import { checkTracker, TRACKER_COLUMNS, TRACKER_MAX_ROWS, TRACKER_TAB, type TrackerField } from "./tracker";
import { buildTrackerExample, buildTrackerTemplate } from "./tracker-template";

const NOW = new Date("2026-10-13T16:00:00Z");
const PEOPLE = DEMO_USERS.map(({ id, name, email, role }) => ({ id, name, email, role }));
const HEADERS = TRACKER_COLUMNS.map((c) => c.header);

type RowInput = Partial<Record<TrackerField, CellValue>>;

const VALID: RowInput = {
  trackerId: "Q4-001",
  title: "Fall debt consolidation email",
  productLine: "Personal loan",
  channel: "Email",
  targetLaunchDate: "10/30/2026",
  submittedBy: "Priya Raman",
  submittedOn: "10/6/2026 9:30 AM",
  body: "Consolidate your debt with one fixed monthly payment. Subject to credit approval.",
  status: "Approved",
  reviewer: "marcus.bell@clearpath.example",
  decisionDate: "10/8/2026",
  reviewerNotes: null,
};

function sheet(rows: RowInput[], headers = HEADERS): Sheet {
  const fields = headers.map((h) => TRACKER_COLUMNS.find((c) => c.header === h)?.field);
  return {
    name: TRACKER_TAB,
    date1904: false,
    truncated: false,
    rows: [
      { number: 1, cells: headers },
      ...rows.map((r, i) => ({ number: i + 2, cells: fields.map((f) => (f ? (r[f] ?? null) : "extra")) })),
    ],
  };
}

const check = (rows: RowInput[], headers?: string[]) => checkTracker(sheet(rows, headers), PEOPLE, NOW);
const messages = (rows: RowInput[]) => check(rows).problems.map((p) => `${p.column}: ${p.message}`);

describe("checkTracker", () => {
  it("accepts a valid row and resolves people, dates and choices", () => {
    const result = check([VALID]);
    expect(result.problems).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      productLine: "personal_loan",
      channel: "email",
      status: "approved",
      submitterId: "u_priya",
      reviewerId: "u_marcus",
      targetLaunchDate: "2026-10-30",
    });
    expect(result.rows[0].submittedAt.toISOString()).toBe("2026-10-06T13:30:00.000Z");
  });

  it("imports the downloadable example without a single problem", () => {
    const example = readSpreadsheet("example.xlsx", buildTrackerExample(NOW), { preferredTab: TRACKER_TAB, maxRows: 600, maxColumns: 40 });
    const result = checkTracker(example, PEOPLE, NOW);
    expect(result.problems).toEqual([]);
    expect(result.rows.map((r) => r.status)).toEqual([
      "approved", "changes_requested", "approved", "rejected", "approved", "in_review", "submitted", "submitted",
    ]);
  });

  it("asks for column names on row 1, and finds them when they're lower down", () => {
    const blank = readSpreadsheet("t.xlsx", buildTrackerTemplate(), { preferredTab: TRACKER_TAB, maxRows: 10, maxColumns: 40 });
    expect(checkTracker(blank, PEOPLE, NOW).problems[0].message).toMatch(/no reviews under them/);

    const shifted = sheet([VALID]);
    shifted.rows = [{ number: 1, cells: ["Q3 marketing tracker"] }, ...shifted.rows.map((r) => ({ ...r, number: r.number + 2 }))];
    expect(checkTracker(shifted, PEOPLE, NOW).problems[0].message).toBe(
      "The column names are on row 3. Delete the rows above them so they start on row 1.",
    );
  });

  it("names missing columns and ignores extra ones", () => {
    const headers = HEADERS.filter((h) => h !== "Channel" && h !== "Status");
    expect(check([VALID], headers).problems[0].message).toMatch(/missing these columns: “Channel” and “Status”/);
    const extra = check([VALID], [...HEADERS, "Owner"]);
    expect(extra.problems).toEqual([]);
    expect(extra.ignoredColumns).toEqual(["Owner"]);
  });

  it("refuses files over the row limit", () => {
    const result = check(Array.from({ length: TRACKER_MAX_ROWS + 1 }, (_, i) => ({ ...VALID, trackerId: `T-${i}` })));
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].message).toMatch(/more than 500 reviews/);
  });

  it("explains values that aren't on the list", () => {
    expect(messages([{ ...VALID, productLine: "Auto loan" }])).toEqual([
      "Product: “Auto loan” isn't one of the options. Use Personal loan, Credit card or Mortgage prequal.",
    ]);
  });

  it("explains people it can't find", () => {
    expect(messages([{ ...VALID, submittedBy: "Jo Smith" }])[0]).toMatch(/don't have anyone called “Jo Smith”/);
    expect(messages([{ ...VALID, submittedBy: "jo@clearpath.example" }])[0]).toMatch(/No one on the team uses jo@clearpath\.example/);
  });

  it("enforces separation of duties and compliance-only reviewers", () => {
    expect(messages([{ ...VALID, submittedBy: "Marcus Bell" }])[0]).toMatch(/can't review their own submission/);
    expect(messages([{ ...VALID, reviewer: "Jordan Ellis" }])[0]).toMatch(/isn't on the compliance team/);
  });

  it("asks for what each status needs", () => {
    expect(messages([{ ...VALID, decisionDate: null }])).toEqual(["Decision date: Add the date it was marked Approved."]);
    expect(messages([{ ...VALID, status: "Rejected", reviewerNotes: null }])[0]).toMatch(/Add the reviewer's notes/);
    expect(messages([{ ...VALID, status: "In review", reviewer: null, decisionDate: null }])).toEqual(["Reviewer: Add who is reviewing it."]);
    expect(messages([{ ...VALID, status: "Awaiting review", reviewer: null }])[0]).toMatch(/can't have a decision date yet/);
  });

  it("catches impossible dates", () => {
    expect(messages([{ ...VALID, submittedOn: "13/10/2026" }])[0]).toMatch(/isn't a date we can read. Use month\/day\/year/);
    expect(messages([{ ...VALID, submittedOn: "11/1/2026", decisionDate: "11/2/2026" }])).toContain("Submitted on: This date is in the future.");
    expect(messages([{ ...VALID, decisionDate: "10/1/2026" }])).toEqual(["Decision date: The decision date is before the date it was submitted."]);
  });

  it("keeps a same-day decision after the submission time", () => {
    const [row] = check([{ ...VALID, submittedOn: "10/8/2026 3:00 PM", decisionDate: "10/8/2026" }]).rows;
    expect(row.decidedAt!.getTime()).toBe(row.submittedAt.getTime());
  });

  it("flags the same review twice in one file", () => {
    expect(check([VALID, { ...VALID, trackerId: "Q4-002" }]).problems[0].message).toMatch(/same review as row 2/);
    expect(check([VALID, { ...VALID, title: "Something else entirely" }]).problems[0].message).toMatch(/also used on row 2/);
  });

  it("imports nothing when any row has a problem", () => {
    const result = check([VALID, { ...VALID, trackerId: "Q4-002", title: "x" }]);
    expect(result.rows).toEqual([]);
    expect(result.problems).toHaveLength(1);
  });
});
