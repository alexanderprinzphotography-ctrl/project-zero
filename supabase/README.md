# Supabase-Setup — MS 1a

## 1. Migration anwenden

Die Migration `migrations/20260706095904_ms1a_auth_companies_profiles.sql` manuell im
Supabase-Dashboard ausführen:

1. Supabase-Dashboard → dein Projekt → **SQL Editor** → **New query**.
2. Inhalt von `supabase/migrations/20260706095904_ms1a_auth_companies_profiles.sql`
   komplett einfügen.
3. **Run**. Bei Erfolg existieren die Tabellen `companies`/`profiles`, RLS ist aktiv,
   und die Funktionen `current_company_id()`, `current_user_role()`, `register_company()`
   sind angelegt.

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
