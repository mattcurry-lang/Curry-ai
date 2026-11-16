-- RLS isolation test. Run against a scratch/local Supabase database, as a superuser
-- (for example `psql "$DB_URL" -f supabase/tests/rls.test.sql`). It rolls back and leaves no data.
-- Any failed expectation raises an exception.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'alice@test.local'),
  ('00000000-0000-4000-8000-0000000000b2', 'bob@test.local');

insert into public.conversations (id, user_id, title) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a1', 'alice chat');
insert into public.messages (conversation_id, user_id, role, content) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a1', 'user', 'alice secret');
insert into public.usage_events (user_id, request_id, provider, model, task_type, status) values
  ('00000000-0000-4000-8000-0000000000a1', 'r1', 'groq', 'm', 'chat', 'ok');
insert into public.audit_log (user_id, actor, action) values
  ('00000000-0000-4000-8000-0000000000a1', 'system', 'test');

do $$
declare n int;
begin
  -- Act as Bob.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) into n from public.conversations; assert n = 0, 'bob can see alice conversations';
  select count(*) into n from public.messages;      assert n = 0, 'bob can see alice messages';
  select count(*) into n from public.usage_events;  assert n = 0, 'bob can see alice usage';
  select count(*) into n from public.audit_log;     assert n = 0, 'bob can see alice audit log';
  select count(*) into n from public.profiles;      assert n = 1, 'bob should see only his own profile';

  -- Bob cannot write into Alice's conversation.
  begin
    insert into public.messages (conversation_id, user_id, role, content)
    values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000b2', 'user', 'x');
    raise exception 'bob inserted into alice conversation';
  exception when foreign_key_violation or insufficient_privilege or check_violation then null; end;

  -- Bob cannot forge Alice as the author, or forge assistant messages for himself.
  begin
    insert into public.messages (conversation_id, user_id, role, content)
    values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a1', 'user', 'x');
    raise exception 'bob forged a message as alice';
  exception when insufficient_privilege or check_violation or foreign_key_violation then null; end;

  -- Bob cannot promote himself or change his plan.
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000b2';
    raise exception 'bob changed his own role';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set plan = 'team' where id = '00000000-0000-4000-8000-0000000000b2';
    raise exception 'bob changed his own plan';
  exception when insufficient_privilege then null; end;

  -- Users cannot write usage or audit rows.
  begin
    insert into public.usage_events (user_id, request_id, provider, model, task_type, status)
    values ('00000000-0000-4000-8000-0000000000b2', 'r', 'p', 'm', 't', 'ok');
    raise exception 'bob wrote usage';
  exception when insufficient_privilege then null; end;

  reset role;

  -- Act as Alice: she sees her own data, but cannot edit or delete message history.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into n from public.messages; assert n = 1, 'alice cannot see her own message';
  begin
    delete from public.messages;
    raise exception 'alice deleted message history';
  exception when insufficient_privilege then null; end;
  reset role;

  -- Audit log is append-only even for privileged roles.
  begin
    update public.audit_log set action = 'tampered';
    raise exception 'audit_log was updated';
  exception when raise_exception then
    if sqlerrm <> 'audit_log is append-only' then raise; end if;
  end;
end $$;

rollback;
