# Implementierungsplan — MVP „Baustellen-Zentrale"

> Begleitdokument zum Projektkontext. Jeder Meilenstein wird in einen oder mehrere Claude-Code-Prompts übersetzt. Die Review-Checkpoints (MS 1a, MS 1b, MS 6, MS 8, MS 9) werden vom Projektinhaber (Fachinformatiker AE) manuell geprüft.

## Arbeitsweise

- **Ein Schritt = ein abgegrenztes, testbares Feature.** Vor jedem Schritt kurzes Sparring, dann der Claude-Code-Prompt.
- **RLS-first:** Jede neue Tabelle mit Firmenbezug bekommt im selben Schritt ihre Row-Level-Security-Policy. Kein Feature sieht echte Daten, bevor die Mandantentrennung steht.
- **Review-Checkpoints:** An sicherheits-, geld- oder rechtsrelevanten Stellen wird der generierte Code bewusst gelesen, bevor weitergebaut wird.
- **Reihenfolge:** MS 0 bis MS 3 sind Fundament und laufen strikt der Reihe nach. Ab MS 4 sind CRM/Projekte/Tagebuch/Zeit/Planung inhaltlich koppelbar, aber die hier gewählte Reihenfolge minimiert Nacharbeit.

## Querschnitts-Konventionen

- **Sprache/Stack:** TypeScript strict, Next.js App Router, React Server Components wo sinnvoll, Supabase-Client server- und clientseitig sauber getrennt.
- **Projektstruktur:** Feature-orientierte Ordner (`src/core/...` für branchenagnostische Bausteine, `src/modules/handwerk/...` für Branchenspezifisches). Diese Trennung ab Tag 1, damit der spätere Core-Extract ein Refactoring bleibt, kein Neuschreiben.
- **Migrationen:** als versionierte SQL-Dateien im Repo (nicht nur im Supabase-Studio klicken) — reproduzierbar und reviewbar.
- **Mandantentrennung:** Zugriff auf die eigene Firma über die `SECURITY DEFINER`-Funktion `current_company_id()`; keine rekursiven RLS-Policies.
- **Nur-Lese-/Abo-Sperre:** Schreib-Policies (INSERT/UPDATE/DELETE) auf Geschäftsdaten enthalten immer `company_is_writable()`; SELECT nicht. Nach Trial-Ablauf gilt firmenweit Nur-Lese-Zugriff, auf DB-Ebene erzwungen. Gilt für **jede** künftige Feature-Tabelle.
- **Rollen:** `admin` (Firmen-Owner, volle Verwaltung), `projektleiter` (Projekte/Team), `mitarbeiter` (operativ).
- **Feature-Flags / Entitlements:** simple Flag-Tabelle pro Firma vorbereiten (welche Module aktiv sind), auch wenn im MVP nur „Handwerk" existiert.
- **Umgebung:** Supabase & Vercel in EU-Region. Secrets über Env-Variablen, nie im Repo.
- **Tests:** kritische Pfade (Auth, Mandantentrennung, Geldbeträge, Tagebuch-Unveränderlichkeit) mit automatisierten Tests; Rest pragmatisch.
- **Responsive:** Desktop & Tablet als primäre Ziel-Viewports; Layouts von Anfang an fluid. Handy-Feinschliff/PWA später.

---

## MS 0 — Setup & Fundament  ✅

**Ziel:** Ein deploybares, leeres Gerüst, das schon in der Cloud läuft.

**Umfang**
- Next.js (App Router, TS) initialisiert, Tailwind + shadcn/ui eingerichtet, Framer Motion installiert.
- Supabase-Projekt (EU) angebunden; server-/client-seitige Clients konfiguriert.
- Basis-Layout (Shell mit Platzhalter-Navigation), Theme-Grundgerüst über CSS-Variablen.
- Deploy-Pipeline auf Vercel (EU); erste Live-URL.
- Ordnerstruktur `src/core` und `src/modules/handwerk` angelegt.

**Fertig, wenn:** eine öffentliche Platzhalter-Seite in der Cloud erreichbar ist und der Build sauber durchläuft. (Zugriffsschutz kommt mit der Auth in MS 1.)

---

## MS 1a — Auth, Firmen & Rollen  · 🔍 Review-Checkpoint  ✅

**Ziel:** Sicheres Login und wasserdichte Datentrennung; Self-Service-Registrierung mit 14-Tage-Trial.

**Umfang**
- Supabase Auth (E-Mail/Passwort): Login, Logout, Passwort-Reset; SSR-Session via `@supabase/ssr` + Middleware.
- `companies` (u. a. `plan_status`, `trial_ends_at`), `profiles` (`company_id`, `role` aus admin/projektleiter/mitarbeiter).
- Self-Service-Registrierung: neue Firma startet im Trial (`trial_ends_at = now() + 14 Tage`), der Registrierende wird `admin` — atomar über eine `SECURITY DEFINER`-Funktion.
- RLS auf `companies`/`profiles` über `current_company_id()`; keine rekursiven Policies.

**Review-Checkpoint:** Cross-Tenant-Test (Firma A sieht nie Firma B), atomare Registrierung (kein Nutzer ohne Firma/Profil), keine rekursive RLS.

**Fertig, wenn:** zwei Firmen sich unabhängig registrieren und nachweislich keine Datenüberschneidung möglich ist.

---

## MS 1b — Einladungen, Rollen-UI & Trial-Lifecycle  · 🔍 Review-Checkpoint  ✅

**Ziel:** Team hereinholen, rollenbasierte Sichtbarkeit, Nur-Lese-Zugriff nach Trial-Ablauf.

**Umfang**
- `invitations`-Tabelle (`token`, `role`, `max_uses` [1 = Single-Use, NULL = Team-Link], `expires_at`, `used_count`, `revoked_at`); nur `admin` erstellt/verwaltet.
- **Kopierbarer Einladungslink** (`/einladung/<token>`) — Rolle und Typ (Single-Use oder Team-Link) beim Erstellen wählbar.
- Accept-Flow: eingeladene Person tritt der bestehenden Firma mit der Einladungs-Rolle bei (KEINE neue Firma), atomar über `accept_invitation()`. Ein Nutzer = eine Firma.
- Trial-Lifecycle: `company_is_writable()`; nach Ablauf firmenweit Nur-Lese auf DB-Ebene. Trial-Banner, „abgelaufen"-Zustand mit Platzhalter-Upgrade-Seite (`/konto/upgrade`).
- Rollenbasierte Sichtbarkeit; einfache Mitgliederliste.

**Review-Checkpoint:** Accept-Flow gegen Missbrauch (abgelaufener/widerrufener/aufgebrauchter Token, fremde Firma, bereits zugehöriger Nutzer); Nur-Lese-Sperre auf DB-Ebene (nicht nur UI); nur `admin` kann einladen.

**Fertig, wenn:** Einladungen greifen (beide Typen), Missbrauchsfälle werden abgewiesen, und nach simuliertem Trial-Ablauf sind Schreibvorgänge DB-seitig gesperrt, Lesen bleibt möglich.

---

## MS 2 — Theming / Corporate Design  ⏳ (in Arbeit)

**Ziel:** Jede Firma passt die Oberfläche an ihr Corporate Design an; jeder Nutzer wählt Hell/Dunkel.

**Umfang**
- Einstellungsseite (nur Admin): Logo-Upload (Supabase Storage), Primär- und Akzentfarbe, mit Live-Vorschau.
- Theming über CSS-Variablen pro Firma (shadcn-Komponenten übernehmen die Werte); Kontrast-Sicherheit für Button-Text.
- Dark Mode als persönliche Einstellung pro Nutzer (light/dark/system); Markenfarben bleiben in beiden Modi. SSR ohne Flash.
- Theme-Bearbeitung respektiert `company_is_writable()`.

**Hinweis:** Der KI-Brand-Import (Website/CI-PDF → Theme-Vorschlag) baut auf dieser Mechanik auf und ist als Premium-Feature in die KI-Phase verschoben (siehe Roadmap).

**Fertig, wenn:** zwei Firmen sichtbar unterschiedlich aussehen (Logo/Farben), Hell/Dunkel funktioniert und nichts umflackert.

---

## MS 3 — CRM-lite (Kunden & Kontakte)

**Ziel:** Kundenstamm, an dem später Projekte hängen.

**Umfang**
- Tabelle `contacts` (`company_id`, Firmenname/Person, Kontaktdaten, Notizen) + RLS (inkl. `company_is_writable()` auf Schreibpfaden).
- CRUD-Oberfläche: Liste (such-/filterbar), Detailansicht, Anlegen/Bearbeiten.

**Fertig, wenn:** Kunden angelegt, gefunden und bearbeitet werden können, sauber mandantengetrennt.

---

## MS 4 — Projekte / Baustellen

**Ziel:** Das Rückgrat — Baustellen als generische Projekte mit Handwerk-Typ.

**Umfang**
- Tabelle `projects` (`company_id`, `type` = `baustelle`, `status`, `customer_id`, `metadata` als JSONB für typspezifische Felder) + RLS.
- Tabelle `project_members` (Zuweisung von Mitarbeitern zu Projekten).
- Projekt anlegen (mit Kundenverknüpfung), Detailseite mit Infos, Mitarbeiter zuweisen, Statuswechsel.
- Handwerk-Typ liefert die baustellenspezifischen Felder — bewusst über Konfiguration, nicht hartcodiert.

**Daten-/Sicherheitshinweise:** Hier zeigt sich das „generisches Projekt + Typ"-Prinzip. Sauber halten, damit ein Makler-Typ später nur ein Modul ist.

**Fertig, wenn:** eine Baustelle mit Kunde und zugewiesenen Mitarbeitern vollständig geführt werden kann.

---

## MS 5 — Baustellen-Tagebuch (beweissicher)

**Ziel:** Foto- und Textdokumentation, unveränderlich und zeitgestempelt.

**Umfang**
- Tabelle `diary_entries` (`project_id`, `author_id`, `created_at`, Text) — **append-only**: keine Updates/Deletes (per RLS/Policy erzwungen).
- Foto-Upload in Supabase Storage, Verknüpfung zum Eintrag; Aufnahme-/Upload-Zeitpunkt festgehalten.
- Chronologische Tagebuch-Ansicht pro Projekt, tablet-tauglich.

**Daten-/Sicherheitshinweise:** Die Unveränderlichkeit ist das rechtliche Kernversprechen („beweissicher"). Muss auf DB-Ebene garantiert sein, nicht nur im UI.

**Fertig, wenn:** Einträge samt Fotos erfasst und angezeigt, aber nachträglich nicht mehr verändert werden können.

---

## MS 6 — Zeiterfassung  · 🔍 Review-Checkpoint

**Ziel:** Projektbezogene Arbeitszeiten sauber erfassen und auswerten.

**Umfang**
- Tabelle `time_entries` (`company_id`, `project_id`, `user_id`, Start, Ende, Dauer, Notiz) + RLS.
- Erfassung per Start/Stopp und manuelle Eingabe/Korrektur.
- Auswertung: Zeit pro Projekt und pro Mitarbeiter.

**Review-Checkpoint:** Zeit-/Dauer-Berechnung und Rundungen prüfen (Grundlage für spätere Abrechnung — Fehler hier werden teuer).

**Fertig, wenn:** Zeiten pro Projekt korrekt summiert und pro Mitarbeiter auswertbar sind.

---

## MS 7 — Einsatzplanung

**Ziel:** Wer ist wann wo — ohne Doppelbelegung.

**Umfang**
- Tabelle `schedule_assignments` (`company_id`, `user_id`, `project_id`, Zeitraum) + RLS.
- Planungsansicht (Kalender/Wochenraster): Mitarbeiter Projekten/Zeiträumen zuweisen.
- **Doppelbelegungs-Check:** Warnung, wenn ein Mitarbeiter zeitgleich zwei Einsätzen zugewiesen wird.

**Fertig, wenn:** eine Woche geplant und jede Doppelbelegung zuverlässig erkannt wird.

---

## MS 8 — KI-Angebotserstellung  · 🔍 Review-Checkpoint

**Ziel:** Das sichtbare Wow-Feature — aus Projekt-/Vor-Ort-Daten ein Angebot generieren.

**Umfang**
- Vor-Ort-/Projekteingaben strukturiert erfassen (Positionen, Mengen, Notizen).
- Anthropic-Claude-API-Anbindung: Entwurf eines Angebots (Positionen, Texte) aus diesen Daten.
- **Review-Flow:** KI erzeugt einen Entwurf, der Mensch prüft, ändert und bestätigt (Mensch-im-Kreislauf).
- Angebot als PDF (nutzt die `pdf`-Skill-Konventionen); Speicherung + Status (Entwurf/gesendet/angenommen).
- Manuelle Angebotserstellung ohne KI ebenfalls möglich.

**Daten-/Sicherheitshinweise:** KI-Ausgabe wird nie ungeprüft verbindlich. Betrags-/Positionslogik ist bewusst überprüfbar.

**Review-Checkpoint:** Prompt-Qualität und Betragslogik prüfen; sicherstellen, dass keine KI-Halluzination ungeprüft ins Angebot wandert.

**Fertig, wenn:** aus einer Baustelle per Klick ein prüfbarer Angebotsentwurf entsteht, der als PDF exportiert werden kann.

---

## MS 9 — Billing & Abo (Stripe)  · 🔍 Review-Checkpoint

**Ziel:** Aus dem Trial wird ein zahlender Kunde — der Weg aus dem Nur-Lese-Zustand.

**Umfang**
- Stripe-Anbindung: Checkout für den Abo-Abschluss, Customer Portal für Verwaltung/Kündigung.
- Webhooks halten `plan_status`/`trial_ends_at` der Firma synchron (z. B. `trial` → `active` nach erfolgreicher Zahlung; bei Kündigung/Zahlungsausfall entsprechend zurück).
- Die Platzhalter-Upgrade-Seite aus MS 1b wird zur echten Abo-Seite; nach aktivem Abo fällt die Nur-Lese-Sperre.
- Grundlage für später zubuchbare Premium-Module (Entitlements).

**Daten-/Sicherheitshinweise:** Geld-relevant. Webhook-Signaturen prüfen; Abo-Status niemals allein aus dem Client übernehmen, sondern serverseitig über Webhooks/Stripe verifizieren.

**Review-Checkpoint:** Abo-Statuswechsel und Webhook-Verarbeitung testen; sicherstellen, dass sich der `plan_status` nicht clientseitig manipulieren lässt.

**Fertig, wenn:** eine Firma ein Abo abschließen kann, `plan_status` serverseitig korrekt auf `active` wechselt und die Nur-Lese-Sperre aufgehoben wird.

---

## MS 10 — Politur & Responsive-Feinschliff

**Ziel:** Aus „funktioniert" wird „fühlt sich hochwertig an".

**Umfang**
- Animationen für Zustands-/Prozess-Feedback (Framer Motion): Ladezustände, Erfolg, Übergänge.
- Responsive-Feinschliff für Desktop & Tablet; leere Zustände, Fehlermeldungen, Onboarding-Politur.
- Konsistenz-Durchgang über alle Module.

**Fertig, wenn:** ein Neukunde die App ohne Erklärung bedienen kann und sie sich rund anfühlt.

---

## Nach dem MVP (nicht Teil dieses Plans)

- Rechnungen/E-Rechnung/DATEV via lexoffice/sevDesk (Fach-API andocken).
- **KI-Brand-Import (Premium):** Website-URL oder CI-PDF → KI schlägt Logo + Primär-/Akzentfarbe vor → Admin bestätigt in der MS-2-Vorschau. Nutzt Claude (Vision/PDF), optional zusätzlich eine Brand-API.
- Materialbedarfs-Rechner.
- Kundenportal (Kunde sieht/akzeptiert Angebot, sieht Projektfortschritt).
- KI-Marketing / Anzeigen-Analyse & -Optimierung (Premium).
- Natürlichsprachiger Automations-Builder.
- - Kunden-Import & CRM-Integrationen (Premium): CSV-Import (universell, jedes Quellsystem) sowie API-Connectoren zu HubSpot/Pipedrive (Sync in die App-Kontakte). Das eigene CRM bleibt der Unterbau, die Integration füttert es.
- Handy-/PWA-/Offline-Ausbau.
- Weitere Branchenmodule (z. B. Makler).
