-- MS 6: Zeiterfassung
-- Projektbezogene Arbeitszeiten (Timer + manuell), exakt gespeichert (keine
-- Rundung), Dauer wird immer aus den absoluten timestamptz-Zeitpunkten
-- berechnet - dadurch automatisch DST-sicher.

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  project_id uuid not null references public.projects (id),
  user_id uuid not null default auth.uid() references public.profiles (id),
  started_at timestamptz not null,
  ended_at timestamptz,
  break_minutes int not null default 0,
  note text,
  entry_source text not null default 'manual' check (entry_source in ('timer', 'manual')),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint time_entries_ended_after_started check (ended_at is null or ended_at > started_at),
  constraint time_entries_break_nonnegative check (break_minutes >= 0),
  -- Pause darf die Brutto-Dauer nicht uebersteigen (nur pruefbar, wenn ended_at
  -- gesetzt ist - waehrend der Timer laeuft ist die Brutto-Dauer noch offen).
  constraint time_entries_break_not_exceeding_gross check (
    ended_at is null or break_minutes <= extract(epoch from (ended_at - started_at)) / 60.0
  )
);

create index time_entries_company_id_idx on public.time_entries (company_id);
create index time_entries_project_id_idx on public.time_entries (project_id);
create index time_entries_user_id_idx on public.time_entries (user_id);

-- Pro Nutzer darf nur EIN Eintrag gleichzeitig "laufen" (ended_at is null).
-- Partial-Unique-Index statt Anwendungslogik: race-sicher, harte DB-Garantie.
create unique index time_entries_one_running_timer_per_user
  on public.time_entries (user_id)
  where ended_at is null;

-- Cross-Company-Absicherung (reine FK-Constraints pruefen nur Existenz, nicht
-- Firmenzugehoerigkeit) - analog zum Muster aus MS 4.
create or replace function public.validate_time_entry_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id
  ) then
    raise exception 'Projekt gehoert nicht zur selben Firma wie der Zeiteintrag';
  end if;
  if not exists (
    select 1 from public.profiles pr where pr.id = new.user_id and pr.company_id = new.company_id
  ) then
    raise exception 'Nutzer gehoert nicht zur selben Firma wie der Zeiteintrag';
  end if;
  return new;
end;
$$;

create trigger time_entries_validate_company
  before insert or update on public.time_entries
  for each row execute function public.validate_time_entry_company();

-- updated_by wird immer auf den tatsaechlichen Aufrufer gesetzt (nicht auf
-- einen vom Client mitgeschickten Wert) - verhindert Vortaeuschen, wer eine
-- Korrektur vorgenommen hat.
create or replace function public.set_time_entry_updated_meta()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger time_entries_set_updated_meta
  before update on public.time_entries
  for each row execute function public.set_time_entry_updated_meta();

-- ---------------------------------------------------------------------------
-- RLS
-- SELECT: mitarbeiter nur eigene Eintraege, admin/projektleiter alle der Firma.
-- INSERT/UPDATE/DELETE: eigene Eintraege fuer jeden; fremde nur admin/PL;
-- zusaetzlich muss das Projekt fuer den Aufrufer sichtbar sein (MS 4) und die
-- Firma schreibbar (Trial-Sperre).
-- ---------------------------------------------------------------------------

alter table public.time_entries enable row level security;

create policy "time_entries_select" on public.time_entries
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('admin', 'projektleiter')
    )
  );

create policy "time_entries_insert" on public.time_entries
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.company_is_writable()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('admin', 'projektleiter')
    )
    and (
      public.current_user_role() in ('admin', 'projektleiter')
      or public.company_project_visibility() = 'all'
      or public.is_project_member(project_id)
    )
  );

create policy "time_entries_update" on public.time_entries
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('admin', 'projektleiter')
    )
  )
  with check (
    company_id = public.current_company_id()
    and public.company_is_writable()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('admin', 'projektleiter')
    )
    and (
      public.current_user_role() in ('admin', 'projektleiter')
      or public.company_project_visibility() = 'all'
      or public.is_project_member(project_id)
    )
  );

create policy "time_entries_delete" on public.time_entries
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.company_is_writable()
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('admin', 'projektleiter')
    )
  );
