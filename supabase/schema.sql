create extension if not exists "pgcrypto";

create table if not exists public.app_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_snapshots enable row level security;

drop policy if exists "Users can read their own snapshot" on public.app_snapshots;
create policy "Users can read their own snapshot"
on public.app_snapshots
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own snapshot" on public.app_snapshots;
create policy "Users can insert their own snapshot"
on public.app_snapshots
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own snapshot" on public.app_snapshots;
create policy "Users can update their own snapshot"
on public.app_snapshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
