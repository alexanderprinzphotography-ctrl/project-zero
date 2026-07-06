-- MS 3: CRM-lite (Kunden & Kontakte)
-- contacts-Tabelle mit race-sicherer, pro Firma fortlaufender Kundennummer und
-- RLS (Lesen fuer alle Rollen, Schreiben nur admin/projektleiter + Trial-Sperre).

-- ---------------------------------------------------------------------------
-- Kundennummer: firmenbezogener Zaehler mit Row-Lock statt max()+1.
-- Die UPDATE-Zeile wird fuer die Dauer der Transaktion gesperrt, wodurch
-- parallele Aufrufe fuer dieselbe Firma serialisiert werden - keine
-- Duplikate/Luecken bei gleichzeitigen Inserts.
-- ---------------------------------------------------------------------------

create table public.company_counters (
  company_id uuid primary key references public.companies (id),
  next_customer_number int not null default 1
);

-- RLS ohne jede Policy: Zugriff ausschliesslich ueber die SECURITY DEFINER-
-- Funktion unten (umgeht RLS als Tabelleneigentuemer). Direkter Zugriff einer
-- Firma auf den Zaehler einer anderen Firma waere sonst moeglich, da die
-- Tabelle sonst ungeschuetzt fuer authenticated waere.
alter table public.company_counters enable row level security;

create or replace function public.next_customer_number(p_company_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assigned_number int;
begin
  insert into public.company_counters (company_id, next_customer_number)
  values (p_company_id, 1)
  on conflict (company_id) do nothing;

  update public.company_counters
  set next_customer_number = next_customer_number + 1
  where company_id = p_company_id
  returning next_customer_number - 1 into assigned_number;

  return assigned_number;
end;
$$;

revoke all on function public.next_customer_number(uuid) from public;
grant execute on function public.next_customer_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelle: contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  customer_number int not null,
  type text not null check (type in ('privat', 'gewerblich')),
  company_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  mobile text,
  street text,
  postal_code text,
  city text,
  country text not null default 'DE',
  vat_id text,
  notes text,
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_at_least_one_name check (
    coalesce(btrim(company_name), '') <> ''
    or coalesce(btrim(first_name), '') <> ''
    or coalesce(btrim(last_name), '') <> ''
  ),
  constraint contacts_company_customer_number_unique unique (company_id, customer_number)
);

create index contacts_company_id_idx on public.contacts (company_id);

-- Kundennummer wird immer serverseitig vergeben (Client schickt sie nie mit) -
-- garantiert Atomaritaet unabhaengig vom Aufrufer.
create or replace function public.assign_customer_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.customer_number := public.next_customer_number(new.company_id);
  return new;
end;
$$;

create trigger contacts_assign_customer_number
  before insert on public.contacts
  for each row execute function public.assign_customer_number();

-- Generischer Trigger fuer updated_at (kein SECURITY DEFINER noetig - setzt
-- nur einen Zeitstempel, umgeht keine Rechte). Kuenftige Tabellen mit
-- updated_at koennen ihn wiederverwenden.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: Lesen fuer alle Rollen der eigenen Firma, Schreiben nur admin/projektleiter
-- + company_is_writable(). Kein Hard-Delete vorgesehen -> keine DELETE-Policy
-- (Default-Deny), Entfernen laeuft ausschliesslich ueber is_archived-Update.
-- ---------------------------------------------------------------------------

alter table public.contacts enable row level security;

create policy "contacts_select_own_company" on public.contacts
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "contacts_insert_admin_projektleiter" on public.contacts
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "contacts_update_admin_projektleiter" on public.contacts
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
