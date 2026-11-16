# Curry AI: architecture

Status: Phase 0 baseline. This describes the target; sections are marked **built** or **planned**.

## Shape

```
apps/web  ──HTTPS──►  apps/api  ──►  packages/core  ──►  router ──► providers (OpenAI, Gemini, Claude, DeepSeek, Groq, OpenRouter, Cerebras)
                          │               │  ├──► agents (supervisor + specialists)
                          │               │  ├──► memory (facts, summaries, retrieval)
                          │               │  └──► tools (registry + approval gate)
                          ▼
                  Supabase (Postgres + Auth + Storage), RLS enforced
apps/worker: long-running tasks, retries, schedules (planned)
```

## Dependency direction (enforced by review, later by lint)

`apps/*` → `packages/core` → `packages/{router,agents,memory,tools}` → `packages/{providers,shared}`.
Nothing in `packages/*` imports from `apps/*`. Core knows nothing about HTTP, React, or Supabase; it talks to storage through interfaces.

## Components

| Component | Responsibility | Status |
|---|---|---|
| shared | errors, ids, Secret | built |
| api | config, logging, CORS, health, request ids | built (skeleton) |
| database | profiles, conversations, messages, usage ledger, audit log, RLS | built (unapplied until you run it) |
| providers | one adapter per vendor behind a common interface, capability and price registry | Phase 1 |
| router | scoring by task, health, latency, cost; circuit breakers; failover; budgets | Phase 1 |
| auth, chat, streaming | sign-in, conversations, SSE responses, rate limiting | Phase 2 |
| memory | fact store, pgvector retrieval, summaries, memory manager | Phase 3 |
| tools | registry, risk levels, server-enforced approvals, audit | Phase 4 |
| agents | supervisor, planner, specialists, task tracking | Phase 5 |
| voice, multimodal | STT/TTS behind interfaces, file and image input | Phase 6 |
| billing | plans, payments, usage limits | Phase 7 |
| public API for Mattchat | versioned REST, scoped keys | Phase 8 |

## Data isolation

Every user-owned table has RLS enabled and deny-by-default grants. The API runs user requests with a client scoped to the user's JWT, so RLS applies. The service-role key is used only for server-owned writes (assistant messages, usage events, audit entries). See ADR 0003.

## Roadmap

0. Foundations (this phase)
1. Provider adapters, capability/price registry, router v2, usage ledger
2. Auth, onboarding, streaming chat, dashboard, rate limiting
3. Memory engine and memory manager UI
4. Tool registry, approval gate, first tools (web research, files, Gmail, Calendar)
5. Agents and supervisor
6. Voice and multimodal
7. Billing and hardening
8. Public API and Mattchat bridge
