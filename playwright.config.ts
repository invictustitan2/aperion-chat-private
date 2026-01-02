import { defineConfig, devices } from "@playwright/test";

const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? "test-results";
const reportDir = process.env.PLAYWRIGHT_REPORT_DIR ?? "playwright-report";
const junitOutputFile =
  process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE ?? `${outputDir}/junit.xml`;

export default defineConfig({
  testDir: "./apps/web/test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    [
      "html",
      {
        open: "never",
        outputFolder: reportDir,
      },
    ],
    ["junit", { outputFile: junitOutputFile }],
    ["list"],
  ],
  outputDir,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer:
    process.env.PLAYWRIGHT_BASE_URL &&
    !/^https?:\/\/localhost:5173\b/.test(process.env.PLAYWRIGHT_BASE_URL)
      ? undefined
      : {
          command: "pnpm --filter @aperion/web dev",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
