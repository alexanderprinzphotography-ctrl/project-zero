-- MS 12a: Kundenportal (oeffentlich, Token-basiert) - Review-Checkpoint.
--
-- Erste oeffentlich erreichbare Flaeche der App (kein Login). Der Zugang
-- laeuft ausschliesslich ueber einen kryptographisch zufaelligen Token
-- (256 Bit, siehe src/app/team/actions.ts fuer das etablierte Muster) - nie
-- ueber generischen RLS-Zugriff fuer die Rolle "anon". Die drei
-- SECURITY-DEFINER-Funktionen unten sind der EINZIGE Weg, wie ein anonymer
-- Besucher an Daten kommt oder etwas schreibt.

-- ---------------------------------------------------------------------------
-- Tabelle: quote_share_links (internes Management durch admin/projektleiter)
-- ---------------------------------------------------------------------------

create table public.quote_share_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  quote_id uuid not null references public.quotes (id),
  token text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  first_viewed_at timestamptz,
  last_viewed_at timestamptz
);

create index quote_share_links_quote_id_idx on public.quote_share_links (quote_id);
create index quote_share_links_token_idx on public.quote_share_links (token);

create or replace function public.validate_quote_share_link_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.quotes q where q.id = new.quote_id and q.company_id = new.company_id
  ) then
    raise exception 'Angebot gehoert nicht zur selben Firma wie der Freigabe-Link';
  end if;
  return new;
end;
$$;

create trigger quote_share_links_validate_company
  before insert or update on public.quote_share_links
  for each row execute function public.validate_quote_share_link_company();

alter table public.quote_share_links enable row level security;

create policy "quote_share_links_select" on public.quote_share_links
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );

create policy "quote_share_links_insert" on public.quote_share_links
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
    and public.company_is_writable()
  );

-- UPDATE-Policy noetig, DAMIT der unten stehende Spalten-Grant ueberhaupt
-- greifen kann (Grants und RLS-Policies sind getrennte Schichten - eine
-- Grant-Freigabe ohne passende Policy bleibt bei aktiviertem RLS wirkungslos,
-- siehe Korrektur-Migration 20260709200000_ms11b_fix_invoices_update_policy.sql).
create policy "quote_share_links_update" on public.quote_share_links
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

-- Additive-Grants-Sperre (Lektion aus MS 9a/11a/11b): first_viewed_at/
-- last_viewed_at duerfen NUR von den SECURITY-DEFINER-Funktionen unten
-- gesetzt werden, nie direkt vom Client - sonst koennte ein Besucher-Zeitpunkt
-- vorgetaeuscht werden. token/expires_at/quote_id sind nach dem Erstellen
-- ebenfalls unveraenderlich - nur der Widerruf (revoked_at) ist erlaubt.
revoke update on public.quote_share_links from authenticated;
grant update (revoked_at) on public.quote_share_links to authenticated;

-- Kein Delete: Widerruf per revoked_at-Update (Nachvollziehbarkeit, wie invitations).

-- ---------------------------------------------------------------------------
-- Tabelle: quote_responses (append-only Vertragsnachweis, analog Tagebuch)
-- ---------------------------------------------------------------------------

create table public.quote_responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies (id),
  quote_id uuid not null unique references public.quotes (id),
  share_link_id uuid not null references public.quote_share_links (id),
  action text not null check (action in ('angenommen', 'abgelehnt')),
  responder_name text not null,
  responded_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index quote_responses_quote_id_idx on public.quote_responses (quote_id);

create or replace function public.validate_quote_response_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.quotes q where q.id = new.quote_id and q.company_id = new.company_id
  ) then
    raise exception 'Angebot gehoert nicht zur selben Firma wie die Antwort';
  end if;
  return new;
end;
$$;

create trigger quote_responses_validate_company
  before insert on public.quote_responses
  for each row execute function public.validate_quote_response_company();

alter table public.quote_responses enable row level security;

create policy "quote_responses_select" on public.quote_responses
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );

-- Kein INSERT/UPDATE/DELETE fuer irgendeine Rolle (auch nicht authenticated) -
-- der einzige Schreibpfad ist respond_to_quote_share() unten.
revoke insert, update, delete on public.quote_responses from authenticated;

-- ---------------------------------------------------------------------------
-- Oeffentlicher Lesezugriff: Angebots-Kopf + Firma + Kunde + Projekt (nur
-- Status/Termine) + vorhandene Antwort. Niemals quote.id/company_id/
-- customer_id/project_id roh zurueckgeben - der Token bleibt der einzige
-- client-seitige Identifikator fuer PDF/Annahme. Bei ungueltigem Token (nie
-- existiert, abgelaufen, widerrufen) EIN einheitliches {valid: false} ohne
-- Unterscheidung, damit nichts preisgegeben wird.
-- ---------------------------------------------------------------------------

create or replace function public.get_quote_share(p_token text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link public.quote_share_links;
  result json;
begin
  select * into link from public.quote_share_links l where l.token = p_token;

  if not found or link.revoked_at is not null or link.expires_at <= now() then
    return json_build_object('valid', false);
  end if;

  update public.quote_share_links
  set first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now()
  where id = link.id;

  -- Feldnamen bewusst snake_case (wie ueberall sonst in dieser Codebase, siehe
  -- core/quotes/quote.ts, core/crm/contact.ts) - so lassen sich bestehende
  -- Helfer (contactDisplayName(), quoteStatusLabel() etc.) ohne Mapping-Schicht
  -- direkt auf die RPC-Antwort anwenden.
  select json_build_object(
    'valid', true,
    'quote_number', q.quote_number,
    'status', q.status,
    'quote_date', q.quote_date,
    'valid_until', q.valid_until,
    'tax_rate', q.tax_rate,
    'intro_text', q.intro_text,
    'closing_text', q.closing_text,
    'net_total_cents', q.net_total_cents,
    'tax_total_cents', q.tax_total_cents,
    'gross_total_cents', q.gross_total_cents,
    'company_name', c.name,
    'primary_color', c.primary_color,
    'accent_color', c.accent_color,
    'logo_url', c.logo_url,
    'customer', json_build_object(
      'type', ct.type,
      'company_name', ct.company_name,
      'first_name', ct.first_name,
      'last_name', ct.last_name,
      'street', ct.street,
      'postal_code', ct.postal_code,
      'city', ct.city,
      'country', ct.country
    ),
    'project', case when p.id is null then null else json_build_object(
      'title', p.title,
      'status', p.status,
      'start_date', p.start_date,
      'planned_end_date', p.planned_end_date
    ) end,
    'response', case when qr.id is null then null else json_build_object(
      'action', qr.action,
      'responded_at', qr.responded_at,
      'responder_name', qr.responder_name
    ) end
  ) into result
  from public.quotes q
  join public.companies c on c.id = q.company_id
  join public.contacts ct on ct.id = q.customer_id
  left join public.projects p on p.id = q.project_id
  left join public.quote_responses qr on qr.quote_id = q.id
  where q.id = link.quote_id;

  return result;
end;
$$;

revoke all on function public.get_quote_share(text) from public;
grant execute on function public.get_quote_share(text) to anon, authenticated;

create or replace function public.get_quote_share_items(p_token text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link public.quote_share_links;
  result json;
begin
  select * into link from public.quote_share_links l where l.token = p_token;

  if not found or link.revoked_at is not null or link.expires_at <= now() then
    return '[]'::json;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'position', qi.position,
      'name', qi.name,
      'unit', qi.unit,
      'quantity', qi.quantity,
      'unit_price_net_cents', qi.unit_price_net_cents,
      'line_total_net_cents', qi.line_total_net_cents
    ) order by qi.position
  ), '[]'::json) into result
  from public.quote_items qi
  where qi.quote_id = link.quote_id;

  return result;
end;
$$;

revoke all on function public.get_quote_share_items(text) from public;
grant execute on function public.get_quote_share_items(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Einziger Schreibpfad von aussen: Annahme/Ablehnung. "select ... for update"
-- sperrt Link UND Angebot fuer die Dauer der Transaktion (Race-Schutz, Muster
-- accept_invitation()); die UNIQUE-Constraint auf quote_responses.quote_id
-- ist das zusaetzliche DB-seitige Netz gegen jede verbliebene Race Condition.
-- Bewusst OHNE company_is_writable() - die Kundenreaktion ist keine interne
-- Geschaeftsdaten-Aenderung der Firma und soll nicht am Abo-Status haengen.
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_quote_share(
  p_token text,
  p_action text,
  p_responder_name text,
  p_ip text,
  p_user_agent text
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link public.quote_share_links;
  q public.quotes;
begin
  if p_action not in ('angenommen', 'abgelehnt') then
    raise exception 'Ungueltige Aktion';
  end if;
  if coalesce(btrim(p_responder_name), '') = '' then
    raise exception 'Name erforderlich';
  end if;

  select * into link from public.quote_share_links l where l.token = p_token for update;

  if not found or link.revoked_at is not null or link.expires_at <= now() then
    raise exception 'Link ungueltig oder abgelaufen';
  end if;

  select * into q from public.quotes where id = link.quote_id for update;

  if not found then
    raise exception 'Angebot nicht gefunden';
  end if;
  if q.status not in ('freigegeben', 'gesendet') then
    raise exception 'Angebot kann in diesem Status nicht beantwortet werden';
  end if;
  if q.valid_until < current_date then
    raise exception 'Angebot ist abgelaufen';
  end if;
  if exists (select 1 from public.quote_responses where quote_id = q.id) then
    raise exception 'Es liegt bereits eine Antwort vor';
  end if;

  insert into public.quote_responses (
    company_id, quote_id, share_link_id, action, responder_name, ip_address, user_agent
  ) values (
    q.company_id, q.id, link.id, p_action, btrim(p_responder_name), p_ip, p_user_agent
  );

  update public.quotes
  set status = p_action
  where id = q.id;

  return json_build_object('ok', true, 'action', p_action);
end;
$$;

revoke all on function public.respond_to_quote_share(text, text, text, text, text) from public;
grant execute on function public.respond_to_quote_share(text, text, text, text, text) to anon, authenticated;
