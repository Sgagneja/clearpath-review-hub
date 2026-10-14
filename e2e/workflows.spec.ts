import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";
import { SAMPLES } from "../src/app/(app)/submissions/new/samples";
import type { ErrorWatch } from "./errors";
import { choose, exampleTracker, launchIn, openAs, submitSample, type FirstName } from "./people";

/**
 * Every workflow that writes to the database, driven through the screens the
 * way people use them, then checked row by row in each table:
 *
 *   users                read on every sign-in and assignment, never written
 *   submissions          created, assigned, claimed, decided, resubmitted, imported
 *   submission_versions  one per round, with who reviewed and decided it
 *   comments             questions, replies, decision notes, resubmission notes
 *   imports              one per spreadsheet or email brought in
 *   audit_events         one per change, sign-ins and exports included
 *
 * This writes data, so it only runs against a local database, which it
 * reseeds before and after. Copy comes from the app's own samples and test
 * cases; nothing is typed in by hand except reviewer comments.
 */

config({ path: [".env.local", ".env"], quiet: true });
const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const isLocal = (url: string) => /^[a-z]+:\/\/([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

test.skip(!isLocal(DATABASE_URL) || !isLocal(BASE_URL), "Workflow tests write data, so they only run against a local app and database.");
test.describe.configure({ mode: "default" });
test.use({ actionTimeout: 15_000 });

const sql = postgres(DATABASE_URL || "postgres://localhost/none", { max: 2, onnotice: () => {} });
const reseed = () => execSync("npm run db:seed", { stdio: "pipe" });

let userCount = 0;

test.beforeAll(async () => {
  reseed();
  [{ count: userCount }] = await sql<{ count: number }[]>`select count(*)::int as count from users`;
});

test.afterAll(async () => {
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from users`;
  expect(count, "nothing writes to users").toBe(userCount);
  await sql.end();
  reseed();
});

// Everyone's browser is watched, and a test fails if anyone saw an error along the way.
let watches: ErrorWatch[] = [];
test.afterEach(() => {
  const current = watches;
  watches = [];
  for (const watch of current) watch.expectNone();
});

async function signIn(browser: Browser, firstName: FirstName): Promise<Page> {
  const { page, errors } = await openAs(browser, firstName);
  watches.push(errors);
  return page;
}

async function submission(reference: string) {
  const [row] = await sql`select * from submissions where reference = ${reference}`;
  return row;
}

async function versions(reference: string) {
  return sql`
    select v.* from submission_versions v join submissions s on s.id = v.submission_id
    where s.reference = ${reference} order by v.version`;
}

async function commentKinds(reference: string) {
  const rows = await sql<{ kind: string; author_id: string }[]>`
    select c.kind, c.author_id from comments c join submissions s on s.id = c.submission_id
    where s.reference = ${reference} order by c.created_at`;
  return rows.map((r) => `${r.kind}:${r.author_id}`);
}

async function auditActions(reference: string) {
  const rows = await sql<{ action: string }[]>`select action from audit_events where reference = ${reference} order by id`;
  return rows.map((r) => r.action);
}

const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

interface Stages {
  waiting: number;
  review: number;
  marketing: number;
  decided: number;
}

/** The four counts across the top of the team overview, as the lead sees them. */
async function stages(page: Page): Promise<Stages> {
  await page.goto("/dashboard");
  const row = page.getByRole("region", { name: "Review stages" });
  const read = async (label: string) =>
    Number((await row.getByRole("link", { name: new RegExp(`^\\d+ ${label}$`) }).textContent())?.match(/\d+/)?.[0]);
  return {
    waiting: await read("waiting for a reviewer"),
    review: await read("under review"),
    marketing: await read("back with marketing"),
    decided: await read("decided this week"),
  };
}

/** Checks the overview moved by exactly `change` since `start`, so every step is counted once, in the right place. */
async function expectStages(page: Page, start: Stages, change: Partial<Stages>, step: string) {
  const expected = { ...start };
  for (const [key, delta] of Object.entries(change) as [keyof Stages, number][]) expected[key] += delta;
  expect(await stages(page), `team overview after: ${step}`).toEqual(expected);
}

const clean = SAMPLES.find((s) => s.id === "clean-loan")!;

test("a submission from first draft to approval, across four people", async ({ browser }) => {
  const dana = await signIn(browser, "Dana");
  const start = await stages(dana);

  const priya = await signIn(browser, "Priya");
  const reference = await submitSample(priya, "Risky loan email");

  await test.step("submitted: high risk, a 48-hour deadline, and it shows up as waiting", async () => {
    expect(await submission(reference)).toMatchObject({
      status: "submitted",
      submitter_id: "u_priya",
      assignee_id: null,
      current_version: 1,
      risk_score: 100,
      risk_level: "high",
    });
    const [v1] = await versions(reference);
    expect(v1.findings).toHaveLength(6);
    expect(hoursBetween(v1.submitted_at, v1.sla_due_at)).toBe(48);
    expect(await auditActions(reference)).toEqual(["submission.created", "precheck.completed"]);
    await expectStages(dana, start, { waiting: 1 }, "submitted");
  });

  await test.step("the lead assigns it to Marcus", async () => {
    await dana.goto(`/submissions/${reference}`);
    await dana.getByLabel("Assign a reviewer").selectOption("u_marcus");
    await dana.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(dana.getByText("Assigned to Marcus Bell, not picked up yet")).toBeVisible();
    expect((await submission(reference)).assignee_id).toBe("u_marcus");
    await expectStages(dana, start, { waiting: 1 }, "assigned, not started");
  });

  const marcus = await signIn(browser, "Marcus");
  await test.step("Marcus starts the review, asks a question and sends it back", async () => {
    await marcus.goto(`/submissions/${reference}`);
    await marcus.getByRole("button", { name: "Start review" }).click();
    await expect(marcus.getByRole("heading", { name: "In review" })).toBeVisible();
    await expectStages(dana, start, { review: 1 }, "review started");

    await marcus.getByPlaceholder("Comment on version 1…").fill("Can the APR sit right next to the monthly payment?");
    await marcus.getByRole("button", { name: "Post comment" }).click();
    await expect(marcus.getByText("Can the APR sit right next to the monthly payment?")).toBeVisible();

    await choose(marcus, "Request changes");
    await marcus.getByLabel(/What needs to change/).fill("Add the APR beside every rate and payment, and drop 'guaranteed'.");
    await marcus.getByRole("button", { name: "Send back for changes" }).click();
    await expect(marcus.getByRole("heading", { name: "Changes requested" })).toBeVisible();

    expect(await submission(reference)).toMatchObject({ status: "changes_requested" });
    const [v1] = await versions(reference);
    expect(v1).toMatchObject({ reviewer_id: "u_marcus", decided_by_id: "u_marcus", outcome: "changes_requested" });
    expect(v1.review_started_at).not.toBeNull();
    await expectStages(dana, start, { marketing: 1, decided: 1 }, "sent back");
  });

  await test.step("Priya replies and resubmits the compliant version", async () => {
    await priya.goto(`/submissions/${reference}`);
    await priya.getByPlaceholder("Comment on version 1…").fill("Will do, revising now.");
    await priya.getByRole("button", { name: "Post comment" }).click();
    await expect(priya.getByText("Will do, revising now.")).toBeVisible();

    await priya.getByRole("link", { name: "Revise and resubmit" }).click();
    await priya.getByLabel(/Revised copy/).fill(clean.body);
    await priya.getByLabel(/Note to the reviewer/).fill("APR added everywhere; removed the guarantee.");
    await priya.getByRole("button", { name: "Resubmit as version 2" }).click();
    await priya.waitForURL(/resubmitted=/);

    // Back in the queue with the same reviewer, who knows the asset already.
    // The fixed copy is clean, so it's low risk with the longest deadline.
    expect(await submission(reference)).toMatchObject({
      status: "submitted",
      current_version: 2,
      assignee_id: "u_marcus",
      risk_score: 0,
      risk_level: "low",
    });
    const [, v2] = await versions(reference);
    expect(v2).toMatchObject({ version: 2, submitted_by_id: "u_priya", outcome: null, findings: [] });
    expect(hoursBetween(v2.submitted_at, v2.sla_due_at)).toBe(120);
    await expectStages(dana, start, { waiting: 1, decided: 1 }, "resubmitted");
  });

  await test.step("Marcus approves version 2 and the lifecycle shows every round", async () => {
    await marcus.goto(`/submissions/${reference}`);
    await marcus.getByRole("button", { name: "Start review" }).click();
    await expect(marcus.getByRole("heading", { name: "In review" })).toBeVisible();
    await expectStages(dana, start, { review: 1, decided: 1 }, "version 2 review started");

    await marcus.goto(`/submissions/${reference}`);
    await choose(marcus, "Approve");
    await marcus.getByRole("button", { name: "Approve version 2" }).click();

    const lifecycle = marcus.getByRole("list", { name: "Where this submission is" });
    await expect(lifecycle).toContainText("Version 1 sent back");
    await expect(lifecycle).toContainText("Version 2 approved");
    await expect(lifecycle).toContainText("Cleared to launch");

    const sub = await submission(reference);
    expect(sub).toMatchObject({ status: "approved", current_version: 2 });
    expect(sub.closed_at).not.toBeNull();
    expect((await versions(reference)).map((v) => v.outcome)).toEqual(["changes_requested", "approved"]);
    await expectStages(dana, start, { decided: 2 }, "approved");
  });

  await test.step("every change is on the comments and the audit trail", async () => {
    expect(await commentKinds(reference)).toEqual([
      "comment:u_marcus",
      "decision:u_marcus",
      "comment:u_priya",
      "resubmission:u_priya",
    ]);
    expect(await auditActions(reference)).toEqual([
      "submission.created",
      "precheck.completed",
      "reviewer.assigned",
      "review.started",
      "comment.added",
      "decision.changes_requested",
      "comment.added",
      "submission.resubmitted",
      "precheck.completed",
      "review.started",
      "decision.approved",
    ]);
  });

  await test.step("the lead downloads the audit trail, and that's recorded too", async () => {
    await marcus.goto("/audit");
    await expect(marcus.getByRole("button", { name: "Download for Excel" }), "exporting is for the lead").toBeDisabled();

    const exports = async () =>
      (await sql`select count(*)::int as count from audit_events where action = 'audit.exported' and actor_id = 'u_dana'`)[0].count;
    const before = await exports();

    await dana.goto("/audit");
    const download = dana.waitForEvent("download");
    await dana.getByRole("button", { name: "Download for Excel" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    expect(await readFile(await file.path(), "utf8")).toContain(reference);
    expect(await exports(), "one export, one event").toBe(before + 1);
  });

  await test.step("the audit trail is organised by queue item, with the team's own activity apart", async () => {
    await dana.goto(`/audit?q=${reference}`);
    await expect(dana.getByRole("link", { name: new RegExp(reference) }).filter({ visible: true }).first()).toBeVisible();
    await expect(dana.getByText("Signed in", { exact: true }), "sign-ins aren't mixed in with queue items").toHaveCount(0);

    await dana.goto(`/audit/${reference}`);
    await expect(dana.getByRole("heading", { name: "11 events" })).toBeVisible();
    const download = dana.waitForEvent("download");
    await dana.getByRole("button", { name: "Download for Excel" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toContain(reference);
    const rows = (await readFile(await file.path(), "utf8")).trim().split(/\r?\n/);
    expect(rows, "a header and this item's 11 events, nothing else").toHaveLength(12);
    expect((await auditActions(reference)).at(-1), "downloading one item's trail is on that item's trail").toBe("audit.exported");

    await dana.goto("/audit/activity?action=session.signed_in&q=Priya");
    await expect(dana.getByText("Priya Raman signed in to the demo").filter({ visible: true }).first()).toBeVisible();
  });

  await test.step("signing out ends the session and is audited", async () => {
    await priya.getByRole("button", { name: /Switch person/ }).click();
    await priya.getByRole("button", { name: "Sign out" }).click();
    await priya.waitForURL(/\/login/);
    await priya.goto("/queue");
    await expect(priya).toHaveURL(/\/login/);
    const rows = await sql`select action from audit_events where actor_id = 'u_priya' and action like 'session.%' order by id`;
    expect(rows.map((r) => r.action)).toEqual(["session.signed_in", "session.signed_out"]);
  });
});

test("a rejection closes the submission with nothing to launch", async ({ browser }) => {
  const dana = await signIn(browser, "Dana");
  const start = await stages(dana);

  const priya = await signIn(browser, "Priya");
  const reference = await submitSample(priya, "Mortgage prequal post");
  expect(await submission(reference)).toMatchObject({ risk_score: 100, risk_level: "high" });
  const [v1] = await versions(reference);
  expect(v1.findings).toHaveLength(9);
  expect(hoursBetween(v1.submitted_at, v1.sla_due_at)).toBe(48);
  await expectStages(dana, start, { waiting: 1 }, "submitted");

  await dana.goto(`/submissions/${reference}`);
  await dana.getByRole("button", { name: "Start review" }).click();
  await choose(dana, "Reject");
  await dana.getByLabel(/Why it's rejected/).fill("Prequalification is presented as an approval; this can't run.");
  await dana.getByRole("button", { name: "Reject submission" }).click();
  await expect(dana.getByRole("list", { name: "Where this submission is" })).toContainText("Not launching");
  await expectStages(dana, start, { decided: 1 }, "rejected");

  const sub = await submission(reference);
  expect(sub).toMatchObject({ status: "rejected", assignee_id: "u_dana" });
  expect(sub.closed_at).not.toBeNull();
  expect(await commentKinds(reference)).toEqual(["decision:u_dana"]);
  expect(await auditActions(reference)).toEqual(["submission.created", "precheck.completed", "review.started", "decision.rejected"]);

  // Decided means closed: no more comments.
  await priya.goto(`/submissions/${reference}`);
  await expect(priya.getByRole("button", { name: "Post comment" })).toHaveCount(0);
});

test("nobody can review their own copy, and a test case saves nothing until submitted", async ({ browser }) => {
  const marcus = await signIn(browser, "Marcus");
  const dana = await signIn(browser, "Dana");
  const start = await stages(dana);
  const before = (await sql`select count(*)::int as count from submissions`)[0].count;

  await marcus.goto("/rules?product=credit_card");
  await marcus.locator("summary").filter({ hasText: "Everyone qualifies" }).click();
  await marcus.getByRole("link", { name: "Try it yourself" }).first().click();
  await expect(marcus.getByText(/^Test case:/)).toBeVisible();
  await expect(marcus.getByLabel("Name", { exact: true })).toHaveValue("Everyone qualifies");
  expect((await sql`select count(*)::int as count from submissions`)[0].count, "opening a test case saves nothing").toBe(before);
  await expectStages(dana, start, {}, "test case opened");

  await marcus.getByLabel("Target launch date").fill(launchIn(14));
  await marcus.getByRole("button", { name: "Submit for review" }).click();
  await marcus.waitForURL(/\/submissions\/MKT-\d+\?created=/);
  const reference = marcus.url().match(/MKT-\d+/)![0];
  // "Guaranteed approval" and "everyone qualifies" are two claims, so two high findings.
  expect(await submission(reference)).toMatchObject({
    submitter_id: "u_marcus",
    product_line: "credit_card",
    risk_score: 60,
    risk_level: "high",
  });
  const [v1] = await versions(reference);
  expect(v1.findings.map((f: { ruleId: string }) => f.ruleId)).toEqual(["udaap-absolute-claim", "udaap-absolute-claim"]);
  expect(hoursBetween(v1.submitted_at, v1.sla_due_at)).toBe(48);
  await expectStages(dana, start, { waiting: 1 }, "test case submitted");

  await marcus.goto(`/submissions/${reference}`);
  await expect(marcus.getByRole("button", { name: "Start review" })).toHaveCount(0);
  await expect(marcus.getByRole("radio", { name: /Approve/ })).toHaveCount(0);
  expect(await auditActions(reference)).toEqual(["submission.created", "precheck.completed"]);
});

test("a spreadsheet tracker comes in once, with its history", async ({ browser }) => {
  const dana = await signIn(browser, "Dana");
  const file = await exampleTracker(dana);

  const upload = async () => {
    await dana.goto("/import/spreadsheet");
    // The file is read in the browser, so wait for the page's script before picking one.
    await dana.waitForLoadState("networkidle");
    await dana.locator('input[type="file"]').setInputFiles(file);
  };

  const start = await stages(dana);
  await upload();
  await expect(dana.getByRole("heading", { name: "Ready to import" })).toBeVisible({ timeout: 30_000 });
  await dana.getByRole("button", { name: /^Import \d+ reviews?$/ }).click();
  await dana.waitForURL(/\/import\/[0-9a-f-]{36}/);
  const importId = dana.url().match(/[0-9a-f-]{36}/)![0];

  const [batch] = await sql`select * from imports where id = ${importId}`;
  expect(batch).toMatchObject({ kind: "spreadsheet", imported_by_id: "u_dana", file_name: file.name });
  expect(batch.file_sha256).toMatch(/^[0-9a-f]{64}$/);
  const n = batch.submission_count;
  expect(n).toBeGreaterThan(0);

  const counts = await sql`
    select
      (select count(*)::int from submissions where import_id = ${importId}) as submissions,
      (select count(*)::int from submission_versions v join submissions s on s.id = v.submission_id where s.import_id = ${importId}) as versions,
      (select count(*)::int from audit_events where action = 'submission.imported' and submission_id in (select id from submissions where import_id = ${importId})) as imported,
      (select count(*)::int from audit_events where action = 'import.tracker') as batches`;
  expect(counts[0]).toMatchObject({ submissions: n, imported: n, batches: 1 });
  expect(counts[0].versions).toBeGreaterThanOrEqual(n);

  await test.step("open reviews join the queue with their real deadlines; closed ones become history", async () => {
    const byStatus = await sql<{ status: string; count: number }[]>`
      select status, count(*)::int as count from submissions where import_id = ${importId} group by status`;
    expect(Object.fromEntries(byStatus.map((r) => [r.status, r.count]))).toEqual({
      approved: 3,
      changes_requested: 1,
      rejected: 1,
      in_review: 1,
      submitted: 2,
    });
    const open = await sql<{ title: string; status: string; risk_level: string; submitted_at: Date; sla_due_at: Date }[]>`
      select s.title, s.status, s.risk_level, v.submitted_at, v.sla_due_at
      from submissions s join submission_versions v on v.submission_id = s.id and v.version = s.current_version
      where s.import_id = ${importId} and s.status in ('submitted', 'in_review')
      order by v.submitted_at`;
    expect(open.map((r) => [r.title, r.status, r.risk_level, hoursBetween(r.submitted_at, r.sla_due_at)])).toEqual([
      ["October debt consolidation email", "in_review", "medium", 72],
      ["Rate drop alert email", "submitted", "high", 48],
      ["Student loan refinance landing page", "submitted", "low", 120],
    ]);
    // Deadlines run from when the tracker says the work came in, not from the import.
    const dueWithinADay = open.filter((r) => hoursBetween(new Date(), r.sla_due_at) < 24).map((r) => r.title);
    expect(dueWithinADay).toEqual(["October debt consolidation email", "Rate drop alert email"]);
    // Its decisions are weeks old, so they don't count as this week's.
    await expectStages(dana, start, { waiting: 2, review: 1, marketing: 1 }, "tracker imported");
  });

  await test.step("the same file again brings nothing in", async () => {
    await upload();
    await expect(dana.getByText(/already imported this exact file/)).toBeVisible({ timeout: 30_000 });
    expect((await sql`select count(*)::int as count from imports where kind = 'spreadsheet'`)[0].count).toBe(1);
  });
});

test("an email request comes in once, as a submission in the queue", async ({ browser }) => {
  const dana = await signIn(browser, "Dana");
  const bringIn = async () => {
    await dana.goto("/import/email");
    await dana.waitForLoadState("networkidle");
    await dana.getByRole("button", { name: "Try an example email" }).click();
    await dana.getByRole("button", { name: "Pull out the copy" }).click();
    await expect(dana.getByRole("heading", { name: "The request" })).toBeVisible();
    await dana.getByRole("button", { name: "Add to the review queue" }).click();
  };

  const start = await stages(dana);
  await bringIn();
  await dana.waitForURL(/\/submissions\/MKT-\d+\?imported=/);
  const reference = dana.url().match(/MKT-\d+/)![0];

  const sub = await submission(reference);
  expect(sub).toMatchObject({
    title: "First-home prequal landing page",
    product_line: "mortgage_prequal",
    channel: "landing_page",
    submitter_id: "u_sofia",
    status: "submitted",
    risk_score: 100,
    risk_level: "high",
  });
  const [v1] = await versions(reference);
  expect(v1.findings).toHaveLength(6);
  expect(hoursBetween(v1.submitted_at, v1.sla_due_at)).toBe(48);
  expect(hoursBetween(v1.submitted_at, new Date()), "the deadline counts from when the email arrived").toBeGreaterThan(1);
  await expectStages(dana, start, { waiting: 1 }, "email imported");
  expect(sub.import_id).not.toBeNull();
  expect(sub.source_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  const [batch] = await sql`select * from imports where id = ${sub.import_id}`;
  expect(batch).toMatchObject({ kind: "email", file_name: null, submission_count: 1, imported_by_id: "u_dana" });
  expect(await versions(reference)).toHaveLength(1);
  expect(await auditActions(reference)).toEqual(expect.arrayContaining(["submission.imported", "precheck.completed"]));

  await test.step("the same email again is caught", async () => {
    await bringIn();
    await expect(dana.getByText(`This email is already in Review Hub as ${reference}.`)).toBeVisible();
    expect((await sql`select count(*)::int as count from imports where kind = 'email'`)[0].count).toBe(1);
  });
});
