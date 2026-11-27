-- Shared Lists — phase 1 schema: profiles, lists, list members, tasks, RLS.
-- Run once in Supabase → SQL Editor (or `supabase db push`).

-- ---------- tables ----------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  color      text not null default '#4772fa' check (color in
               ('#4772fa','#e5484d','#f59e0b','#30a46c','#8e4ec6','#0ea5b7','#e93d82','#6b7280')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.list_members (
  list_id   uuid not null references public.lists(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner','editor')),
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_idx on public.list_members(user_id);

create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  list_id          uuid not null references public.lists(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 300),
  notes            text not null default '' check (char_length(notes) <= 10000),
  due_date         date,
  remind_at        timestamptz,
  reminder_sent_at timestamptz,
  priority         smallint not null default 0 check (priority between 0 and 3),
  done             boolean not null default false,
  done_at          timestamptz,
  assignee         uuid references auth.users(id) on delete set null,
  recurrence       jsonb,
  subtasks         jsonb not null default '[]' check (jsonb_typeof(subtasks) = 'array'),
  sort_order       double precision not null default 0,
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index tasks_list_idx on public.tasks(list_id);
create index tasks_due_reminder_idx on public.tasks(remind_at)
  where reminder_sent_at is null and done = false;

-- ---------- triggers ----------

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------- helpers (security definer so policies don't recurse) ----------

create or replace function public.is_member(p_list uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.list_members m
                 where m.list_id = p_list and m.user_id = auth.uid());
$$;

create or replace function public.is_owner(p_list uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.list_members m
                 where m.list_id = p_list and m.user_id = auth.uid() and m.role = 'owner');
$$;

create or replace function public.shares_list(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid() or exists (
    select 1 from public.list_members a
    join public.list_members b on b.list_id = a.list_id
    where a.user_id = auth.uid() and b.user_id = p_user);
$$;

-- Creating a list also makes the creator its owner.
create or replace function public.create_list(p_name text, p_color text default '#4772fa')
returns public.lists
language plpgsql security definer set search_path = '' as $$
declare r public.lists;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.lists (name, color, created_by)
    values (btrim(p_name), p_color, auth.uid()) returning * into r;
  insert into public.list_members (list_id, user_id, role)
    values (r.id, auth.uid(), 'owner');
  return r;
end $$;

revoke execute on function public.is_member(uuid), public.is_owner(uuid),
  public.shares_list(uuid), public.create_list(text, text) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid),
  public.shares_list(uuid), public.create_list(text, text) to authenticated;

-- ---------- privileges ----------

revoke all on public.profiles, public.lists, public.list_members, public.tasks from anon;
grant select, insert, update          on public.profiles     to authenticated;
grant select, update, delete          on public.lists        to authenticated;
grant select, delete                  on public.list_members to authenticated;
grant select, insert, update, delete  on public.tasks        to authenticated;

-- ---------- row level security ----------

alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_members enable row level security;
alter table public.tasks        enable row level security;

-- profiles: see yourself and people you share a list with; edit only yourself
create policy profiles_select on public.profiles for select to authenticated
  using (public.shares_list(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- lists: members read and edit; only the owner deletes; creation via create_list()
create policy lists_select on public.lists for select to authenticated
  using (public.is_member(id));
create policy lists_update on public.lists for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));
create policy lists_delete on public.lists for delete to authenticated
  using (public.is_owner(id));

-- list_members: members see each other; owner removes others; editors may leave
create policy members_select on public.list_members for select to authenticated
  using (public.is_member(list_id));
create policy members_delete on public.list_members for delete to authenticated
  using ((public.is_owner(list_id) and user_id <> auth.uid())
         or (user_id = auth.uid() and role = 'editor'));

-- tasks: everything only for members of the task's list
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_member(list_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_member(list_id));
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_member(list_id)) with check (public.is_member(list_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_member(list_id));
