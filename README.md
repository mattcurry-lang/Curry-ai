# Curry AI

An independent, agentic AI platform: "An AI that understands, remembers, reasons, plans and acts."

Curry is its own product. It has its own repo, Supabase project, auth, database and deployment, and it must never depend on Mattchat code, tables, or users. Mattchat may become a client of Curry's public API in a later phase.

## Status

**Phase 0 (foundations) is done.** There are no user-facing features yet. See `docs/architecture.md` for the plan and `docs/adr/` for the decisions behind it.

## Quick start

Requires Node 22.18 or newer.

```bash
npm install
cp .env.example .env     # then fill in values (never commit .env)
npm run check            # secret scan + typecheck + tests
npm run dev              # API on http://localhost:8787, try /healthz
```

## Layout

```
packages/shared   errors, branded ids, Secret wrapper (no dependencies)
apps/api          Node HTTP API: config validation, logging, CORS, /healthz
supabase/         migrations (schema + RLS) and RLS tests
scripts/          repo tooling (secret scanner)
docs/             architecture, ADRs, security notes
```

Planned (not yet created): `packages/core`, `providers`, `router`, `agents`, `memory`, `tools`, `apps/web`, `apps/worker`.

## Database

Apply `supabase/migrations/0001_foundation.sql` to the **new Curry Supabase project** (SQL editor or `supabase db push`), then run `supabase/tests/rls.test.sql` against a scratch database to prove that users are isolated.

## Rules of the repo

1. Never commit secrets. `npm run check:secrets` runs in CI.
2. API keys and the Supabase service-role key exist only on the backend.
3. `packages/core` never imports from `apps/*`.
4. Every decision that is hard to reverse gets an ADR in `docs/adr/`.
