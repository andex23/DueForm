create table if not exists public.invoice_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.public_invoices (
  token text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  invoice jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.invoice_workspaces enable row level security;
alter table public.public_invoices enable row level security;

create policy "Users can view their own invoice workspace"
on public.invoice_workspaces
for select
using (auth.uid() = user_id);

create policy "Users can insert their own invoice workspace"
on public.invoice_workspaces
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own invoice workspace"
on public.invoice_workspaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Public can view shared invoices"
on public.public_invoices
for select
using (true);

create policy "Users can insert their own public invoices"
on public.public_invoices
for insert
with check (auth.uid() = owner_id);

create policy "Users can update their own public invoices"
on public.public_invoices
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users can delete their own public invoices"
on public.public_invoices
for delete
using (auth.uid() = owner_id);
