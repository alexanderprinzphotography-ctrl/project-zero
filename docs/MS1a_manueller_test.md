# MS 1a — Manueller Review-Test (Cross-Tenant-Isolation)

Checkliste für den Review-Checkpoint. Vorher: Migration angewendet (siehe
`supabase/README.md`) und `npm run dev` gestartet.

## 1. Zwei Firmen unabhängig registrieren

1. `/registrieren` öffnen, Firma A registrieren (z. B. `firma-a@example.com`).
2. Falls E-Mail-Bestätigung aktiv ist: Bestätigungsmail abrufen, Link öffnen.
3. Im Supabase-Dashboard → **Table Editor** → `companies` prüfen: neue Zeile mit
   `plan_status = 'trial'` und `trial_ends_at` ≈ jetzt + 14 Tage.
4. In `profiles`: Zeile mit `role = 'admin'`, korrekter `company_id`.
5. Schritt 1–4 mit Firma B wiederholen (`firma-b@example.com`). Zwei unabhängige
   `company_id`s müssen existieren.

## 2. Login/Logout/Passwort-Reset

- Mit Firma A ausloggen, wieder einloggen → funktioniert.
- `/login/passwort-vergessen` mit `firma-a@example.com` anfragen, Mail abrufen, Link
  öffnen, neues Passwort setzen, damit einloggen.
- Nicht angemeldet `/` aufrufen → Redirect nach `/login`.

## 3. Cross-Tenant-Zugriff gezielt testen (der kritische Test)

Im Supabase-Dashboard → **SQL Editor**, eingeloggt als Projekt-Owner (bypassed RLS
nicht automatisch — SQL Editor läuft i. d. R. mit privilegierter Rolle, daher stattdessen
über die **API** mit dem JWT von Firma A testen):

1. In der App als Firma A einloggen, Browser-DevTools → Application → Cookies →
   Supabase-Access-Token kopieren (oder einfacher: die Firma-A-Session im Browser offen
   lassen und im gleichen Browser die IDs von Firma B aus Schritt 1 notieren).
2. Im **SQL Editor** mit `set role authenticated; set request.jwt.claims = '{"sub":"<firma-a-user-id>"}';`
   *oder* pragmatischer: über die Browser-Konsole auf `/` (als Firma A eingeloggt) einen
   Fetch gegen die Supabase-REST-API mit der `company_id` von Firma B ausführen:
   ```js
   fetch("https://<projekt>.supabase.co/rest/v1/companies?id=eq.<firma-b-company-id>", {
     headers: {
       apikey: "<anon-key>",
       Authorization: "Bearer <firma-a-access-token>",
     },
   }).then(r => r.json()).then(console.log);
   ```
   Erwartet: leeres Array `[]` — Firma A bekommt keine Zeile von Firma B, obwohl die ID
   korrekt und die Zeile vorhanden ist.
3. Gleiches für `profiles?company_id=eq.<firma-b-company-id>` → ebenfalls `[]`.
4. Direktes Ändern des eigenen Profils versuchen: `role` oder `company_id` per
   `PATCH /rest/v1/profiles?id=eq.<eigene-user-id>` auf einen anderen Wert setzen →
   muss mit einem Fehler abgelehnt werden (Trigger `profiles_protect_privileged_fields`).

## 4. Keine verwaisten Registrierungen

- Falls beim Registrieren absichtlich ein Fehler provoziert wird (z. B. Netzwerk kurz
  trennen nach `signUp`, dann neu laden und normal einloggen): Der nächste Login muss
  automatisch die Firma anlegen (`ensureCompanyForUser`), nicht zu einem Nutzer ohne
  Profil führen.

## 5. Ergebnis festhalten

Nach erfolgreichem Durchlauf: Häkchen an alle Punkte, Auffälligkeiten hier oder als
Kommentar im PR/Commit vermerken, bevor mit MS 1b weitergemacht wird.
