import { expect, test, type Page } from "@playwright/test";

/** The app's own error screens. Seeing one means a page failed, whatever its status code. */
export const ERROR_SCREEN = /This page didn['’]t load|Review Hub didn['’]t load|Nothing filed under that/;

/**
 * Records anything on a page that a person would experience as an error: an
 * uncaught exception, a console error, a server error, or a page or link that
 * goes nowhere. Attach it before the first visit and call `expectNone()` once
 * the run is over, so one report lists everything that went wrong, and where.
 */
export function watchErrors(page: Page, who: string) {
  const errors: string[] = [];
  const allowedMissing = new Set<string>();
  const origin = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").origin;
  const where = () => {
    const url = page.url();
    return url.startsWith("http") ? new URL(url).pathname + new URL(url).search : "(no page)";
  };

  page.on("pageerror", (error) => errors.push(`${who} on ${where()}: uncaught ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The browser logs every failed request too; those are reported below, with their address.
    if (message.text().startsWith("Failed to load resource")) return;
    errors.push(`${who} on ${where()}: console error ${message.text().slice(0, 300)}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== origin) return;
    const status = response.status();
    const kind = response.request().resourceType();
    const pageLoad = kind === "document" || url.searchParams.has("_rsc");
    if (status >= 500 || (status === 404 && pageLoad && !allowedMissing.has(url.pathname))) {
      errors.push(`${who}: ${status} from ${response.request().method()} ${url.pathname}${url.search}`);
    }
  });

  return {
    /** For the one visit that's meant to land on "not found". */
    allowMissing(path: string) {
      allowedMissing.add(path);
    },
    async expectNoErrorScreen() {
      await expect(page.getByRole("heading", { name: ERROR_SCREEN }), `${who} hit an error screen on ${where()}`).toHaveCount(0);
    },
    expectNone() {
      expect(errors, `errors ${who} would have seen`).toEqual([]);
    },
  };
}

export type ErrorWatch = ReturnType<typeof watchErrors>;
