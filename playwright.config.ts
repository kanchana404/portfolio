import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run against a **production build**, never `next dev`.
 *
 * Dev-mode bundles are unminified, ship the React refresh runtime and skip
 * static generation, so every number this suite cares about — layout shift,
 * request counts, what is actually in the HTML a crawler receives — would be
 * measured against a build nobody ships.
 *
 * Port 3100 rather than 3000: 3000 is routinely occupied by another dev server
 * on this machine, and a suite that silently tests somebody else's app is worse
 * than no suite. `reuseExistingServer` is off in CI for the same reason.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // 375px is where a wrong reserved height costs the most, and it is where
      // most of this traffic will actually arrive.
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] }, // Chromium-based; iPhone SE would require WebKit
    },
  ],

  webServer: {
    command: `pnpm build && PORT=${PORT} pnpm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
