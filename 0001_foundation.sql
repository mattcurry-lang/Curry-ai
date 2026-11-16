-- Curry AI foundation schema. Run against the NEW Curry Supabase project only.
-- Principles: RLS on everything, deny by default, users can never change their own role/plan,
-- append-only audit log, assistant/tool messages and usage are written only by the server.

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  role         text not null default 'user' check (role in ('user', 'admin')),
  plan         text not null default 'free' check (plan in ('free', 'pro', 'team')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- conversations
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text check (char_length(title) <= 200),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)  -- lets messages prove they share the conversation's owner
);
create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- messages
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id         uuid not null,
  role            text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text not null check (char_length(content) <= 100000),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  -- A message can only point at a conversation owned by the same user.
  foreign key (conversation_id, user_id)
    references public.conversations (id, user_id) on delete cascade
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------- usage ledger (server-written)
create table public.usage_events (
  id                    bigint generated always as identity primary key,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  request_id            text not null,
  provider              text not null,
  model                 text not null,
  task_type             text not null,
  prompt_tokens         integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens     integer not null default 0 check (completion_tokens >= 0),
  estimated_cost_micros bigint  not null default 0 check (estimated_cost_micros >= 0), -- millionths of a USD
  latency_ms            integer check (latency_ms >= 0),
  status                text not null check (status in ('ok', 'error', 'timeout', 'rate_limited')),
  created_at            timestamptz not null default now()
);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

-- ---------------------------------------------------------------- audit log (server-written, append-only)
create table public.audit_log (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id) on delete set null,  -- survives account deletion
  actor         text not null check (actor in ('user', 'system', 'agent')),
  action        text not null,
  resource_type text,
  resource_id   text,
  request_id    text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_user_created_idx on public.audit_log (user_id, created_at desc);

create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- ---------------------------------------------------------------- privileges
-- Start from nothing, then grant only what the signed-in user needs.
revoke all on public.profiles, public.conversations, public.messages,
              public.usage_events, public.audit_log from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;      -- NOT role, NOT plan

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;            -- history is not editable by users
grant select on public.usage_events, public.audit_log to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.usage_events  enable row level security;
alter table public.audit_log     enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy conversations_all_own on public.conversations
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy messages_select_own on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
-- Users may only add their OWN messages. Assistant/tool/system rows come from the server (service role).
create policy messages_insert_own_user_role on public.messages
  for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'user');

create policy usage_select_own on public.usage_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy audit_select_own on public.audit_log
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update/delete policies on usage_events or audit_log: only the service role writes.
