# ADR 0003: Separate Supabase project, RLS as the isolation boundary

Status: accepted (Phase 0)

## Context
The old Curry used the service-role key for every query and relied on each query remembering `.eq('user_id', ...)`. One missed filter would leak data.

## Decision
- A brand-new Supabase project for Curry. No shared users, tables, or keys with Mattchat.
- RLS enabled on every table, with deny-by-default grants. Users get the minimum privileges they need.
- The API handles user requests with a client authenticated as that user (so RLS applies). The service-role client is allowed only for server-owned writes: assistant/tool messages, usage events, audit entries.
- `role` and `plan` can not be changed by users (column-level grants).
- Messages carry `user_id` and reference `(conversation_id, user_id)`, so a message can never be attached to someone else's conversation.
- RLS behaviour is covered by `supabase/tests/rls.test.sql`.

## Consequences
A bug in application code is much less likely to become a data leak. Server-owned writes need a clearly named service client, reviewed in every PR.
