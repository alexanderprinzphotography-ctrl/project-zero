-- MS 5a: Tagebuch-Kern (append-only + Hash-Kette)
-- Beweissicheres Bautagebuch: Eintraege sind unveraenderlich und ueber eine
-- Hash-Kette pro Projekt verknuepft. Fotos fliessen in den Hash ein.
-- Reine Datenkern-Migration - kein UI (kommt in MS 5b).

-- ---------------------------------------------------------------------------
-- 1. Tabellen
-- ---------------------------------------------------------------------------

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  project_id uuid not null references public.projects (id),
  author_id uuid not null default auth.uid() references public.profiles (id),
  seq int not null,
  created_at timestamptz not null default now(),
  category text check (category in ('fortschritt', 'mangel', 'lieferung', 'wetter', 'personal', 'sonstiges')),
  text text,
  corrects_entry_id uuid references public.diary_entries (id),
  prev_hash text not null,
  entry_hash text not null,
  constraint diary_entries_project_seq_unique unique (project_id, seq)
  -- "Text oder mindestens ein Foto" laesst sich hier nicht als CHECK abbilden
  -- (Fotos werden erst NACH dem Eintrag in einer eigenen Tabelle verknuepft) -
  -- die Pruefung erfolgt in append_diary_entry().
);

create index diary_entries_project_id_idx on public.diary_entries (project_id);
create index diary_entries_company_id_idx on public.diary_entries (company_id);

create table public.diary_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  entry_id uuid not null references public.diary_entries (id),
  storage_path text not null,
  file_hash text not null,
  uploaded_at timestamptz not null default now()
);

create index diary_photos_entry_id_idx on public.diary_photos (entry_id);
create index diary_photos_company_id_idx on public.diary_photos (company_id);

-- Verhindert, dass corrects_entry_id auf einen Eintrag eines ANDEREN Projekts
-- zeigt - Absicherung auch fuer den (nicht vorgesehenen) direkten Insert-Pfad.
create or replace function public.validate_diary_entry_correction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.corrects_entry_id is not null and not exists (
    select 1 from public.diary_entries d
    where d.id = new.corrects_entry_id and d.project_id = new.project_id
  ) then
    raise exception 'corrects_entry_id muss zum selben Projekt gehoeren';
  end if;
  return new;
end;
$$;

create trigger diary_entries_validate_correction
  before insert on public.diary_entries
  for each row execute function public.validate_diary_entry_correction();

-- ---------------------------------------------------------------------------
-- 2. Append-only hart erzwingen - unabhaengig von RLS/Rolle, also auch gegen
-- service_role oder sonst erhoehte Rechte innerhalb der App. Triggers feuern
-- fuer JEDEN Aufrufer, RLS-Bypass aendert daran nichts.
-- ---------------------------------------------------------------------------

create or replace function public.forbid_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Tagebuch-Eintraege sind unveraenderlich (append-only) - % nicht erlaubt', tg_op;
end;
$$;

create trigger diary_entries_forbid_update
  before update on public.diary_entries
  for each row execute function public.forbid_update_delete();

create trigger diary_entries_forbid_delete
  before delete on public.diary_entries
  for each row execute function public.forbid_update_delete();

create trigger diary_photos_forbid_update
  before update on public.diary_photos
  for each row execute function public.forbid_update_delete();

create trigger diary_photos_forbid_delete
  before delete on public.diary_photos
  for each row execute function public.forbid_update_delete();

-- ---------------------------------------------------------------------------
-- 3. Kettenstatus pro Projekt (fuer atomares Anhaengen) - analog zum
-- Zaehler-Mechanismus aus MS 3/4, aber mit zusaetzlichem Hash-Feld. Kein
-- direkter Zugriff vorgesehen -> RLS ohne jede Policy, nur ueber die
-- SECURITY DEFINER-Funktionen unten erreichbar.
-- ---------------------------------------------------------------------------

create table public.diary_chain_state (
  project_id uuid primary key references public.projects (id),
  last_seq int not null default 0,
  last_hash text not null
);

alter table public.diary_chain_state enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Gemeinsame Hash-Formel - EINE Stelle, die append_diary_entry() beim
-- Anlegen UND verify_diary() beim Nachrechnen nutzen. created_at wird explizit
-- auf UTC normalisiert und als Text formatiert, damit die Session-Zeitzone
-- die Serialisierung nicht beeinflusst (sonst koennte derselbe Zeitstempel je
-- nach Sitzung unterschiedlich hashen).
-- ---------------------------------------------------------------------------

create or replace function public.compute_diary_entry_hash(
  p_company_id uuid,
  p_project_id uuid,
  p_author_id uuid,
  p_created_at timestamptz,
  p_seq int,
  p_category text,
  p_text text,
  p_corrects_entry_id uuid,
  p_photo_hashes jsonb,
  p_prev_hash text
)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    digest(
      jsonb_build_object(
        'company_id', p_company_id,
        'project_id', p_project_id,
        'author_id', p_author_id,
        'created_at', (p_created_at at time zone 'UTC')::text,
        'seq', p_seq,
        'category', p_category,
        'text', p_text,
        'corrects_entry_id', p_corrects_entry_id,
        'photo_hashes', p_photo_hashes,
        'prev_hash', p_prev_hash
      )::text,
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function public.diary_genesis_hash(p_project_id uuid)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(digest('genesis:' || p_project_id::text, 'sha256'), 'hex')
$$;

revoke all on function public.compute_diary_entry_hash(uuid, uuid, uuid, timestamptz, int, text, text, uuid, jsonb, text) from public;
grant execute on function public.compute_diary_entry_hash(uuid, uuid, uuid, timestamptz, int, text, text, uuid, jsonb, text) to authenticated;
revoke all on function public.diary_genesis_hash(uuid) from public;
grant execute on function public.diary_genesis_hash(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. append_diary_entry(): einzige zulaessige Anlage-Stelle. SECURITY DEFINER
-- umgeht RLS, daher werden Sichtbarkeit/Schreibrecht/Rolle hier manuell exakt
-- so geprueft wie es die projects-Policy tut. Kettenende wird per Row-Lock auf
-- diary_chain_state serialisiert (analog next_counter_value in MS 3/4).
-- ---------------------------------------------------------------------------

create or replace function public.append_diary_entry(
  p_project_id uuid,
  p_text text,
  p_category text,
  p_corrects_entry_id uuid,
  p_photos jsonb -- Array von {"storage_path": "...", "file_hash": "..."}
)
returns public.diary_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_company_id uuid;
  v_seq int;
  v_prev_hash text;
  v_created_at timestamptz := now();
  v_entry_hash text;
  v_photo_hashes jsonb;
  v_new_entry public.diary_entries;
  v_photo jsonb;
  v_project_id_prefix text;
begin
  if v_caller_id is null then
    raise exception 'Tagebucheintrag erfordert eine angemeldete Sitzung';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Kein Firmenprofil gefunden';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.company_id = v_company_id
      and (
        public.current_user_role() in ('admin', 'projektleiter')
        or public.company_project_visibility() = 'all'
        or public.is_project_member(p.id)
      )
  ) then
    raise exception 'Projekt nicht gefunden oder keine Berechtigung';
  end if;

  if not public.company_is_writable() then
    raise exception 'Testphase abgelaufen - Tagebuch ist gesperrt';
  end if;

  if p_category is not null
     and p_category not in ('fortschritt', 'mangel', 'lieferung', 'wetter', 'personal', 'sonstiges') then
    raise exception 'Ungueltige Kategorie';
  end if;

  if p_corrects_entry_id is not null and not exists (
    select 1 from public.diary_entries d where d.id = p_corrects_entry_id and d.project_id = p_project_id
  ) then
    raise exception 'Zu korrigierender Eintrag nicht gefunden';
  end if;

  if (p_text is null or btrim(p_text) = '') and jsonb_array_length(coalesce(p_photos, '[]'::jsonb)) = 0 then
    raise exception 'Eintrag braucht Text oder mindestens ein Foto';
  end if;

  v_project_id_prefix := p_project_id::text;
  for v_photo in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) loop
    if v_photo->>'storage_path' is null or v_photo->>'file_hash' is null then
      raise exception 'Foto-Eintrag benoetigt storage_path und file_hash';
    end if;
    if v_photo->>'storage_path' not like (v_project_id_prefix || '/%') then
      raise exception 'storage_path gehoert nicht zum angegebenen Projekt';
    end if;
  end loop;

  -- Kettenstatus sicherstellen und Zeile fuer die Dauer der Transaktion sperren.
  insert into public.diary_chain_state (project_id, last_seq, last_hash)
  values (p_project_id, 0, public.diary_genesis_hash(p_project_id))
  on conflict (project_id) do nothing;

  select last_seq, last_hash into v_seq, v_prev_hash
  from public.diary_chain_state
  where project_id = p_project_id
  for update;

  v_seq := v_seq + 1;

  select coalesce(jsonb_agg(elem ->> 'file_hash' order by elem ->> 'file_hash'), '[]'::jsonb)
  into v_photo_hashes
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) elem;

  v_entry_hash := public.compute_diary_entry_hash(
    v_company_id, p_project_id, v_caller_id, v_created_at, v_seq,
    p_category, p_text, p_corrects_entry_id, v_photo_hashes, v_prev_hash
  );

  insert into public.diary_entries (
    company_id, project_id, author_id, seq, created_at, category, text,
    corrects_entry_id, prev_hash, entry_hash
  ) values (
    v_company_id, p_project_id, v_caller_id, v_seq, v_created_at, p_category, p_text,
    p_corrects_entry_id, v_prev_hash, v_entry_hash
  )
  returning * into v_new_entry;

  for v_photo in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) loop
    insert into public.diary_photos (company_id, entry_id, storage_path, file_hash)
    values (v_company_id, v_new_entry.id, v_photo ->> 'storage_path', v_photo ->> 'file_hash');
  end loop;

  update public.diary_chain_state
  set last_seq = v_seq, last_hash = v_entry_hash
  where project_id = p_project_id;

  return v_new_entry;
end;
$$;

revoke all on function public.append_diary_entry(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.append_diary_entry(uuid, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. verify_diary(): rechnet die Kette von vorne durch und meldet, ob und ab
-- welcher Position sie gebrochen ist. Nutzt dieselbe Hash-Formel wie das
-- Anlegen (compute_diary_entry_hash) - Formel existiert nur an dieser einen
-- Stelle im Schema.
-- ---------------------------------------------------------------------------

create or replace function public.verify_diary(p_project_id uuid)
returns table (valid boolean, broken_at_seq int, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_expected_prev_hash text;
  v_computed_hash text;
  v_row record;
  v_photo_hashes jsonb;
  v_checked boolean := false;
begin
  v_company_id := public.current_company_id();

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.company_id = v_company_id
      and (
        public.current_user_role() in ('admin', 'projektleiter')
        or public.company_project_visibility() = 'all'
        or public.is_project_member(p.id)
      )
  ) then
    raise exception 'Projekt nicht gefunden oder keine Berechtigung';
  end if;

  v_expected_prev_hash := public.diary_genesis_hash(p_project_id);

  for v_row in
    select d.* from public.diary_entries d
    where d.project_id = p_project_id
    order by d.seq asc
  loop
    v_checked := true;

    if v_row.prev_hash is distinct from v_expected_prev_hash then
      return query select false, v_row.seq, 'prev_hash stimmt nicht mit vorherigem Eintrag ueberein (Kette gebrochen)'::text;
      return;
    end if;

    select coalesce(jsonb_agg(dp.file_hash order by dp.file_hash), '[]'::jsonb)
    into v_photo_hashes
    from public.diary_photos dp
    where dp.entry_id = v_row.id;

    v_computed_hash := public.compute_diary_entry_hash(
      v_row.company_id, v_row.project_id, v_row.author_id, v_row.created_at, v_row.seq,
      v_row.category, v_row.text, v_row.corrects_entry_id, v_photo_hashes, v_row.prev_hash
    );

    if v_computed_hash is distinct from v_row.entry_hash then
      return query select false, v_row.seq, 'entry_hash stimmt nicht mit Inhalt/Fotos ueberein (Manipulation erkannt)'::text;
      return;
    end if;

    v_expected_prev_hash := v_row.entry_hash;
  end loop;

  if not v_checked then
    return query select true, null::int, 'Kette ist leer (keine Eintraege vorhanden)'::text;
    return;
  end if;

  return query select true, null::int, 'Kette unversehrt'::text;
end;
$$;

revoke all on function public.verify_diary(uuid) from public;
grant execute on function public.verify_diary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RLS: nur SELECT + INSERT (Sichtbarkeit analog Projekte), keine
-- UPDATE-/DELETE-Policies. Die App legt Eintraege ausschliesslich ueber
-- append_diary_entry() an; die INSERT-Policy ist zusaetzliche Absicherung
-- (Verteidigung in der Tiefe), falls doch direkt inseriert wird.
-- ---------------------------------------------------------------------------

alter table public.diary_entries enable row level security;
alter table public.diary_photos enable row level security;

create policy "diary_entries_select_visibility" on public.diary_entries
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

create policy "diary_entries_insert_visible_writable" on public.diary_entries
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and (
      public.current_user_role() in ('admin', 'projektleiter')
      or public.company_project_visibility() = 'all'
      or public.is_project_member(project_id)
    )
    and public.company_is_writable()
  );

create policy "diary_photos_select_visibility" on public.diary_photos
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.diary_entries de
      where de.id = diary_photos.entry_id
        and de.company_id = public.current_company_id()
        and (
          public.current_user_role() in ('admin', 'projektleiter')
          or public.company_project_visibility() = 'all'
          or public.is_project_member(de.project_id)
        )
    )
  );

create policy "diary_photos_insert_visible_writable" on public.diary_photos
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.company_is_writable()
    and exists (
      select 1 from public.diary_entries de
      where de.id = diary_photos.entry_id
        and de.company_id = public.current_company_id()
        and (
          public.current_user_role() in ('admin', 'projektleiter')
          or public.company_project_visibility() = 'all'
          or public.is_project_member(de.project_id)
        )
    )
  );

-- Kein Delete/Update: bewusst keine Policies (Default-Deny) + Trigger oben.

-- ---------------------------------------------------------------------------
-- 8. Storage-Bucket fuer Tagebuch-Fotos: PRIVAT (anders als das oeffentliche
-- logos-Bucket aus MS 2), da Baustellenfotos nicht oeffentlich sein sollen.
-- Pfadkonvention: <project_id>/<zufaellige-id>.<ext> - Fotos werden VOR dem
-- Eintrag hochgeladen (es gibt noch keine entry_id), daher projekt-scoped.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diary-photos',
  'diary-photos',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "diary_photos_storage_select_visible" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'diary-photos'
    and exists (
      select 1 from public.projects p
      where p.id = (storage.foldername(name))[1]::uuid
        and p.company_id = public.current_company_id()
        and (
          public.current_user_role() in ('admin', 'projektleiter')
          or public.company_project_visibility() = 'all'
          or public.is_project_member(p.id)
        )
    )
  );

create policy "diary_photos_storage_insert_visible_writable" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'diary-photos'
    and public.company_is_writable()
    and exists (
      select 1 from public.projects p
      where p.id = (storage.foldername(name))[1]::uuid
        and p.company_id = public.current_company_id()
        and (
          public.current_user_role() in ('admin', 'projektleiter')
          or public.company_project_visibility() = 'all'
          or public.is_project_member(p.id)
        )
    )
  );

-- Kein Update/Delete auf diary-photos: bereits verknuepfte Fotos sind
-- unveraenderlich, genau wie die Eintraege selbst.
