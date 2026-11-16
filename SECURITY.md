# Security notes

## Threats we design against
| Threat | Control | Where |
|---|---|---|
| Leaked API keys | Keys only in server env; `Secret` wrapper; log redaction; secret scanner in CI | ADR 0004 |
| Cross-user data access | RLS everywhere, user-scoped DB client, RLS tests | ADR 0003, `supabase/tests` |
| Self-promotion to admin or paid plan | Column-level grants: users can update `display_name` only | migration 0001 |
| Forged assistant history | Users may insert only `role = 'user'` messages | migration 0001 |
| Tampering with audit trail | Append-only trigger, no user write policies | migration 0001 |
| Prompt injection causing actions | Server-enforced approvals; untrusted content labelled as data | ADR 0005 (Phase 4) |
| Browser abuse of the API | Exact-match CORS allowlist, no wildcard | `apps/api/src/server.ts` |
| Info leaks through errors | Only `AppError` messages reach clients; everything else becomes a generic 500 | `packages/shared/src/errors.ts` |
| Accidental real charges in dev | Live Stripe keys refused outside production | `apps/api/src/config.ts` |

## Operational rules
- If a key is ever pasted into a chat, an issue, or a commit, treat it as compromised and rotate it.
- Use separate keys for development and production.
- Set a spend limit at each LLM provider and on Stripe.

## Not yet built
Authentication middleware, rate limiting, request body limits, file-upload handling, tool approvals. Each is scheduled in the roadmap and must ship with tests.
