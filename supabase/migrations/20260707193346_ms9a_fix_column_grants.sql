-- MS 9a Korrektur: Spalten-Sperre griff nicht.
--
-- Der REVOKE UPDATE (spalten) ... FROM authenticated aus der vorherigen
-- Migration hat keine Wirkung gezeigt: Supabase-Projekte haben standardmaessig
-- einen TABELLEN-weiten "GRANT UPDATE ON companies TO authenticated" (aus dem
-- initialen Projekt-Setup, nicht aus unseren Migrationen). Spalten- und
-- Tabellen-Grants sind in Postgres ADDITIV - ein bestehender Tabellen-Grant
-- erlaubt weiterhin ALLE Spalten, auch wenn einzelne Spalten separat per
-- Spalten-REVOKE entzogen wurden. Verifiziert: ein admin konnte plan_status
-- trotz der vorherigen Migration direkt per Update setzen.
--
-- Korrekt: den TABELLEN-weiten Grant komplett entziehen und NUR die
-- tatsaechlich vom Client zu aendernden Spalten gezielt neu gewaehren.
-- trial_ends_at war nie explizit erlaubt und bleibt hierdurch (zusaetzlich zu
-- den Billing-Spalten) ebenfalls gesperrt - sonst koennte sich ein admin per
-- Update selbst eine laengere Testphase verschaffen.

revoke update on public.companies from authenticated;

grant update (
  name,
  primary_color,
  accent_color,
  logo_url,
  project_visibility,
  schedule_visibility,
  auto_release_enabled,
  auto_release_limit_cents
) on public.companies to authenticated;
