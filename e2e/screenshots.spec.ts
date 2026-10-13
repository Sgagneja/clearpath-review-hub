import { expect, test, type Page } from "@playwright/test";

/**
 * Captures the screenshots used in the README (docs/screenshots/). Run after
 * a fresh `npm run db:seed` so the data matches the demo:
 *
 *   npm run docs:screenshots
 *
 * Nothing here saves data: the import is checked but never confirmed, and the
 * new submission is never sent.
 */

const OUT = "docs/screenshots";

async function signInAs(page: Page, firstName: "Dana" | "Priya") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`Continue as ${firstName}`) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function shoot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // The dev-mode indicator isn't part of the product.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82 });
}

test("desktop screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/login");
  await shoot(page, "login");

  await signInAs(page, "Dana");
  await page.goto("/queue");
  await shoot(page, "queue");

  const open = await page.locator('a[href^="/submissions/MKT-"]').first().getAttribute("href");
  expect(open).toBeTruthy();
  await page.goto(open!);
  await shoot(page, "review");

  await page.goto("/dashboard");
  await shoot(page, "dashboard");

  await page.goto("/import/spreadsheet");
  const example = await page.request.get("/import/example");
  await page.locator('input[type="file"]').setInputFiles({
    name: "ClearPath review tracker example.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await example.body(),
  });
  const ready = page.getByRole("heading", { name: /Ready to import/ });
  await expect(ready).toBeVisible({ timeout: 30_000 });
  await ready.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -24));
  await shoot(page, "import-preview");

  await page.goto("/import/email");
  await page.getByRole("button", { name: "Try an example email" }).click();
  await page.getByRole("button", { name: "Pull out the copy" }).click();
  await expect(page.getByRole("heading", { name: "The request" })).toBeVisible();
  await shoot(page, "import-email");

  await page.goto("/audit");
  await shoot(page, "audit");

  await signInAs(page, "Priya");
  await page.goto("/submissions/new");
  await page.getByRole("button", { name: "Risky loan email" }).click();
  await expect(page.getByText(/Live pre-check/)).toBeVisible();
  await shoot(page, "new-submission");
});

test("phone screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone");
  await signInAs(page, "Dana");
  await page.goto("/queue");
  await shoot(page, "phone-queue");

  const open = await page.locator('a[href^="/submissions/MKT-"]').first().getAttribute("href");
  await page.goto(open!);
  await shoot(page, "phone-review");
});
