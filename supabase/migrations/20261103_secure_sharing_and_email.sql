-- Apply to an existing DueForm database before deploying the matching app changes.
-- No service-role key is needed by the application.
begin;

drop policy if exists "Public can view shared invoices" on public.public_invoices;
drop policy if exists "Users can view their own public invoices" on public.public_invoices;
create policy "Users can view their own public invoices"
on public.public_invoices for select to authenticated
using ((select auth.uid()) = owner_id);

-- Anonymous users cannot enumerate invoices or tokens through the table API.
revoke all on public.public_invoices from anon;
grant select, insert, update, delete on public.public_invoices to authenticated;

create or replace function public.get_public_invoice(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', '',
    'businessId', '',
    'invoiceNumber', i->'invoiceNumber',
    'status', i->'status',
    'business', (i->'business') - array['id', 'isDefault'],
    'client', (i->'client') - 'id',
    'lineItems', i->'lineItems',
    'adjustments', coalesce(i->'adjustments', '[]'::jsonb),
    'taxRate', i->'taxRate',
    'notes', i->'notes',
    'paymentTerms', i->'paymentTerms',
    'paymentInfo', i->'paymentInfo',
    'payments', coalesce((select jsonb_agg(jsonb_build_object('amount', p->'amount'))
      from jsonb_array_elements(coalesce(i->'payments', '[]'::jsonb)) p), '[]'::jsonb),
    'currency', i->'currency',
    'dateIssued', i->'dateIssued',
    'dateDue', i->'dateDue',
    'publicEnabled', true
  )
  from public.public_invoices shared
  join public.invoice_workspaces workspace on workspace.user_id = shared.owner_id
  cross join lateral jsonb_array_elements(workspace.payload->'invoices') i
  where share_token ~* '^inv_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and shared.token = share_token
    and i->>'id' = shared.invoice->>'id'
    and i->>'publicToken' = share_token
    and i->'publicEnabled' = 'true'::jsonb
  limit 1;
$$;
revoke all on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;

-- A durable quota works across serverless instances, unlike in-memory counters.
create table if not exists public.invoice_email_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id text not null,
  claimed_at timestamptz not null default now()
);
create index if not exists invoice_email_claims_user_time
  on public.invoice_email_claims(user_id, claimed_at);
alter table public.invoice_email_claims enable row level security;
revoke all on public.invoice_email_claims from anon, authenticated;

create or replace function public.claim_invoice_email_slot(invoice_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  requested_invoice text := invoice_id;
  claim_time timestamptz := clock_timestamp();
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_invoice is null or length(requested_invoice) not between 1 and 128 then
    raise exception 'Invalid invoice' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.invoice_workspaces w,
      lateral jsonb_array_elements(w.payload->'invoices') i
    where w.user_id = caller and i->>'id' = requested_invoice
  ) then
    raise exception 'Invoice unavailable' using errcode = '42501';
  end if;

  -- Lock by authenticated user, never by user-controlled invoice ID.
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  claim_time := clock_timestamp();
  delete from public.invoice_email_claims c
    where c.user_id = caller and c.claimed_at <= claim_time - interval '1 hour';
  if (select count(*) from public.invoice_email_claims c where c.user_id = caller) >= 10
    or exists (select 1 from public.invoice_email_claims c
      where c.user_id = caller and c.invoice_id = requested_invoice
        and c.claimed_at > claim_time - interval '1 minute') then
    return false;
  end if;
  insert into public.invoice_email_claims(user_id, invoice_id, claimed_at)
    values (caller, requested_invoice, claim_time);
  return true;
end;
$$;
revoke all on function public.claim_invoice_email_slot(text) from public, anon;
grant execute on function public.claim_invoice_email_slot(text) to authenticated;

commit;
