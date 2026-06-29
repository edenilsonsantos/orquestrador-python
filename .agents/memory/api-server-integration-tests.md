---
name: api-server integration tests
description: How the api-server response-shape integration tests are wired and the constraints that keep them isolated and meaningful.
---

# api-server response-shape integration tests

Vitest + supertest tests in `artifacts/api-server/test/` hit each route in-process
and re-validate the JSON body against the generated zod response schemas from
`@workspace/api-zod`. This catches the class of bug where a Drizzle `.select({...})`
projection stops returning a field the response schema requires — invisible to
`tsc`, only surfaces as a runtime 500.

**Why this design:** the routes already `.parse()` their own responses, but tests
re-parse independently AND assert joined fields (queueName, automationName,
machineName, counters) so coverage survives even if a route's own parse is removed.

**How to apply / constraints:**
- Tests run against an isolated `<PGDATABASE>_test` database, never the dev DB.
  The URL is derived in `test/test-db-url.ts` and injected via `vitest.config.ts`
  `test.env.DATABASE_URL` (read at import time by the `@workspace/db` singleton).
- `test/global-setup.ts` drops/recreates the test DB and runs
  `drizzle-kit push-force` so the schema always matches source-of-truth.
- Gotcha: `pg` is a dep of `@workspace/db`, NOT of `api-server`, so it cannot be
  imported directly from a test file (ViteNode "Cannot find package 'pg'"). Use
  `psql` via `execFileSync` in global setup instead.
- `fileParallelism: false` because all files share one seeded DB.
- Test files live in `test/` (outside `src/`) so the api-server `typecheck`
  script (`include: ["src"]`) is unaffected.
- Registered as the `test` validation command.
