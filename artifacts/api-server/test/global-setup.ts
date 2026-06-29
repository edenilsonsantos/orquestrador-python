import { execFileSync, execSync } from "node:child_process";
import {
  deriveAdminDatabaseUrl,
  deriveTestDatabaseUrl,
  testDatabaseName,
} from "./test-db-url";

// Vitest global setup: provision a clean, isolated test database before any test
// runs and push the current Drizzle schema into it. This guarantees the schema
// the tests run against always matches the source-of-truth table definitions.
export default async function setup(): Promise<void> {
  const adminUrl = deriveAdminDatabaseUrl();
  const testUrl = deriveTestDatabaseUrl();
  const dbName = testDatabaseName();

  // Drop and recreate so every run starts from a known-empty database. psql is
  // used here (rather than the `pg` driver) because it avoids adding a direct
  // dependency on the driver to this package.
  execFileSync("psql", [adminUrl, "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`], {
    stdio: "inherit",
  });
  execFileSync("psql", [adminUrl, "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${dbName}"`], {
    stdio: "inherit",
  });

  // Push the Drizzle schema into the freshly created test database. push-force
  // is non-interactive and safe here because the database is brand new.
  execSync("pnpm --filter @workspace/db run push-force", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
