create extension if not exists pgcrypto;

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  role text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.profiles(id)
);

alter table public.password_reset_requests enable row level security;

create or replace function public.request_password_reset(account_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_profile public.profiles%rowtype;
begin
  select *
    into target_profile
    from public.profiles
    where lower(email) = lower(trim(account_email))
    limit 1;

  if target_profile.id is null then
    raise exception 'No account found for that email.';
  end if;

  insert into public.password_reset_requests (profile_id, email, role)
  values (target_profile.id, target_profile.email, coalesce(target_profile.role, 'operator'));
end;
$$;

create or replace function public.reset_profile_password_to_default(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_role text;
  target_profile public.profiles%rowtype;
  default_password text;
begin
  select role
    into admin_role
    from public.profiles
    where id = auth.uid();

  if admin_role is distinct from 'admin' then
    raise exception 'Only admins can reset account passwords.';
  end if;

  select *
    into target_profile
    from public.profiles
    where id = target_profile_id
    limit 1;

  if target_profile.id is null then
    raise exception 'Account not found.';
  end if;

  default_password := coalesce(target_profile.role, 'operator');

  update auth.users
    set encrypted_password = crypt(default_password, gen_salt('bf')),
        updated_at = now()
    where id = target_profile.id;

  update public.password_reset_requests
    set status = 'approved',
        handled_at = now(),
        handled_by = auth.uid()
    where profile_id = target_profile.id
      and status = 'pending';
end;
$$;

grant execute on function public.request_password_reset(text) to anon, authenticated;
grant execute on function public.reset_profile_password_to_default(uuid) to authenticated;

notify pgrst, 'reload schema';
