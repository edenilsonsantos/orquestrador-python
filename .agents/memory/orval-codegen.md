---
name: Orval codegen quirks (api-spec → api-zod / api-client-react)
description: Non-obvious behavior of the OpenAPI→Orval codegen used in this monorepo.
---

# Orval codegen quirks

**Rule:** Orval does not reliably emit a per-operation *response* zod schema for every operation (notably custom 201 response bodies). It emits `<Op>Body`, `<Op>Params`, and list/array response item schemas, but a create endpoint's success-body schema may simply not exist.

**Why:** Hit when adding `POST /api-keys` — expected an `ApiKeyCreated` zod export to `.parse()` the response, but it was never generated (only `CreateApiKeyBody`, `ListApiKeysResponse*` existed). Trying to import it broke the api-server typecheck.

**How to apply:**
- After running `pnpm --filter @workspace/api-spec run codegen`, grep the generated file for the exact export name before importing it: `grep -nE "export const <Name>" lib/api-zod/src/generated/api.ts`.
- If no response schema exists, return `res.status(201).json(serialize(obj))` directly (the codebase already does this in some routes) instead of forcing a `.parse()`.
- The codegen command also runs a typecheck step that can appear to "time out" in the tool while generation actually succeeded — verify by grepping for the new symbols rather than re-running blindly.
