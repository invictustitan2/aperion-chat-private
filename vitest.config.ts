import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Timeout configuration for worker tests
    testTimeout: 10000, // 10 seconds for individual tests
    hookTimeout: 60000, // 60 seconds for beforeAll/afterAll hooks
    // Use single fork to prevent worker conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Run tests in single process to avoid worker startup conflicts
      },
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/apps/web/test/**", // Exclude Playwright tests
    ],
  },
});
