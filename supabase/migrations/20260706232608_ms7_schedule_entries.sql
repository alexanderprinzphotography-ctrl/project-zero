-- MS 7: Einsatzplanung
-- schedule_entries haelt sowohl Einsatz-Zuweisungen als auch Abwesenheiten;
-- Konfliktpruefung (Doppelbelegung/Abwesenheit) erfolgt serverseitig in den
-- Server Actions, nicht nur im UI.

-- ---------------------------------------------------------------------------
-- companies: Sichtbarkeits-Einstellung fuer die Planungsansicht
-- ---------------------------------------------------------------------------

alter table public.companies
  add column schedule_visibility text not null default 'team'
    check (schedule_visibility in ('own', 'team'));

-- Bestehenden Nur-Lese-Sperre-Trigger aus MS 2/4 um schedule_visibility erweitern.
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
  ) and not public.company_is_writable() then
    raise exception 'Diese Einstellung ist im Nur-Lese-Zustand (abgelaufene Testphase) gesperrt';
  end if;
  return new;
end;
$$;

create trigger companies_protect_settings_when_readonly
  before update on public.companies
  for each row execute function public.protect_company_settings_when_readonly();

create or replace function public.company_schedule_visibility()
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select schedule_visibility from public.companies where id = public.current_company_id()
$$;

revoke all on function public.company_schedule_visibility() from public;
grant execute on function public.company_schedule_visibility() to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelle: schedule_entries
-- ---------------------------------------------------------------------------

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  user_id uuid not null references public.profiles (id),
  type text not null check (type in ('einsatz', 'abwesenheit')),
  project_id uuid references public.projects (id),
  absence_kind text check (absence_kind in ('urlaub', 'krank', 'sonstiges')),
  mode text not null check (mode in ('ganztags', 'halbtags', 'uhrzeit')),
  half_day_slot text check (half_day_slot in ('vormittag', 'nachmittag')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint schedule_entries_ends_after_starts check (ends_at > starts_at),
  constraint schedule_entries_type_fields check (
    (type = 'einsatz' and project_id is not null and absence_kind is null)
    or (type = 'abwesenheit' and project_id is null and absence_kind is not null)
  ),
  constraint schedule_entries_half_day_slot check (
    (mode = 'halbtags' and half_day_slot is not null)
    or (mode <> 'halbtags' and half_day_slot is null)
  )
);

create index schedule_entries_company_id_idx on public.schedule_entries (company_id);
create index schedule_entries_user_id_idx on public.schedule_entries (user_id);
create index schedule_entries_project_id_idx on public.schedule_entries (project_id);

-- Cross-Company-Absicherung (reine FK-Constraints pruefen nur Existenz, nicht
-- Firmenzugehoerigkeit) - analog zum Muster aus MS 4/6.
create or replace function public.validate_schedule_entry_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id
  ) then
    raise exception 'Projekt gehoert nicht zur selben Firma wie der Planungseintrag';
  end if;
  if not exists (
    select 1 from public.profiles pr where pr.id = new.user_id and pr.company_id = new.company_id
  ) then
    raise exception 'Nutzer gehoert nicht zur selben Firma wie der Planungseintrag';
  end if;
  return new;
end;
$$;

create trigger schedule_entries_validate_company
  before insert or update on public.schedule_entries
  for each row execute function public.validate_schedule_entry_company();

-- updated_by wird immer auf den tatsaechlichen Aufrufer gesetzt (nicht auf
-- einen vom Client mitgeschickten Wert).
create or replace function public.set_schedule_entry_updated_meta()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger schedule_entries_set_updated_meta
  before update on public.schedule_entries
  for each row execute function public.set_schedule_entry_updated_meta();

-- ---------------------------------------------------------------------------
-- RLS
-- SELECT: admin/projektleiter immer alle; mitarbeiter je nach
-- schedule_visibility entweder nur eigene ("own") oder alle ("team").
-- INSERT/UPDATE/DELETE: nur admin/projektleiter, plus company_is_writable().
-- ---------------------------------------------------------------------------

alter table public.schedule_entries enable row level security;

create policy "schedule_entries_select" on public.schedule_entries
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and (
      public.current_user_role() in ('admin', 'projektleiter')
      or public.company_schedule_visibility() = 'team'
      or user_id = auth.uid()
    )
  );

create policy "schedule_entries_insert" on public.schedule_entries
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

create policy "schedule_entries_update" on public.schedule_entries
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

create policy "schedule_entries_delete" on public.schedule_entries
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );
