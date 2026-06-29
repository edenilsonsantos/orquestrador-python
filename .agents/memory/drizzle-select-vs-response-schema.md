---
name: Drizzle select projections must match the response zod schema
description: Why adding schema columns can 500 an endpoint even when typecheck passes
---

Routes in `artifacts/api-server` build responses with explicit Drizzle `.select({...})` projections and then validate with the orval-generated response schema (e.g. `ListSchedulesResponse.parse(serialize(rows))`).

**Rule:** when you add a column to a DB table and that column becomes a required field in the OpenAPI/generated response schema, you MUST add it to every hand-written `.select({...})` that feeds that response — including join-helper functions used by POST/PATCH/toggle handlers. Prefer a single shared `columns` object reused across list/get/create/update so they cannot drift.

**Why:** the projection is hand-maintained and decoupled from the zod schema. TypeScript does not catch the gap (the parsed object is `unknown` to the select), so it surfaces only at runtime as a `ZodError: invalid_type ... received "undefined"` 500. This bit the schedules route after the Automations/Triggers remodel: the select still had the old column set while the regenerated `Schedule` schema required `minItemsToTrigger`, `maxConcurrentAgents`, `itemsPerAgent` plus the new join names.

**How to apply:** after any schema/codegen change, curl each affected GET endpoint (not just typecheck) to confirm it returns 200, since the mismatch is invisible to `tsc`.
