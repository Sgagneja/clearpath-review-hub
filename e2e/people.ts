import { expect, type Browser, type Page } from "@playwright/test";
import { watchErrors, type ErrorWatch } from "./errors";

export type FirstName = "Priya" | "Marcus" | "Alana" | "Dana";

const SLOW_DOWN = /going faster than a person usually does\. Try again in (\d+)s/;

/**
 * Signs in from the demo's sign-in page. Sign-ins are limited per address (10 at once,
 * then one every 6 seconds), which a test run against a fast build can reach, so this
 * waits when asked to and tries again, as a person would.
 */
export async function signInOn(page: Page, firstName: FirstName) {
  const slowDown = page.getByText(SLOW_DOWN);
  const signedIn = () => new URL(page.url()).pathname !== "/login";
  for (let attempt = 1; ; attempt++) {
    await page.goto("/login");
    await page.getByRole("button", { name: new RegExp(`Continue as ${firstName}`) }).click();
    await expect
      .poll(async () => signedIn() || (await slowDown.count().catch(() => 0)) > 0, { timeout: 30_000 })
      .toBe(true);
    if (signedIn()) break;
    if (attempt === 20) throw new Error(`${firstName} was still asked to slow down after ${attempt} sign-ins`);
    const seconds = Number((await slowDown.textContent())?.match(SLOW_DOWN)?.[1] ?? 6);
    await page.waitForTimeout(seconds * 1000);
  }
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** A separate browser session per person, as if each were on their own laptop, watched for errors. */
export async function openAs(browser: Browser, firstName: FirstName): Promise<{ page: Page; errors: ErrorWatch }> {
  const page = await (await browser.newContext()).newPage();
  const errors = watchErrors(page, firstName);
  await signInOn(page, firstName);
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
