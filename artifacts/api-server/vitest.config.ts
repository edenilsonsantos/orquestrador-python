import { defineConfig } from "vitest/config";
import { deriveTestDatabaseUrl } from "./test/test-db-url";

const TEST_DATABASE_URL = deriveTestDatabaseUrl();

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Point the @workspace/db singleton at the isolated test database. This is
    // read at import time, so it must be injected into the test environment.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      // The scheduler reads PORT; tests never start it, but keep imports happy.
      NODE_ENV: "test",
    },
    // Tests share a single seeded database, so run files serially to avoid
    // cross-file interference from truncation/seeding.
    fileParallelism: false,
    include: ["test/**/*.test.ts"],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
