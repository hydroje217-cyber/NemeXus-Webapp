create table if not exists public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_date date not null,
  shift_key text not null check (shift_key in ('A', 'B', 'C')),
  site_id uuid not null references public.sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'missed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_date, site_id, shift_key)
);

alter table public.shift_assignments enable row level security;

create policy "Office users can view shift assignments"
  on public.shift_assignments
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('manager', 'supervisor', 'admin')
        and profiles.is_active = true
        and profiles.is_approved = true
    )
  );

create policy "Managers and admins can manage shift assignments"
  on public.shift_assignments
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('manager', 'admin')
        and profiles.is_active = true
        and profiles.is_approved = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('manager', 'admin')
        and profiles.is_active = true
        and profiles.is_approved = true
    )
  );

create or replace function public.set_shift_assignment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_shift_assignment_updated_at on public.shift_assignments;

create trigger set_shift_assignment_updated_at
before update on public.shift_assignments
for each row
execute function public.set_shift_assignment_updated_at();
