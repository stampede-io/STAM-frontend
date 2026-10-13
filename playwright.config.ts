import { defineConfig, devices } from "@playwright/test";

// The "real" project drives the SPA against a running compose stack with NO
// page.route() mocks (STAM-440 AC4). Opt in with RUN_REAL_E2E=1; it is the only
// spec that would have caught the SPA↔gateway join being broken.
const runReal = !!process.env.RUN_REAL_E2E;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]]
    : "html",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/real/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "integration",
      testDir: "./e2e/integration",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.BASE_URL ?? "http://localhost:5173",
      },
      timeout: 60_000,
    },
    ...(runReal
      ? [
          {
            name: "real",
            testDir: "./e2e/real",
            use: {
              ...devices["Desktop Chrome"],
              baseURL: process.env.BASE_URL ?? "http://localhost:5173",
            },
            timeout: 90_000,
          },
        ]
      : []),
  ],
  // Real runs point at a compose stack that already serves the SPA, so don't
  // spin up a dev server for them.
  webServer:
    process.env.CI || runReal
      ? undefined
      : {
          command: "npm run dev",
          url: "http://localhost:5173",
          reuseExistingServer: true,
        },
});
