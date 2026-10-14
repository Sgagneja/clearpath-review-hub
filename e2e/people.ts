import { expect, type Browser, type Page } from "@playwright/test";
import { watchErrors, type ErrorWatch } from "./errors";

export type FirstName = "Priya" | "Marcus" | "Alana" | "Dana";

/** A separate browser session per person, as if each were on their own laptop, watched for errors. */
export async function openAs(browser: Browser, firstName: FirstName): Promise<{ page: Page; errors: ErrorWatch }> {
  const page = await (await browser.newContext()).newPage();
  const errors = watchErrors(page, firstName);
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`Continue as ${firstName}`) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return { page, errors };
}

export function launchIn(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Sends one of New submission's built-in samples for review and returns its reference. */
export async function submitSample(page: Page, sample: string): Promise<string> {
  await page.goto("/submissions/new");
  await page.getByRole("button", { name: sample, exact: true }).click();
  await page.getByLabel("Target launch date").fill(launchIn(21));
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForURL(/\/submissions\/MKT-\d+\?created=/);
  return page.url().match(/MKT-\d+/)![0];
}

/** Decisions are cards wrapping a visually hidden radio, so click the card, as a person would. */
export async function choose(page: Page, decision: "Approve" | "Request changes" | "Reject") {
  await page.locator("label").filter({ has: page.getByRole("radio") }).filter({ hasText: new RegExp(`^${decision}`) }).click();
  await expect(page.getByRole("radio", { name: new RegExp(`^${decision}`) })).toBeChecked();
}

/** The example tracker from the import page, as a file to upload. */
export async function exampleTracker(page: Page) {
  const example = await page.request.get("/import/example");
  expect(example.ok(), "the example tracker downloads").toBe(true);
  return {
    name: "ClearPath review tracker example.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await example.body(),
  };
}
