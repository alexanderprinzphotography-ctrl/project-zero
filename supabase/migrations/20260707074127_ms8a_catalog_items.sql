-- MS 8a: Leistungskatalog
-- Preis-Grundlage fuer spaetere (manuelle und KI-) Angebotspositionen.
-- Geld ausschliesslich als Ganzzahl in Cent - nie Float.

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  item_number text,
  name text not null,
  description text,
  unit text not null,
  unit_price_net_cents integer not null check (unit_price_net_cents >= 0),
  category text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint catalog_items_company_item_number_unique unique (company_id, item_number)
);

create index catalog_items_company_id_idx on public.catalog_items (company_id);
create index catalog_items_category_idx on public.catalog_items (category);

-- Artikelnummer ist optional: wird sie beim Anlegen weggelassen, automatisch
-- ueber den bestehenden gekeyten Zaehler-Mechanismus vergeben (wie Kunden-/
-- Projektnummer), sonst respektiert der Trigger den vom Client gesetzten Wert.
create or replace function public.set_catalog_item_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.item_number is null then
    new.item_number := public.next_counter_value(new.company_id, 'item_number')::text;
  end if;
  return new;
end;
$$;

create trigger catalog_items_set_number
  before insert on public.catalog_items
  for each row execute function public.set_catalog_item_number();

-- updated_by/updated_at immer serverseitig setzen, nie einen vom Client
-- mitgeschickten Wert uebernehmen (Muster aus MS 6/7).
create or replace function public.set_catalog_item_updated_meta()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger catalog_items_set_updated_meta
  before update on public.catalog_items
  for each row execute function public.set_catalog_item_updated_meta();

-- ---------------------------------------------------------------------------
-- RLS
-- SELECT/INSERT/UPDATE: nur admin + projektleiter (die Rollen, die spaeter
-- Angebote erstellen). Kein Hard-Delete - "Entfernen" = is_active = false,
-- da spaetere Angebote auf Katalog-Positionen verweisen (Archiv-Muster wie
-- bei contacts/projects).
-- ---------------------------------------------------------------------------

alter table public.catalog_items enable row level security;

create policy "catalog_items_select" on public.catalog_items
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );

create policy "catalog_items_insert" on public.catalog_items
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "catalog_items_update" on public.catalog_items
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
