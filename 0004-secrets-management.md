# ADR 0004: Secrets stay on the server and cannot leak by accident

Status: accepted (Phase 0)

## Decision
- Secrets come only from environment variables, validated at startup. Missing or malformed config stops the process and lists every problem by variable name, never by value.
- Credentials are wrapped in `Secret`, which prints as `[redacted]` through string conversion, JSON, and `console.log`. The only way to read one is an explicit `.reveal()`.
- The logger redacts sensitive keys (authorization, token, secret, api key, and so on).
- `.env` is git-ignored; `.env.example` documents every variable. `npm run check:secrets` fails the build if a credential-shaped string is committed.
- Live Stripe keys are rejected outside production.
- Nothing from this list reaches the browser. The frontend receives only the Supabase URL and the publishable/anon key.

## Consequences
Rotating a key is an environment change. Production secrets live in the host's secret manager, not in files.
