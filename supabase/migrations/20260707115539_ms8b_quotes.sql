-- MS 8b: Angebots-System
-- Alle Geld-/Summen-Arithmetik passiert ausschliesslich im App-Code (siehe
-- core/money/quote-math.ts), nie in SQL und nie durch KI - hier werden nur
-- die bereits berechneten Ganzzahl-Cent-Werte gespeichert.

-- ---------------------------------------------------------------------------
-- companies: Auto-Freigabe-Einstellung
-- ---------------------------------------------------------------------------

alter table public.companies
  add column auto_release_enabled boolean not null default false,
  add column auto_release_limit_cents integer not null default 0
    check (auto_release_limit_cents >= 0);

-- Bestehenden Nur-Lese-Sperre-Trigger (MS 2/4/7) um auto_release_* erweitern.
drop trigger if exists companies_protect_settings_when_readonly on public.companies;
drop function if exists public.protect_company_settings_when_readonly();

create function public.protect_company_settings_when_readonly()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    new.primary_color is distinct from old.primary_color
    or new.accent_color is distinct from old.accent_color
    or new.logo_url is distinct from old.logo_url
    or new.project_visibility is distinct from old.project_visibility
    or new.schedule_visibility is distinct from old.schedule_visibility
    or new.auto_release_enabled is distinct from old.auto_release_enabled
    or new.auto_release_limit_cents is distinct from old.auto_release_limit_cents
  ) and not public.company_is_writable() then
    raise exception 'Diese Einstellung ist im Nur-Lese-Zustand (abgelaufene Testphase) gesperrt';
  end if;
  return new;
end;
$$;

create trigger companies_protect_settings_when_readonly
  before update on public.companies
  for each row execute function public.protect_company_settings_when_readonly();

-- ---------------------------------------------------------------------------
-- Tabelle: quotes
-- ---------------------------------------------------------------------------

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  quote_number int not null,
  customer_id uuid not null references public.contacts (id),
  project_id uuid references public.projects (id),
  status text not null default 'entwurf'
    check (status in ('entwurf', 'zur_freigabe', 'freigegeben', 'gesendet', 'angenommen', 'abgelehnt')),
  quote_date date not null default current_date,
  valid_until date not null default (current_date + 30),
  tax_rate int not null default 19 check (tax_rate >= 0),
  intro_text text,
  closing_text text,
  net_total_cents int not null default 0,
  tax_total_cents int not null default 0,
  gross_total_cents int not null default 0,
  created_by uuid not null default auth.uid() references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint quotes_company_quote_number_unique unique (company_id, quote_number)
);

create index quotes_company_id_idx on public.quotes (company_id);
create index quotes_customer_id_idx on public.quotes (customer_id);
create index quotes_project_id_idx on public.quotes (project_id);

-- Angebotsnummer immer automatisch fortlaufend pro Firma (wie Kunden-/
-- Projektnummer), nicht optional/manuell wie die Katalog-Artikelnummer.
create or replace function public.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.quote_number := public.next_counter_value(new.company_id, 'quote');
  return new;
end;
$$;

create trigger quotes_assign_number
  before insert on public.quotes
  for each row execute function public.assign_quote_number();

-- Cross-Company-Absicherung: customer_id/project_id muessen zur selben Firma
-- gehoeren wie das Angebot (reine FK-Constraints pruefen nur Existenz).
create or replace function public.validate_quote_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.contacts c where c.id = new.customer_id and c.company_id = new.company_id
  ) then
    raise exception 'Kunde gehoert nicht zur selben Firma wie das Angebot';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id
  ) then
    raise exception 'Projekt gehoert nicht zur selben Firma wie das Angebot';
  end if;
  return new;
end;
$$;

create trigger quotes_validate_company
  before insert or update on public.quotes
  for each row execute function public.validate_quote_company();

create or replace function public.set_quote_updated_meta()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger quotes_set_updated_meta
  before update on public.quotes
  for each row execute function public.set_quote_updated_meta();

-- ---------------------------------------------------------------------------
-- Tabelle: quote_items
-- Preise/Bezeichnung werden beim Hinzufuegen aus dem Katalog als Snapshot
-- kopiert (catalog_item_id nur als Referenz/Herkunftsnachweis) - spaetere
-- Katalogaenderungen duerfen bestehende Angebote NIE veraendern.
-- ---------------------------------------------------------------------------

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  company_id uuid not null default public.current_company_id() references public.companies (id),
  position int not null,
  catalog_item_id uuid references public.catalog_items (id),
  name text not null,
  unit text not null,
  quantity numeric not null check (quantity > 0),
  unit_price_net_cents int not null check (unit_price_net_cents >= 0),
  line_total_net_cents int not null check (line_total_net_cents >= 0),
  -- deferrable: reorder_quote_items() aktualisiert mehrere Zeilen in einer
  -- Transaktion und wuerde ohne DEFERRED sonst bei einer Zwischen-Reihenfolge
  -- (z. B. Swap zweier Positionen) faelschlich gegen die Unique-Constraint
  -- laufen, obwohl das Endergebnis eindeutig ist.
  constraint quote_items_quote_position_unique unique (quote_id, position) deferrable initially deferred
);

create index quote_items_quote_id_idx on public.quote_items (quote_id);
create index quote_items_company_id_idx on public.quote_items (company_id);

create or replace function public.validate_quote_item_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.quotes q where q.id = new.quote_id and q.company_id = new.company_id
  ) then
    raise exception 'Angebot gehoert nicht zur selben Firma wie die Position';
  end if;
  if new.catalog_item_id is not null and not exists (
    select 1 from public.catalog_items ci where ci.id = new.catalog_item_id and ci.company_id = new.company_id
  ) then
    raise exception 'Katalog-Position gehoert nicht zur selben Firma wie die Angebots-Position';
  end if;
  return new;
end;
$$;

create trigger quote_items_validate_company
  before insert or update on public.quote_items
  for each row execute function public.validate_quote_item_company();

-- ---------------------------------------------------------------------------
-- RLS
-- SELECT: admin + projektleiter, OHNE company_is_writable() (Nur-Lese-Zustand
-- bedeutet weiterhin lesbar/exportierbar, nur nicht mehr schreibbar - siehe
-- CLAUDE.md: "SELECT nicht" bei der Trial-Sperre).
-- INSERT/UPDATE/DELETE: admin + projektleiter, plus company_is_writable().
-- ---------------------------------------------------------------------------

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

create policy "quotes_select" on public.quotes
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );

create policy "quotes_insert" on public.quotes
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "quotes_update" on public.quotes
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "quotes_delete" on public.quotes
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "quote_items_select" on public.quote_items
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );

create policy "quote_items_insert" on public.quote_items
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "quote_items_update" on public.quote_items
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "quote_items_delete" on public.quote_items
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

-- ---------------------------------------------------------------------------
-- Atomares Umsortieren der Positionen: eine einzelne Mehrzeilen-Aktualisierung
-- in EINER Transaktion, damit die (deferred) Unique-Constraint auf
-- (quote_id, position) nicht durch eine temporaer widerspruechliche
-- Zwischen-Reihenfolge verletzt wird (z. B. beim Vertauschen zweier Positionen).
-- ---------------------------------------------------------------------------

create or replace function public.reorder_quote_items(p_quote_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.quotes where id = p_quote_id;

  if v_company_id is null or v_company_id <> public.current_company_id() then
    raise exception 'Angebot nicht gefunden';
  end if;
  if public.current_user_role() not in ('admin', 'projektleiter') then
    raise exception 'Keine Berechtigung fuer Angebote';
  end if;
  if not public.company_is_writable() then
    raise exception 'Diese Aktion ist im Nur-Lese-Zustand (abgelaufene Testphase) gesperrt';
  end if;

  update public.quote_items qi
  set position = ordered.idx
  from unnest(p_ordered_ids) with ordinality as ordered(id, idx)
  where qi.id = ordered.id and qi.quote_id = p_quote_id;
end;
$$;

revoke all on function public.reorder_quote_items(uuid, uuid[]) from public;
grant execute on function public.reorder_quote_items(uuid, uuid[]) to authenticated;
