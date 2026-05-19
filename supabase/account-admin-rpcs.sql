-- Run this in the Supabase SQL editor after adding the "general manager" role
-- in the web app. It keeps admins and general managers as account managers,
-- while preventing general managers from changing or deleting admin accounts.

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
      and pg_get_constraintdef(oid) ilike '%operator%'
      and pg_get_constraintdef(oid) ilike '%supervisor%'
      and pg_get_constraintdef(oid) ilike '%manager%'
      and pg_get_constraintdef(oid) ilike '%admin%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_record.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('operator', 'supervisor', 'manager', 'general manager', 'admin'));

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.is_account_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'general manager')
$$;

create or replace function public.approve_operator_account(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_account_manager() then
    raise exception 'Only admins and general managers can approve accounts.';
  end if;

  update public.profiles
  set
    is_active = true,
    is_approved = true,
    approved_at = coalesce(approved_at, now())
  where id = target_profile_id
    and role = 'operator';
end;
$$;

create or replace function public.assign_profile_role(target_profile_id uuid, next_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  caller_role := public.current_profile_role();

  if caller_role not in ('admin', 'general manager') then
    raise exception 'Only admins and general managers can change roles.';
  end if;

  if next_role not in ('operator', 'supervisor', 'manager', 'general manager', 'admin') then
    raise exception 'Invalid role.';
  end if;

  select role
  into target_role
  from public.profiles
  where id = target_profile_id;

  if caller_role = 'general manager' and target_role = 'admin' then
    raise exception 'General managers cannot change admin account roles.';
  end if;

  update public.profiles
  set
    role = next_role,
    is_active = true,
    is_approved = true,
    approved_at = coalesce(approved_at, now())
  where id = target_profile_id;
end;
$$;

create or replace function public.delete_profile_account(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_role text;
  target_role text;
begin
  caller_role := public.current_profile_role();

  if caller_role not in ('admin', 'general manager') then
    raise exception 'Only admins and general managers can delete accounts.';
  end if;

  if target_profile_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  select role
  into target_role
  from public.profiles
  where id = target_profile_id;

  if caller_role = 'general manager' and target_role = 'admin' then
    raise exception 'General managers cannot delete admin accounts.';
  end if;

  delete from auth.users
  where id = target_profile_id;

  delete from public.profiles
  where id = target_profile_id;
end;
$$;

grant execute on function public.approve_operator_account(uuid) to authenticated;
grant execute on function public.assign_profile_role(uuid, text) to authenticated;
grant execute on function public.delete_profile_account(uuid) to authenticated;
