-- RLS smoke test. Paste into Supabase → SQL Editor and click Run.
-- It creates two throw-away users inside a transaction, checks that user B
-- cannot see or change user A's private list, then rolls everything back.
-- Expected result: "Success. No rows returned" and a notice "RLS OK".
-- Any failure shows an error starting with "FAIL".

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-test-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-test-b@example.invalid');

set local role authenticated;

do $$
declare
  a constant text := '00000000-0000-4000-8000-00000000000a';
  b constant text := '00000000-0000-4000-8000-00000000000b';
  l uuid;
  n int;
begin
  -- user A creates a private list with a task
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select id into l from public.create_list('RLS test', '#4772fa');
  insert into public.tasks (list_id, title) values (l, 'secret');
  select count(*) into n from public.tasks where list_id = l;
  if n <> 1 then raise exception 'FAIL: owner cannot read own task'; end if;

  -- user B is not a member
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.tasks where list_id = l;
  if n <> 0 then raise exception 'FAIL: non-member can read tasks'; end if;

  select count(*) into n from public.lists where id = l;
  if n <> 0 then raise exception 'FAIL: non-member can read the list'; end if;

  select count(*) into n from public.list_members where list_id = l;
  if n <> 0 then raise exception 'FAIL: non-member can read list members'; end if;

  update public.tasks set title = 'hacked' where list_id = l;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: non-member can update tasks'; end if;

  delete from public.tasks where list_id = l;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: non-member can delete tasks'; end if;

  delete from public.lists where id = l;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: non-member can delete the list'; end if;

  begin
    insert into public.tasks (list_id, title) values (l, 'intruder');
    raise exception 'FAIL: non-member can insert tasks';
  exception when insufficient_privilege then null;
  end;

  raise notice 'RLS OK';
end $$;

rollback;
