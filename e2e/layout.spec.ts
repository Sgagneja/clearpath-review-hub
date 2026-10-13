import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Every page has to fit the screen it's opened on: a phone, a tablet, a
 * laptop or a large monitor. For each page (and the in-between states people
 * actually see, like an import preview) this fails if anything pushes past
 * the right edge, which is what makes a page scroll sideways on a phone.
 * Wide tables are fine as long as they scroll inside their own box.
 *
 * Screenshots land in .qa/layout/<screen>/ for a visual once-over.
 * Nothing here saves data: imports are checked but never confirmed.
 */

const SCREENSHOTS = process.env.LAYOUT_SCREENSHOTS !== "0";

async function signInAs(page: Page, firstName: "Dana" | "Priya") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`Continue as ${firstName}`) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function expectToFit(page: Page, name: string, testInfo: TestInfo) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const sticksOut = (el: Element) => el.getBoundingClientRect().right > width + 1;
    // Inside a scrolling or clipping box that itself fits, extra width is the box's business.
    // An absolutely positioned element (screen-reader text, say) is only clipped by boxes
    // that enclose its positioned ancestor, so boxes in between don't count.
    const contained = (el: Element) => {
      const floats = (position: string) => position === "absolute" || position === "fixed";
      let position = getComputedStyle(el).position;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const style = getComputedStyle(p);
        const anchor = style.transform !== "none" || (position === "absolute" && style.position !== "static");
        if (anchor) position = "static";
        if (!floats(position) && style.overflowX !== "visible" && !sticksOut(p)) return true;
        if (floats(style.position)) position = style.position;
      }
      return false;
    };
    const offenders: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || !sticksOut(el) || contained(el)) continue;
      // Report the outermost element that sticks out, not every descendant.
      const parent = el.parentElement;
      if (parent && parent !== document.body && sticksOut(parent) && !contained(parent)) continue;
      const classes = [...el.classList].slice(0, 4).join(".");
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
      offenders.push(`<${el.tagName.toLowerCase()}${classes ? `.${classes}` : ""}> ends at ${Math.round(box.right)}px: "${text}"`);
    }
    return { width, scrollWidth: document.documentElement.scrollWidth, offenders };
  });

  const detail = `${name} doesn't fit a ${report.width}px screen:\n  ${report.offenders.slice(0, 8).join("\n  ")}`;
  expect.soft(report.scrollWidth, detail).toBeLessThanOrEqual(report.width);
  expect.soft(report.offenders.length, detail).toBe(0);

  if (SCREENSHOTS) await page.screenshot({ path: `.qa/layout/${testInfo.project.name}/${name}.png`, fullPage: true });
}

async function visit(page: Page, testInfo: TestInfo, name: string, path: string) {
  await test.step(name, async () => {
    const response = await page.goto(path);
    expect.soft(response?.status() ?? 0, `${name} (${path}) failed to load`).toBeLessThan(500);
    await expectToFit(page, name, testInfo);
  });
}

async function firstHref(page: Page, path: string, pattern: RegExp) {
  await page.goto(path);
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.find((h) => pattern.test(h)) ?? null;
}

test("compliance lead: every page fits", async ({ page, isMobile }, testInfo) => {
  await visit(page, testInfo, "login", "/login");
  await signInAs(page, "Dana");

  await visit(page, testInfo, "dashboard", "/dashboard");
  await visit(page, testInfo, "queue", "/queue");
  await visit(page, testInfo, "queue-all", "/queue?status=all");
  await visit(page, testInfo, "new-submission", "/submissions/new");
  await visit(page, testInfo, "audit", "/audit");
  await visit(page, testInfo, "rules", "/rules");
  await visit(page, testInfo, "import", "/import");
  await visit(page, testInfo, "not-found", "/this-page-does-not-exist");

  const open = await firstHref(page, "/queue", /^\/submissions\/MKT-\d+$/);
  if (open) await visit(page, testInfo, "review-open", open);
  const decided = await firstHref(page, "/queue?status=approved", /^\/submissions\/MKT-\d+$/);
  if (decided) await visit(page, testInfo, "review-approved", decided);
  const batch = await firstHref(page, "/import", /^\/import\/[0-9a-f-]{36}$/);
  if (batch) await visit(page, testInfo, "import-result", batch);

  await visit(page, testInfo, "import-spreadsheet", "/import/spreadsheet");
  await test.step("import-spreadsheet-preview", async () => {
    const example = await page.request.get("/import/example");
    await page.locator('input[type="file"]').setInputFiles({
      name: "ClearPath review tracker example.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await example.body(),
    });
    await expect(page.getByRole("heading", { name: /Ready to import|can't import/ })).toBeVisible({ timeout: 30_000 });
    await expectToFit(page, "import-spreadsheet-preview", testInfo);
  });

  await visit(page, testInfo, "import-email", "/import/email");
  await test.step("import-email-confirm", async () => {
    await page.getByRole("button", { name: "Try an example email" }).click();
    await page.getByRole("button", { name: "Pull out the copy" }).click();
    await expect(page.getByRole("heading", { name: "The request" })).toBeVisible();
    await expectToFit(page, "import-email-confirm", testInfo);
  });

  if (isMobile) {
    await test.step("menu-open", async () => {
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Open menu" }).click();
      await expectToFit(page, "menu-open", testInfo);
    });
  }
});

test("submitter: every page fits", async ({ page }, testInfo) => {
  await signInAs(page, "Priya");

  await visit(page, testInfo, "submitter-queue", "/queue");
  await visit(page, testInfo, "submitter-new-submission", "/submissions/new");
  await visit(page, testInfo, "submitter-no-access", "/audit");

  const returned = await firstHref(page, "/queue?status=changes_requested", /^\/submissions\/MKT-\d+$/);
  if (returned) {
    await visit(page, testInfo, "submitter-review-returned", returned);
    await visit(page, testInfo, "submitter-revise", `${returned}/revise`);
  }
});
