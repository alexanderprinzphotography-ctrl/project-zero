-- MS 9b: Feature-Gating (Pro schaltet KI frei)
-- Generischer Entitlement-Helfer, damit kuenftige Pro-Features denselben Weg
-- gehen koennen. Liest ausschliesslich den serverseitigen Firmen-Status
-- (current_company_id()) - nie einen vom Client mitgeschickten Wert.

create or replace function public.company_has_feature(feature_key text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_plan_status text;
  v_trial_ends_at timestamptz;
  v_plan_tier text;
begin
  select plan_status, trial_ends_at, plan_tier
  into v_plan_status, v_trial_ends_at, v_plan_tier
  from public.companies
  where id = public.current_company_id();

  if feature_key = 'ki' then
    return (v_plan_status = 'trial' and v_trial_ends_at > now())
      or (v_plan_status in ('active', 'past_due') and v_plan_tier = 'pro');
  end if;

  return false;
end;
$$;

revoke all on function public.company_has_feature(text) from public;
grant execute on function public.company_has_feature(text) to authenticated;
