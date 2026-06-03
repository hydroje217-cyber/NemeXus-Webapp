-- Copy and run this in the Supabase SQL editor to share monthly billed volume
-- entries between dashboard users.

create extension if not exists pgcrypto;

create table if not exists public.monthly_billed_volumes (
  id uuid primary key default gen_random_uuid(),
  month_key text not null unique check (month_key ~ '^\d{4}-\d{2}$'),
  billed_volume_m3 numeric(14, 2) not null check (billed_volume_m3 >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists monthly_billed_volumes_month_key_idx
  on public.monthly_billed_volumes (month_key);

create or replace function public.touch_monthly_billed_volumes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists monthly_billed_volumes_touch_updated_at on public.monthly_billed_volumes;
create trigger monthly_billed_volumes_touch_updated_at
before update on public.monthly_billed_volumes
for each row
execute function public.touch_monthly_billed_volumes_updated_at();

alter table public.monthly_billed_volumes enable row level security;

drop policy if exists "office users can read monthly billed volumes" on public.monthly_billed_volumes;
create policy "office users can read monthly billed volumes"
on public.monthly_billed_volumes
for select
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('manager', 'supervisor', 'admin', 'general_manager')
  )
);

drop policy if exists "office users can insert monthly billed volumes" on public.monthly_billed_volumes;
create policy "office users can insert monthly billed volumes"
on public.monthly_billed_volumes
for insert
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('manager', 'supervisor', 'admin', 'general_manager')
  )
);

insert into public.monthly_billed_volumes (month_key, billed_volume_m3)
values
  ('2025-12', 5895.89),
  ('2026-01', 7615.38),
  ('2026-02', 6658.00),
  ('2026-03', 4837.16),
  ('2026-04', 6629.99)
on conflict (month_key)
do update set billed_volume_m3 = excluded.billed_volume_m3;

drop policy if exists "office users can update monthly billed volumes" on public.monthly_billed_volumes;
create policy "office users can update monthly billed volumes"
on public.monthly_billed_volumes
for update
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('manager', 'supervisor', 'admin', 'general_manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('manager', 'supervisor', 'admin', 'general_manager')
  )
);
