-- MS 1b: Einladungen, Rollen-UI & Trial-Lifecycle
-- invitations-Tabelle mit admin-only RLS, Trial-Sperre (company_is_writable) und
-- atomarer Einladungsannahme per SECURITY DEFINER-Funktion.

-- ---------------------------------------------------------------------------
-- Trial-/Abo-Sperre: wiederverwendbare Helferfunktion (Konvention fuer alle
-- kuenftigen Geschaeftsdaten-Tabellen, siehe CLAUDE.md).
-- ---------------------------------------------------------------------------

create or replace function public.company_is_writable()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when c.plan_status = 'active' then true
    when c.plan_status = 'trial' and c.trial_ends_at > now() then true
    else false
  end
  from public.companies c
  where c.id = public.current_company_id()
$$;

revoke all on function public.company_is_writable() from public;
grant execute on function public.company_is_writable() to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelle: invitations
-- company_id/created_by defaulten auf den aufrufenden Nutzer, damit der Client
-- sie nicht mitschicken (und nicht faelschen) muss - die WITH CHECK-Klauseln
-- unten erzwingen es zusaetzlich, falls doch ein Wert mitgeschickt wird.
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  token text not null unique,
  role text not null check (role in ('admin', 'projektleiter', 'mitarbeiter')),
  created_by uuid not null default auth.uid() references public.profiles (id),
  expires_at timestamptz not null,
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_company_id_idx on public.invitations (company_id);

alter table public.invitations enable row level security;

create policy "invitations_select_admin_own_company" on public.invitations
  for select
  to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin');

create policy "invitations_insert_admin_own_company" on public.invitations
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() = 'admin'
    and public.company_is_writable()
  );

create policy "invitations_update_admin_own_company" on public.invitations
  for update
  to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() = 'admin'
    and public.company_is_writable()
  );

-- Kein Delete: Widerruf erfolgt per revoked_at-Update, nicht per Loeschung
-- (Nachvollziehbarkeit der Nutzungshistorie).

-- ---------------------------------------------------------------------------
-- Oeffentliche Vorschau fuer /einladung/<token>: Vor dem Login/Registrieren
-- muss die Einladung pruefbar sein, obwohl die betreffende Person noch keiner
-- Firma angehoert und die obigen RLS-Policies ihr daher den direkten Zugriff
-- auf die Zeile verwehren. Gibt bewusst nur das Minimum preis (Firmenname,
-- Rolle, Gueltigkeit) - kein Token, keine company_id, keine internen Zaehler.
-- ---------------------------------------------------------------------------

create or replace function public.get_invitation_preview(token text)
returns table (company_name text, role text, valid boolean)
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
    ) as valid
  from public.invitations i
  join public.companies c on c.id = i.company_id
  where i.token = get_invitation_preview.token
$$;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Einladung annehmen: legt KEINE Firma an (anders als register_company),
-- sondern haengt den Aufrufer als Profil an die Firma der Einladung.
-- "select ... for update" sperrt die Zeile fuer die Dauer der Transaktion,
-- damit ein Einmal-Link nicht durch zwei gleichzeitige Aufrufe doppelt
-- verwendet werden kann (Race Condition bei used_count).
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation(token text, full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  inv public.invitations;
  new_profile public.profiles;
begin
  if caller_id is null then
    raise exception 'Einladung annehmen erfordert eine angemeldete Sitzung';
  end if;

  if exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Dieser Account gehoert bereits zu einer Firma';
  end if;

  select i.* into inv
  from public.invitations i
  where i.token = accept_invitation.token
  for update;

  if not found then
    raise exception 'Einladung ungueltig';
  end if;

  if inv.revoked_at is not null then
    raise exception 'Einladung wurde widerrufen';
  end if;

  if inv.expires_at <= now() then
    raise exception 'Einladung ist abgelaufen';
  end if;

  if inv.max_uses is not null and inv.used_count >= inv.max_uses then
    raise exception 'Einladung wurde bereits vollstaendig genutzt';
  end if;

  select u.email into caller_email from auth.users u where u.id = caller_id;

  insert into public.profiles (id, company_id, role, full_name, email)
  values (
    caller_id,
    inv.company_id,
    inv.role,
    nullif(btrim(accept_invitation.full_name), ''),
    caller_email
  )
  returning * into new_profile;

  update public.invitations
  set used_count = used_count + 1
  where id = inv.id;

  return new_profile;
end;
$$;

revoke all on function public.accept_invitation(text, text) from public;
grant execute on function public.accept_invitation(text, text) to authenticated;
