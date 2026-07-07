-- MS 9a: Billing-Kern (Stripe, Abo & Status)
-- plan_status/plan_tier duerfen NIE ueber einen normalen authentifizierten
-- Request gesetzt werden - ausschliesslich durch den serverseitigen,
-- signatur-verifizierten Stripe-Webhook (service_role, umgeht RLS UND die
-- untenstehenden Spalten-Grants komplett).

alter table public.companies
  add column plan_tier text check (plan_tier in ('basic', 'pro')),
  add column billing_interval text check (billing_interval in ('month', 'year')),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique,
  add column current_period_end timestamptz;

-- Sicherheitsschicht gegen Client-Manipulation (Review-Checkpoint): selbst ein
-- admin darf plan_status & Co. nicht per PATCH-Request auf die eigene Firma
-- setzen - nur der Webhook (service_role) kann diese Spalten schreiben.
revoke update (
  plan_status,
  plan_tier,
  billing_interval,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_end
) on public.companies from authenticated;

-- company_is_writable(): past_due gilt als Kulanzzeitraum waehrend Stripe die
-- Zahlung erneut versucht - Zugriff bleibt bestehen. canceled/expired oder ein
-- abgelaufener Trial bleiben gesperrt.
create or replace function public.company_is_writable()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when c.plan_status = 'active' then true
    when c.plan_status = 'past_due' then true
    when c.plan_status = 'trial' and c.trial_ends_at > now() then true
    else false
  end
  from public.companies c
  where c.id = public.current_company_id()
$$;

-- ---------------------------------------------------------------------------
-- Kontrolliertes Setzen von stripe_customer_id durch den Checkout-Flow (admin,
-- normale Session - kein Webhook): einzige erlaubte Ausnahme von der obigen
-- Spalten-Sperre, eng gefasst (nur diese eine Spalte, nur einmalig von NULL
-- weg, nur fuer die eigene Firma als admin). plan_status/plan_tier bleiben
-- davon unberuehrt - die setzt ausschliesslich der Webhook.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_stripe_customer_id(p_company_id uuid, p_customer_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id <> public.current_company_id() or public.current_user_role() <> 'admin' then
    raise exception 'Keine Berechtigung';
  end if;

  update public.companies
  set stripe_customer_id = p_customer_id
  where id = p_company_id and stripe_customer_id is null;
end;
$$;

revoke all on function public.ensure_stripe_customer_id(uuid, text) from public;
grant execute on function public.ensure_stripe_customer_id(uuid, text) to authenticated;
