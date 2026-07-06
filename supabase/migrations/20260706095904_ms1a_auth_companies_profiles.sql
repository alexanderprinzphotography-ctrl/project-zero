-- MS 1a: Auth, Firmen & Rollen (Multi-Tenancy-Fundament)
-- Legt companies/profiles an, erzwingt Mandantentrennung ueber RLS und stellt
-- eine atomare Self-Service-Registrierung per SECURITY DEFINER-Funktion bereit.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_status text not null default 'trial'
    check (plan_status in ('trial', 'active', 'past_due', 'canceled', 'expired')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  role text not null check (role in ('admin', 'projektleiter', 'mitarbeiter')),
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create index profiles_company_id_idx on public.profiles (company_id);

-- ---------------------------------------------------------------------------
-- Schutz vor Rollen-/Firmenwechsel per Self-Update
-- Ohne diese Sperre koennte sich ein Nutzer ueber die eigene
-- "profiles_update_own"-Policy selbst zu admin machen oder die Firma wechseln.
-- Der Einladungs-/Rollenwechsel-Flow (MS 1b) aendert diese Felder ueber eine
-- eigene SECURITY DEFINER-Funktion, nicht per direktem Update.
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role or new.company_id is distinct from old.company_id then
    raise exception 'role und company_id koennen nicht per direktem Update geaendert werden';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

-- ---------------------------------------------------------------------------
-- Helferfunktionen (SECURITY DEFINER) fuer RLS-Policies
-- WICHTIG: Policies duerfen NIE per Sub-Select gegen "profiles" selbst pruefen
-- (rekursiv). Diese Funktionen laufen als Tabelleneigentuemer und umgehen RLS
-- daher unabhaengig vom aufrufenden Nutzer.
-- ---------------------------------------------------------------------------

create or replace function public.current_company_id()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_company_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.profiles enable row level security;

create policy "profiles_select_own_company" on public.profiles
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "profiles_update_own" on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "companies_select_own" on public.companies
  for select
  to authenticated
  using (id = public.current_company_id());

create policy "companies_update_admin_only" on public.companies
  for update
  to authenticated
  using (id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (id = public.current_company_id() and public.current_user_role() = 'admin');

-- Kein Insert/Delete fuer authenticated auf companies/profiles: Anlage erfolgt
-- ausschliesslich ueber register_company() unten (SECURITY DEFINER, umgeht RLS).

-- ---------------------------------------------------------------------------
-- Self-Service-Registrierung: atomar Firma + Admin-Profil anlegen
-- ---------------------------------------------------------------------------

create or replace function public.register_company(company_name text, full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  new_company_id uuid;
  new_profile public.profiles;
begin
  if caller_id is null then
    raise exception 'Registrierung erfordert eine angemeldete Sitzung';
  end if;

  if exists (select 1 from public.profiles where id = caller_id) then
    raise exception 'Nutzer hat bereits ein Profil/eine Firma';
  end if;

  if company_name is null or btrim(company_name) = '' then
    raise exception 'Firmenname darf nicht leer sein';
  end if;

  select u.email into caller_email from auth.users u where u.id = caller_id;

  insert into public.companies (name, plan_status, trial_ends_at)
  values (btrim(company_name), 'trial', now() + interval '14 days')
  returning id into new_company_id;

  insert into public.profiles (id, company_id, role, full_name, email)
  values (caller_id, new_company_id, 'admin', nullif(btrim(full_name), ''), caller_email)
  returning * into new_profile;

  return new_profile;
end;
$$;

revoke all on function public.register_company(text, text) from public;
grant execute on function public.register_company(text, text) to authenticated;
