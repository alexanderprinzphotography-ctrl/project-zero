-- MS 11a: sevdesk-Verbindung (Review-Checkpoint: Secrets + Fremdsystem-Zugriff).
--
-- Leitprinzip: sevdesk ist die Quelle der Wahrheit fuer Rechnungen (Nummer,
-- GoBD-Archiv, E-Rechnung). Diese Migration speichert NUR die Verbindung
-- (verschluesselter API-Key pro Firma) und die Kontakt-Verknuepfung - keine
-- Rechnungslogik.
--
-- Der API-Key (api_key_encrypted) darf NIE per Client-Session lesbar sein,
-- auch nicht fuer den eigenen admin. Wir wenden die additive-Grants-Lektion
-- aus MS 9a proaktiv an: den Tabellen-Grant fuer authenticated komplett
-- entziehen und nur die unkritischen Metadaten-Spalten per SELECT freigeben.
-- Schreibzugriffe auf api_key_encrypted laufen ausschliesslich ueber
-- SECURITY-DEFINER-Funktionen (kein INSERT/UPDATE-Grant fuer authenticated).

create table public.company_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  provider text not null check (provider in ('sevdesk')),
  api_key_encrypted text not null,
  key_last4 text not null,
  connected_at timestamptz not null default now(),
  connected_by uuid not null default auth.uid() references public.profiles (id),
  last_check_at timestamptz,
  status text not null default 'ok' check (status in ('ok', 'error')),
  last_error text,
  constraint company_integrations_company_provider_unique unique (company_id, provider)
);

create index company_integrations_company_id_idx on public.company_integrations (company_id);

alter table public.company_integrations enable row level security;

create policy "company_integrations_select_admin" on public.company_integrations
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() = 'admin'
  );

create policy "company_integrations_delete_admin" on public.company_integrations
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() = 'admin'
    and public.company_is_writable()
  );

-- Kein INSERT/UPDATE-Grant fuer authenticated: alle Schreibzugriffe auf
-- api_key_encrypted laufen ausschliesslich ueber die SECURITY-DEFINER-
-- Funktionen unten. api_key_encrypted ist in KEINEM Client-Grant enthalten.
revoke all on public.company_integrations from authenticated;

grant select (
  id, company_id, provider, key_last4, connected_at, connected_by,
  last_check_at, status, last_error
) on public.company_integrations to authenticated;

grant delete on public.company_integrations to authenticated;

-- ---------------------------------------------------------------------------
-- Verbindung anlegen/aktualisieren: einziger Schreibpfad fuer api_key_encrypted.
-- Nur admin der eigenen Firma, nur wenn schreibbar (Trial/Abo-Sperre).
-- ---------------------------------------------------------------------------

create or replace function public.upsert_company_integration(
  p_provider text,
  p_api_key_encrypted text,
  p_key_last4 text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_user_role() <> 'admin' or not public.company_is_writable() then
    raise exception 'Keine Berechtigung';
  end if;

  insert into public.company_integrations (
    company_id, provider, api_key_encrypted, key_last4, connected_at, connected_by, status, last_error
  )
  values (
    public.current_company_id(), p_provider, p_api_key_encrypted, p_key_last4, now(), auth.uid(), 'ok', null
  )
  on conflict (company_id, provider) do update
  set api_key_encrypted = excluded.api_key_encrypted,
      key_last4 = excluded.key_last4,
      connected_at = now(),
      connected_by = auth.uid(),
      status = 'ok',
      last_error = null,
      last_check_at = now();
end;
$$;

revoke all on function public.upsert_company_integration(text, text, text) from public;
grant execute on function public.upsert_company_integration(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Einziger legitimer Lesepfad fuer den (weiterhin verschluesselten) Key:
-- ausschliesslich fuer serverseitige Actions, die ihn sofort entschluesseln
-- und fuer einen sevdesk-Aufruf verwenden. Nur admin der eigenen Firma.
-- ---------------------------------------------------------------------------

create or replace function public.get_company_integration_secret(p_provider text)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select api_key_encrypted
  from public.company_integrations
  where company_id = public.current_company_id()
    and provider = p_provider
    and public.current_user_role() = 'admin'
$$;

revoke all on function public.get_company_integration_secret(text) from public;
grant execute on function public.get_company_integration_secret(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Status nach einem Verbindungstest setzen. Bewusst OHNE company_is_writable()
-- - ein Fehlerstatus muss auch nach Trial-Ablauf gesetzt werden koennen.
-- ---------------------------------------------------------------------------

create or replace function public.set_company_integration_status(
  p_provider text,
  p_status text,
  p_last_error text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Keine Berechtigung';
  end if;

  update public.company_integrations
  set status = p_status,
      last_error = p_last_error,
      last_check_at = now()
  where company_id = public.current_company_id()
    and provider = p_provider;
end;
$$;

revoke all on function public.set_company_integration_status(text, text, text) from public;
grant execute on function public.set_company_integration_status(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kontakt-Verknuepfung fuer den Sync (Vorbereitung MS 11b). Niedrige
-- Sensitivitaet (keine Kredential, nur eine Fremd-ID) - reitet auf der
-- bestehenden contacts_update_admin_projektleiter-Policy, keine neue
-- SECURITY-DEFINER-Funktion noetig.
-- ---------------------------------------------------------------------------

alter table public.contacts add column sevdesk_contact_id text;

alter table public.contacts
  add constraint contacts_company_sevdesk_unique unique (company_id, sevdesk_contact_id);
