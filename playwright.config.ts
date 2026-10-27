import { defineConfig } from "@playwright/test";

const port = 5190;

// Layout checks in a real browser against the development server.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The checks wait on the browser, not the CPU; use every core.
  workers: "100%",
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx tsx server/index.ts",
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
