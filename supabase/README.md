# Supabase-Setup

## 1. Migrationen anwenden

Migrationen manuell im Supabase-Dashboard ausführen, in aufsteigender Dateireihenfolge:

1. Supabase-Dashboard → dein Projekt → **SQL Editor** → **New query**.
2. Inhalt der jeweiligen `.sql`-Datei komplett einfügen, **Run**.

| Datei | Bringt |
| --- | --- |
| `20260706095904_ms1a_auth_companies_profiles.sql` | `companies`/`profiles`, RLS, `current_company_id()`, `current_user_role()`, `register_company()` |
| `20260706113116_ms1b_invitations_trial_lifecycle.sql` | `invitations` (admin-only RLS), `company_is_writable()` (Trial-Sperre), `get_invitation_preview()`, `accept_invitation()` |
| `20260706125044_ms2_theming_corporate_design.sql` | `companies.primary_color`/`accent_color`/`logo_url`, Storage-Bucket `logos` (öffentlich lesbar, admin-only Schreiben), Theme-Sperre bei abgelaufenem Trial, `get_invitation_preview()` um Farben/Logo erweitert |
| `20260706180035_ms3_crm_contacts.sql` | `contacts` (RLS: lesen alle Rollen, schreiben nur admin/projektleiter + Trial-Sperre), `company_counters` + `next_customer_number()` für race-sichere, pro Firma fortlaufende Kundennummer |
| `20260706184710_ms4_projects.sql` | `company_counters` verallgemeinert (gekeytes Zähler-Design), `projects`/`project_members`, `companies.project_visibility`, sichtbarkeitsabhängige RLS (`company_project_visibility()`, `is_project_member()`), Cross-Company-Validierung für `customer_id`/`user_id` |
| `20260706194708_ms5a_diary_core.sql` | `diary_entries`/`diary_photos` (append-only, Hash-Kette pro Projekt über `append_diary_entry()`), `verify_diary()`, harte Update/Delete-Sperre per Trigger, privater Storage-Bucket `diary-photos` |
| `20260706225041_ms6_time_entries.sql` | `time_entries` (Timer + manuell, exakte Dauer aus Zeitstempeln, DST-sicher), Partial-Unique-Index für max. einen laufenden Timer pro Nutzer, RLS (eigene Einträge + admin/PL alle) |
| `20260706232608_ms7_schedule_entries.sql` | `schedule_entries` (Einsatz/Abwesenheit, ganztags/halbtags/Uhrzeit), `companies.schedule_visibility`, `company_schedule_visibility()`, Cross-Company-Validierung, RLS (nur admin/PL schreiben, Sichtbarkeit nach Einstellung) |
| `20260707074127_ms8a_catalog_items.sql` | `catalog_items` (Leistungskatalog, Preise als Ganzzahl-Cent), optionale fortlaufende Artikelnummer über `next_counter_value()`, RLS (nur admin/PL lesen/schreiben, kein Hard-Delete) |
| `20260707115539_ms8b_quotes.sql` | `quotes`/`quote_items` (Angebote, Positionen als Preis-Snapshot vom Katalog), `companies.auto_release_*`, `reorder_quote_items()` (atomares Umsortieren), Cross-Company-Validierung, RLS (admin/PL, SELECT ohne Trial-Sperre) |
| `20260707133859_ms8c_ai_quote_draft.sql` | `quotes.is_ai_generated`/`intake_description`/`intake_rooms`/`unmatched_items`, `quote_items.is_ai_suggested`/`ai_note` (reine Kennzeichnungs-/Nachvollziehbarkeits-Spalten, keine neue RLS noetig) |
| `20260707180920_ms9a_billing_core.sql` | `companies.plan_tier`/`billing_interval`/`stripe_customer_id`/`stripe_subscription_id`/`current_period_end`; diese Spalten sind für `authenticated` per `REVOKE` gesperrt (nur der Stripe-Webhook via service_role darf sie schreiben); `ensure_stripe_customer_id()` als einzige kontrollierte Ausnahme (nur `stripe_customer_id`, nur einmalig); `company_is_writable()` erlaubt jetzt auch `past_due` |
| `20260707193346_ms9a_fix_column_grants.sql` | Korrektur: der Spalten-`REVOKE` aus der vorherigen Migration griff nicht (ein bestehender tabellen-weiter `UPDATE`-Grant für `authenticated` ist additiv, nicht überschreibend) — entzieht den Tabellen-Grant komplett und gewährt gezielt nur die erlaubten Spalten neu; sperrt zusätzlich `trial_ends_at` |
| `20260707221631_ms9b_feature_gating.sql` | `company_has_feature(feature_key text)` — generischer SECURITY DEFINER-Entitlement-Helfer, aktuell `'ki'`: Trial gültig ODER (`active`/`past_due` UND `plan_tier='pro'`) |

Spätere Migrationen kommen als weitere, zeitlich aufsteigend benannte `.sql`-Dateien in
denselben Ordner und werden nach demselben Muster eingespielt.

## 2. Auth-Konfiguration im Dashboard (einmalig, nicht per SQL steuerbar)

**Authentication → URL Configuration**
- **Site URL**: `http://localhost:3000` (lokal) bzw. eure Vercel-Produktions-URL.
- **Redirect URLs**: `http://localhost:3000/auth/confirm`, `http://localhost:3000/**`
  (und die entsprechenden Produktions-Domains ergänzen, sobald deployed).

**Authentication → Emails → Email Templates**

Die App nutzt für Bestätigungs-/Reset-Links den Token-Hash-Flow über die eigene Route
`/auth/confirm` (statt der von Supabase gehosteten Standard-Bestätigungsseite). Dafür in
den Templates `{{ .ConfirmationURL }}` durch folgende Links ersetzen:

- **Confirm signup**:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/`
- **Reset Password**:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/konto/neues-passwort`

Ohne diese Anpassung landen Nutzer auf der generischen Supabase-Bestätigungsseite statt
in der App.

## 3. Lokale Entwicklung

`.env.local` enthält bereits `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
für dieses Projekt (siehe `.env.local.example` für die Variablennamen).
