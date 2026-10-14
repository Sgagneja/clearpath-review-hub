import { expect, test, type Page } from "@playwright/test";
import { SAMPLES } from "../src/app/(app)/submissions/new/samples";
import type { ErrorWatch } from "./errors";
import { choose, exampleTracker, openAs, submitSample, type FirstName } from "./people";

/**
 * The quick run-through. Signs in as a marketer, a reviewer and the lead,
 * moves between pages with the menu the way people do, then opens every page
 * those pages link to (filters, tabs, submissions, revisions, imports, rule
 * products, test cases) and fails on any error a person would see.
 *
 * That part only reads, so it's safe to point at the shared live demo:
 *
 *   npm run check:live    the live site
 *   npm run test:sweep    the app on this machine
 *
 * With SWEEP_ACTIONS=1 it also takes every action once, through the screens
 * and with the built-in samples. That writes demo data, so reset the demo
 * afterwards (`npm run db:seed`, plus `-- --yes` for the live database).
 */

test.describe.configure({ mode: "parallel" });
test.use({ actionTimeout: 15_000 });

const PEOPLE: { name: FirstName; role: string; menu: string[] }[] = [
  { name: "Priya", role: "marketing", menu: ["My submissions", "New submission", "Rule library"] },
  { name: "Marcus", role: "reviewer", menu: ["Team overview", "Review queue", "New submission", "Import", "Audit trail", "Rule library"] },
  { name: "Dana", role: "compliance lead", menu: ["Team overview", "Review queue", "New submission", "Import", "Audit trail", "Rule library"] },
];

// Downloads and sign-in aren't pages; downloads are fetched and checked separately.
const NOT_PAGES = /^\/(login|audit\/export|import\/(example|template))(\/|\?|$)/;
// Enough of each kind of page to catch a broken one, without opening every submission.
const PER_KIND = 5;
const MAX_PAGES = 40;

/** "/submissions/MKT-1042?created=1" and "/submissions/MKT-1050?created=1" are the same kind of page. */
function kindOf(path: string): string {
  const url = new URL(path, "http://x");
  const route = url.pathname.replace(/MKT-\d+/g, "MKT-*").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "*");
  return `${route}?${[...url.searchParams.keys()].sort().join("&")}`;
}

async function linksOn(page: Page): Promise<string[]> {
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")).map((h) => h.split("#")[0]);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

/** Moves through the menu without full page loads, the way people get between pages. */
async function clickThroughMenu(page: Page, errors: ErrorWatch, items: string[]) {
  const menu = page.getByRole("navigation", { name: "Main" });
  for (const item of items) {
    await test.step(`menu: ${item}`, async () => {
      const link = menu.getByRole("link", { name: new RegExp(`^${item}`) });
      const href = (await link.getAttribute("href"))!;
      await link.click();
      await page.waitForURL((url) => url.pathname === href);
      await settle(page);
      await errors.expectNoErrorScreen();
    });
  }
}

/** Opens every page reachable from where the person starts, a few of each kind. */
async function openEverything(page: Page, errors: ErrorWatch): Promise<number> {
  const queue = [new URL(page.url()).pathname];
  const seen = new Set(queue);
  const perKind = new Map<string, number>();
  let opened = 0;
  while (queue.length > 0 && opened < MAX_PAGES) {
    const path = queue.shift()!;
    await test.step(path, async () => {
      const response = await page.goto(path);
      expect.soft(response?.status() ?? 0, `${path} loads`).toBeLessThan(400);
      await settle(page);
      await errors.expectNoErrorScreen();
    });
    opened += 1;
    for (const href of await linksOn(page)) {
      if (seen.has(href) || NOT_PAGES.test(href)) continue;
      seen.add(href);
      const kind = kindOf(href);
      const count = perKind.get(kind) ?? 0;
      if (count >= PER_KIND) continue;
      perKind.set(kind, count + 1);
      queue.push(href);
    }
  }
  return opened;
}

for (const person of PEOPLE) {
  test(`${person.name} (${person.role}): every page opens without an error`, async ({ browser }) => {
    const { page, errors } = await openAs(browser, person.name);
    await settle(page);
    await errors.expectNoErrorScreen();

    await clickThroughMenu(page, errors, person.menu);
    await page.goto("/");
    const opened = await openEverything(page, errors);

    if (person.role !== "marketing") {
      for (const file of ["/import/template", "/import/example"]) {
        const download = await page.request.get(file);
        expect.soft(download.status(), `${file} downloads`).toBe(200);
      }
    }

    errors.expectNone();
    console.log(`${person.name}: menu and ${opened} pages, no errors`);
  });
}

test("every action, once, without an error", async ({ browser }) => {
  test.skip(process.env.SWEEP_ACTIONS !== "1", "Takes actions, which writes demo data. Set SWEEP_ACTIONS=1 to include it.");
  test.setTimeout(300_000);

  const people = await Promise.all((["Priya", "Marcus", "Dana"] as const).map((name) => openAs(browser, name)));
  const [priya, marcus, dana] = people.map((p) => p.page);
  const clean = SAMPLES.find((s) => s.id === "clean-loan")!;

  const reference = await test.step("submit, assign, start, comment, send back", async () => {
    const ref = await submitSample(priya, "Risky loan email");
    await dana.goto(`/submissions/${ref}`);
    await dana.getByLabel("Assign a reviewer").selectOption("u_marcus");
    await dana.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(dana.getByText("Assigned to Marcus Bell, not picked up yet")).toBeVisible();

    await marcus.goto(`/submissions/${ref}`);
    await marcus.getByRole("button", { name: "Start review" }).click();
    await expect(marcus.getByRole("heading", { name: "In review" })).toBeVisible();
    await marcus.getByPlaceholder("Comment on version 1…").fill("Can the APR sit next to the monthly payment?");
    await marcus.getByRole("button", { name: "Post comment" }).click();
    await expect(marcus.getByText("Can the APR sit next to the monthly payment?")).toBeVisible();
    await choose(marcus, "Request changes");
    await marcus.getByLabel(/What needs to change/).fill("Add the APR beside every rate, and drop 'guaranteed'.");
    await marcus.getByRole("button", { name: "Send back for changes" }).click();
    await expect(marcus.getByRole("heading", { name: "Changes requested" })).toBeVisible();
    return ref;
  });

  await test.step("reply, resubmit, approve", async () => {
    await priya.goto(`/submissions/${reference}`);
    await priya.getByPlaceholder("Comment on version 1…").fill("Will do.");
    await priya.getByRole("button", { name: "Post comment" }).click();
    await expect(priya.getByText("Will do.")).toBeVisible();
    await priya.getByRole("link", { name: "Revise and resubmit" }).click();
    await priya.getByLabel(/Revised copy/).fill(clean.body);
    await priya.getByLabel(/Note to the reviewer/).fill("APR added; guarantee removed.");
    await priya.getByRole("button", { name: "Resubmit as version 2" }).click();
    await priya.waitForURL(/resubmitted=/);

    await marcus.goto(`/submissions/${reference}`);
    await marcus.getByRole("button", { name: "Start review" }).click();
    await expect(marcus.getByRole("heading", { name: "In review" })).toBeVisible();
    await marcus.goto(`/submissions/${reference}`);
    await choose(marcus, "Approve");
    await marcus.getByRole("button", { name: "Approve version 2" }).click();
    await expect(marcus.getByRole("list", { name: "Where this submission is" })).toContainText("Cleared to launch");
  });

  await test.step("reject", async () => {
    const ref = await submitSample(priya, "Mortgage prequal post");
    await dana.goto(`/submissions/${ref}`);
    await dana.getByRole("button", { name: "Start review" }).click();
    await choose(dana, "Reject");
    await dana.getByLabel(/Why it's rejected/).fill("Prequalification is presented as an approval.");
    await dana.getByRole("button", { name: "Reject submission" }).click();
    await expect(dana.getByRole("list", { name: "Where this submission is" })).toContainText("Not launching");
  });

  await test.step("import the example tracker", async () => {
    const file = await exampleTracker(dana);
    await dana.goto("/import/spreadsheet");
    await settle(dana);
    await dana.locator('input[type="file"]').setInputFiles(file);
    const ready = dana.getByRole("heading", { name: "Ready to import" });
    const already = dana.getByText(/already imported this exact file/);
    await expect(ready.or(already)).toBeVisible({ timeout: 30_000 });
    if (await ready.isVisible()) {
      await dana.getByRole("button", { name: /^Import \d+ reviews?$/ }).click();
      await dana.waitForURL(/\/import\/[0-9a-f-]{36}/);
    }
  });

  await test.step("import the example email", async () => {
    await dana.goto("/import/email");
    await settle(dana);
    await dana.getByRole("button", { name: "Try an example email" }).click();
    await dana.getByRole("button", { name: "Pull out the copy" }).click();
    await expect(dana.getByRole("heading", { name: "The request" })).toBeVisible();
    await dana.getByRole("button", { name: "Add to the review queue" }).click();
    // A second run on the same day finds it's already in, which is also correct.
    await expect(async () => {
      const added = /\/submissions\/MKT-\d+\?imported=/.test(dana.url());
      const alreadyIn = (await dana.getByText(/already in Review Hub as/).count()) > 0;
      expect(added || alreadyIn).toBe(true);
    }).toPass({ timeout: 15_000 });
  });

  await test.step("try a test case without saving it", async () => {
    await marcus.goto("/rules?product=credit_card");
    await marcus.locator("summary").filter({ hasText: "Everyone qualifies" }).click();
    await marcus.getByRole("link", { name: "Try it yourself" }).first().click();
    await expect(marcus.getByText(/^Test case:/)).toBeVisible();
  });

  await test.step("download the audit trail", async () => {
    await dana.goto("/audit");
    const download = dana.waitForEvent("download");
    await dana.getByRole("button", { name: "Download for Excel" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  });

  await test.step("sign out", async () => {
    await priya.getByRole("button", { name: /Switch person/ }).click();
    await priya.getByRole("button", { name: "Sign out" }).click();
    await priya.waitForURL(/\/login/);
  });

  for (const { errors } of people) errors.expectNone();
});
