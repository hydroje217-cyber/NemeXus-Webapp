-- Copy and run this in the Supabase SQL editor to enable account active status.
-- This adds a lightweight heartbeat timestamp to profiles.

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_user_agent text;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc);

create or replace function public.update_account_presence(presence_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    last_seen_at = now(),
    last_seen_user_agent = left(presence_user_agent, 500)
  where id = auth.uid();

  if not found then
    raise exception 'No profile found for the signed-in account.';
  end if;
end;
$$;

grant execute on function public.update_account_presence(text) to authenticated;
