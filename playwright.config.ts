import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * Browser checks that unit tests can't make, like "does every page fit on a
 * phone". Locally they reuse `npm run dev` and the installed Chrome; in CI
 * they start the production build.
 */
export default defineConfig({
  testDir: "e2e",
  outputDir: ".qa/playwright",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The first visit to each page compiles it in dev, so a full sweep takes a while.
  timeout: 300_000,
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "chrome",
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "laptop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "desktop", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "wide", use: { viewport: { width: 2560, height: 1440 } } },
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
