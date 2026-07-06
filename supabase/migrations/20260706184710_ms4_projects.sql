-- MS 4: Projekte / Baustellen
-- Generalisiert den Zaehler-Mechanismus aus MS 3, legt projects/project_members
-- mit sichtbarkeitsabhaengiger RLS an und erweitert companies um
-- project_visibility.

-- ---------------------------------------------------------------------------
-- 1. company_counters generalisieren: von kundennummer-spezifisch auf ein
-- gekeytes Design (company_id, counter_key, next_value). Bestehende Zeilen
-- bleiben erhalten (counter_key wird auf 'customer_number' zurueckgefuehrt).
-- ---------------------------------------------------------------------------

alter table public.company_counters rename column next_customer_number to next_value;
alter table public.company_counters add column counter_key text not null default 'customer_number';
alter table public.company_counters drop constraint company_counters_pkey;
alter table public.company_counters add primary key (company_id, counter_key);
alter table public.company_counters alter column counter_key drop default;

create or replace function public.next_counter_value(p_company_id uuid, p_counter_key text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assigned_number int;
begin
  insert into public.company_counters (company_id, counter_key, next_value)
  values (p_company_id, p_counter_key, 1)
  on conflict (company_id, counter_key) do nothing;

  update public.company_counters
  set next_value = next_value + 1
  where company_id = p_company_id and counter_key = p_counter_key
  returning next_value - 1 into assigned_number;

  return assigned_number;
end;
$$;

revoke all on function public.next_counter_value(uuid, text) from public;
grant execute on function public.next_counter_value(uuid, text) to authenticated;

drop function if exists public.next_customer_number(uuid);

create or replace function public.assign_customer_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.customer_number := public.next_counter_value(new.company_id, 'customer_number');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. companies: project_visibility + erweiterte Nur-Lese-Sperre (Trigger aus
-- MS 2 wird umbenannt/verallgemeinert statt dupliziert).
-- ---------------------------------------------------------------------------

alter table public.companies
  add column project_visibility text not null default 'all'
    check (project_visibility in ('all', 'assigned'));

drop trigger if exists companies_protect_theme_when_readonly on public.companies;
drop function if exists public.protect_company_theme_when_readonly();

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
  ) and not public.company_is_writable() then
    raise exception 'Diese Einstellung ist im Nur-Lese-Zustand (abgelaufene Testphase) gesperrt';
  end if;
  return new;
end;
$$;

create trigger companies_protect_settings_when_readonly
  before update on public.companies
  for each row execute function public.protect_company_settings_when_readonly();

create or replace function public.company_project_visibility()
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select project_visibility from public.companies where id = public.current_company_id()
$$;

revoke all on function public.company_project_visibility() from public;
grant execute on function public.company_project_visibility() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  project_number int not null,
  type text not null default 'baustelle',
  title text not null,
  customer_id uuid references public.contacts (id) on delete set null,
  status text not null default 'geplant'
    check (status in ('geplant', 'aktiv', 'pausiert', 'abgeschlossen')),
  description text,
  site_street text,
  site_postal_code text,
  site_city text,
  site_country text not null default 'DE',
  start_date date,
  planned_end_date date,
  metadata jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_company_project_number_unique unique (company_id, project_number)
);

create index projects_company_id_idx on public.projects (company_id);
create index projects_customer_id_idx on public.projects (customer_id);

-- Verhindert, dass ein Projekt auf einen Kunden einer anderen Firma zeigt
-- (der reine FK prueft nur Existenz der Zeile, nicht die Firmenzugehoerigkeit).
create or replace function public.validate_project_customer_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is not null then
    if not exists (
      select 1 from public.contacts c
      where c.id = new.customer_id and c.company_id = new.company_id
    ) then
      raise exception 'Kunde gehoert nicht zur selben Firma wie das Projekt';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_validate_customer_company
  before insert or update on public.projects
  for each row execute function public.validate_project_customer_company();

create or replace function public.assign_project_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.project_number := public.next_counter_value(new.company_id, 'project_number');
  return new;
end;
$$;

create trigger projects_assign_project_number
  before insert on public.projects
  for each row execute function public.assign_project_number();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. project_members
-- ---------------------------------------------------------------------------

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null default auth.uid() references public.profiles (id),
  constraint project_members_project_user_unique unique (project_id, user_id)
);

create index project_members_project_id_idx on public.project_members (project_id);
create index project_members_user_id_idx on public.project_members (user_id);

create or replace function public.validate_project_member_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.company_id = new.company_id
  ) then
    raise exception 'Nutzer gehoert nicht zur selben Firma wie das Projekt';
  end if;
  if not exists (
    select 1 from public.projects pr
    where pr.id = new.project_id and pr.company_id = new.company_id
  ) then
    raise exception 'Projekt gehoert nicht zur angegebenen Firma';
  end if;
  return new;
end;
$$;

create trigger project_members_validate_company
  before insert on public.project_members
  for each row execute function public.validate_project_member_company();

-- ---------------------------------------------------------------------------
-- 5. Sichtbarkeits-Helfer: SECURITY DEFINER, damit die RLS-Policies von
-- projects/project_members sich nicht gegenseitig rekursiv referenzieren.
-- ---------------------------------------------------------------------------

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
  )
$$;

revoke all on function public.is_project_member(uuid) from public;
grant execute on function public.is_project_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.project_members enable row level security;

create policy "projects_select_visibility" on public.projects
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and (
      public.current_user_role() in ('admin', 'projektleiter')
      or public.company_project_visibility() = 'all'
      or public.is_project_member(id)
    )
  );

create policy "projects_insert_admin_projektleiter" on public.projects
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "projects_update_admin_projektleiter" on public.projects
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

-- Kein Hard-Delete (Entfernen = Archivieren) -> keine DELETE-Policy.

-- "Analog zur Projektsichtbarkeit": wer das Projekt sehen darf, sieht auch
-- dessen komplette Mitgliederliste (nicht nur die eigene Zeile) - sonst
-- saehe ein zugewiesener Mitarbeiter seine Projektkolleg:innen nicht.
create policy "project_members_select_visibility" on public.project_members
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and (
      public.current_user_role() in ('admin', 'projektleiter')
      or public.company_project_visibility() = 'all'
      or public.is_project_member(project_id)
    )
  );

create policy "project_members_insert_admin_projektleiter" on public.project_members
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "project_members_delete_admin_projektleiter" on public.project_members
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );
