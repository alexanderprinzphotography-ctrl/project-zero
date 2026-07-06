-- MS 2: Theming & Corporate Design
-- Markenfarben/Logo pro Firma, Storage-Bucket fuer Logos, Nur-Lese-Sperre auf
-- Theme-Aenderungen bei abgelaufenem Trial.

-- ---------------------------------------------------------------------------
-- companies: Markenfarben + Logo (nullable -> Fallback auf Produkt-Standard)
-- ---------------------------------------------------------------------------

alter table public.companies
  add column primary_color text,
  add column accent_color text,
  add column logo_url text;

alter table public.companies
  add constraint companies_primary_color_hex
    check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint companies_accent_color_hex
    check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');

-- ---------------------------------------------------------------------------
-- Theme-Aenderungen sind Schreibvorgaenge und respektieren company_is_writable().
-- Ueber einen Trigger statt in der companies-Update-Policy selbst, damit ein
-- kuenftiger Upgrade-/Abrechnungs-Fluss (der ja gerade den Nur-Lese-Zustand
-- aufheben soll) plan_status/trial_ends_at weiterhin aendern kann, waehrend
-- die Theme-Spalten spezifisch gesperrt bleiben.
-- ---------------------------------------------------------------------------

create or replace function public.protect_company_theme_when_readonly()
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
  ) and not public.company_is_writable() then
    raise exception 'Theme-Aenderungen sind im Nur-Lese-Zustand (abgelaufene Testphase) gesperrt';
  end if;
  return new;
end;
$$;

create trigger companies_protect_theme_when_readonly
  before update on public.companies
  for each row execute function public.protect_company_theme_when_readonly();

-- ---------------------------------------------------------------------------
-- Storage-Bucket fuer Logos: oeffentlich lesbar, Schreiben nur durch den Admin
-- der eigenen Firma im eigenen Ordner (logos/<company_id>/...).
-- Groessen-/Typ-Validierung zusaetzlich auf Bucket-Ebene (Defense in Depth,
-- die App validiert client-/serverseitig nochmal).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;

-- Kein "alter table storage.objects enable row level security" noetig (und im
-- SQL-Editor auch nicht erlaubt, da postgres dort nicht Owner dieser
-- Supabase-internen Tabelle ist) - RLS ist auf storage.objects in jedem
-- Supabase-Projekt bereits standardmaessig aktiv. Policies anlegen ist davon
-- unabhaengig erlaubt.

create policy "logos_select_own_company" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "logos_insert_admin_own_company" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() = 'admin'
    and public.company_is_writable()
  );

create policy "logos_update_admin_own_company" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() = 'admin'
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() = 'admin'
    and public.company_is_writable()
  );

create policy "logos_delete_admin_own_company" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() = 'admin'
    and public.company_is_writable()
  );

-- ---------------------------------------------------------------------------
-- get_invitation_preview() um Markenfarben/Logo erweitern, damit die
-- Einladungs-Annahme-Seite optional das Theme der einladenden Firma zeigen
-- kann. Rueckgabetyp aendert sich -> Funktion muss neu angelegt werden.
-- ---------------------------------------------------------------------------

drop function if exists public.get_invitation_preview(text);

create function public.get_invitation_preview(token text)
returns table (
  company_name text,
  role text,
  valid boolean,
  primary_color text,
  accent_color text,
  logo_url text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    c.name as company_name,
    i.role,
    (
      i.revoked_at is null
      and i.expires_at > now()
      and (i.max_uses is null or i.used_count < i.max_uses)
    ) as valid,
    c.primary_color,
    c.accent_color,
    c.logo_url
  from public.invitations i
  join public.companies c on c.id = i.company_id
  where i.token = get_invitation_preview.token
$$;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
