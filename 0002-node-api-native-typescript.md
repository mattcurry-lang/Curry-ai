# ADR 0002: Node API server, TypeScript run natively

Status: accepted (Phase 0)

## Context
The previous Curry ran as one Supabase edge function (Deno) with a 1,770-line handler. Long agent runs and streaming need a normal server process. The project wants minimal dependencies.

## Decision
- A long-running Node 22 API. Phase 0 uses only `node:http`. A router framework (Hono is the leading candidate) is chosen in Phase 2 when real routes exist, with its own ADR.
- TypeScript is executed directly by Node's built-in type stripping. No build step. `tsc` is used only for type checking (`noEmit`), with `erasableSyntaxOnly` so every file stays valid for stripping.
- Tests use `node:test`.

## Consequences
Only two dev dependencies (`typescript`, `@types/node`) and no runtime dependencies yet. Syntax that needs transformation (enums, parameter properties) is disallowed. If we later need bundling for a host, we can add a build step without changing source.
