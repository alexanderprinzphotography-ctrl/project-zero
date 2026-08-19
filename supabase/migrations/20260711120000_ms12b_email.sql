-- MS 12b: Angebot per E-Mail versenden (Brevo).
--
-- companies.reply_to_email/contact_phone fuer die Mail-Signatur; email_log als
-- Versand-Protokoll (Erfolg/Fehler muss fuer den Handwerker sichtbar sein -
-- niemals stillschweigend scheitern).

alter table public.companies
  add column reply_to_email text,
  add column contact_phone text;

-- Additive-Grants-Lektion aus MS 9a: eine neue Spalte erbt KEINEN bestehenden
-- Spalten-Grant automatisch - ohne diesen Grant koennte der Client die neuen
-- Felder trotz passender RLS-Policy nicht per Update setzen.
grant update (reply_to_email, contact_phone) on public.companies to authenticated;

-- Nur-Lese-Sperre (abgelaufener Trial) gilt auch fuer diese Einstellung -
-- protect_company_settings_when_readonly() (MS 8b) um die zwei neuen Spalten
-- erweitern.
create or replace function public.protect_company_settings_when_readonly()
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
    or new.auto_release_enabled is distinct from old.auto_release_enabled
    or new.auto_release_limit_cents is distinct from old.auto_release_limit_cents
    or new.reply_to_email is distinct from old.reply_to_email
    or new.contact_phone is distinct from old.contact_phone
  ) and not public.company_is_writable() then
    raise exception 'Diese Einstellung ist im Nur-Lese-Zustand (abgelaufene Testphase) gesperrt';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- email_log: Versand-Protokoll, append-only (kein UPDATE/DELETE). Anders als
-- beim Kundenportal (MS 12a) ist der Schreibende hier ein bereits
-- authentifizierter, vertrauenswuerdiger interner Akteur (admin/projektleiter
-- der eigenen Firma) - eine normale RLS-INSERT-Policy genuegt, keine
-- SECURITY-DEFINER-Funktion noetig.
-- ---------------------------------------------------------------------------

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  quote_id uuid references public.quotes (id),
  to_email text not null,
  subject text not null,
  provider_message_id text,
  status text not null check (status in ('gesendet', 'fehler')),
  error_message text,
  sent_by uuid not null default auth.uid() references public.profiles (id),
  sent_at timestamptz not null default now()
);

create index email_log_company_id_idx on public.email_log (company_id);
create index email_log_quote_id_idx on public.email_log (quote_id);

create or replace function public.validate_email_log_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.quote_id is not null and not exists (
    select 1 from public.quotes q where q.id = new.quote_id and q.company_id = new.company_id
  ) then
    raise exception 'Angebot gehoert nicht zur selben Firma wie der Mail-Protokolleintrag';
  end if;
  return new;
end;
$$;

create trigger email_log_validate_company
  before insert on public.email_log
  for each row execute function public.validate_email_log_company();

alter table public.email_log enable row level security;

create policy "email_log_select" on public.email_log
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );

create policy "email_log_insert" on public.email_log
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

-- Kein UPDATE/DELETE: das Protokoll ist unveraenderlich, sobald geschrieben.
