---
name: Drizzle select projections must match the response zod schema
description: Why adding schema columns can 500 an endpoint even when typecheck passes
---

Routes in `artifacts/api-server` build responses with explicit Drizzle `.select({...})` projections and then validate them with the orval-generated response zod schema before sending.

**Rule:** when you add a column to a DB table that becomes a required field in the generated response schema, you must add it to every hand-written `.select({...})` that feeds that response — including join-helper functions shared by POST/PATCH/toggle handlers. Prefer one shared `columns` object reused across list/get/create/update so they cannot drift.

**Why:** the projection is hand-maintained and decoupled from the zod schema. TypeScript does not catch the gap (the parsed value is opaque to the select), so it surfaces only at runtime as a `ZodError: invalid_type ... received "undefined"` 500.

**How to apply:** after any schema or codegen change, actually hit each affected GET endpoint (curl), not just `tsc` — this class of mismatch is invisible to the compiler.

Related gotcha: `FOR UPDATE SKIP LOCKED` cannot be applied to a query containing a LEFT JOIN (Postgres rejects locking the nullable side). Claim by locking the base table alone, then fetch joined relations in a follow-up query.
