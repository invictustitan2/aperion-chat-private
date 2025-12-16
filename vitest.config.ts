import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: repoRoot,
  test: {
    globals: true,
    testTimeout: 10000,
    hookTimeout: 120000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    environment: "node",
    environmentMatchGlobs: [
      ["apps/web/**/*.{test,spec}.?(c|m)[jt]s?(x)", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts", "./test/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.wrangler/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/apps/web/test/e2e/**",
      "**/apps/web/test-results/**",
      "**/apps/web/playwright-report/**",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage/vitest",
      reporter: ["text-summary", "json-summary", "html", "lcov"],
      all: true,
      include: [
        "apps/**/src/**/*.{js,jsx,ts,tsx}",
        "packages/**/src/**/*.{js,jsx,ts,tsx}",
        "tools/**/src/**/*.{js,jsx,ts,tsx}",
      ],
      exclude: [
        "**/*.{test,spec}.?(c|m)[jt]s?(x)",
        "**/test/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/.wrangler/**",
        "**/coverage/**",
        "**/playwright-report/**",
        "**/test-results/**",
      ],
    },
  },
});
