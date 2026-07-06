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
