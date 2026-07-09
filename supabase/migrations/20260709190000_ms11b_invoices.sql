-- MS 11b: Rechnung aus Angebot (sevdesk). Reiner Referenz-/Statusspiegel -
-- sevdesk bleibt Quelle der Wahrheit fuer Rechnungsnummer, GoBD-Speicherung
-- und E-Rechnung. Betraege werden 1:1 aus dem Angebot uebernommen, nie neu
-- berechnet.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  quote_id uuid not null unique references public.quotes (id),
  contact_id uuid not null references public.contacts (id),
  provider text not null check (provider in ('sevdesk')),
  provider_invoice_id text not null,
  provider_invoice_number text not null,
  status text not null default 'entwurf'
    check (status in ('entwurf', 'offen', 'bezahlt', 'teilbezahlt', 'storniert')),
  gross_total_cents int not null check (gross_total_cents >= 0),
  net_total_cents int not null check (net_total_cents >= 0),
  invoice_date date not null,
  due_date date,
  last_synced_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index invoices_company_id_idx on public.invoices (company_id);
create index invoices_contact_id_idx on public.invoices (contact_id);

-- Cross-Company-Absicherung wie bei quotes/quote_items (validate_quote_company()).
create or replace function public.validate_invoice_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.quotes q where q.id = new.quote_id and q.company_id = new.company_id
  ) then
    raise exception 'Angebot gehoert nicht zur selben Firma wie die Rechnung';
  end if;
  if not exists (
    select 1 from public.contacts c where c.id = new.contact_id and c.company_id = new.company_id
  ) then
    raise exception 'Kunde gehoert nicht zur selben Firma wie die Rechnung';
  end if;
  return new;
end;
$$;

create trigger invoices_validate_company
  before insert or update on public.invoices
  for each row execute function public.validate_invoice_company();

-- ---------------------------------------------------------------------------
-- RLS: wie quotes (admin+projektleiter, SELECT ohne Trial-Sperre). Bewusst
-- KEINE DELETE-Policy - das lokale Mirror-Row darf nie verschwinden, sonst
-- wuerde die UNIQUE-Constraint auf quote_id (zentrale Idempotenz-Absicherung
-- gegen doppelte sevdesk-Rechnungen) durch Neuanlage umgangen.
-- ---------------------------------------------------------------------------

alter table public.invoices enable row level security;

create policy "invoices_select" on public.invoices
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );

create policy "invoices_insert" on public.invoices
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

-- Additive-Grants-Sperre (Lektion aus MS 9a/11a): Betrag, Rechnungsnummer und
-- Provider-ID sind nach dem Anlegen fuer den Client unveraenderlich - nur der
-- Status-Sync (status/last_synced_at/due_date) darf per Update beruehrt werden.
revoke update on public.invoices from authenticated;

grant update (status, last_synced_at, due_date) on public.invoices to authenticated;
