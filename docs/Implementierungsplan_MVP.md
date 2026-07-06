# Implementierungsplan — MVP „Baustellen-Zentrale"

> Begleitdokument zum Projektkontext. Jeder Meilenstein wird in einen oder mehrere Claude-Code-Prompts übersetzt. Kritische Meilensteine (1, 6, 9) haben einen Review-Checkpoint, den der Projektinhaber (Fachinformatiker AE) manuell prüft.

## Arbeitsweise

- **Ein Schritt = ein abgegrenztes, testbares Feature.** Vor jedem Schritt kurzes Sparring, dann der Claude-Code-Prompt.
- **RLS-first:** Jede neue Tabelle mit Firmenbezug bekommt im selben Schritt ihre Row-Level-Security-Policy. Kein Feature sieht echte Daten, bevor die Mandantentrennung steht.
- **Review-Checkpoints:** An sicherheits- oder rechtsrelevanten Stellen wird der generierte Code bewusst gelesen, bevor weitergebaut wird.
- **Reihenfolge:** MS 0–3 sind Fundament und laufen strikt der Reihe nach. Ab MS 4 sind CRM/Projekte/Tagebuch/Zeit/Planung inhaltlich koppelbar, aber die hier gewählte Reihenfolge minimiert Nacharbeit.

## Querschnitts-Konventionen

- **Sprache/Stack:** TypeScript strict, Next.js App Router, React Server Components wo sinnvoll, Supabase-Client server- und clientseitig sauber getrennt.
- **Projektstruktur:** Feature-orientierte Ordner (`/core/...` für branchenagnostische Bausteine, `/modules/handwerk/...` für Branchenspezifisches). Diese Trennung ab Tag 1, damit der spätere Core-Extract ein Refactoring bleibt, kein Neuschreiben.
- **Feature-Flags / Entitlements:** simple Flag-Tabelle pro Firma vorbereiten (welche Module aktiv sind), auch wenn im MVP nur „Handwerk" existiert.
- **Umgebung:** Supabase & Vercel in EU-Region. Secrets über Env-Variablen, nie im Repo.
- **Tests:** kritische Pfade (Auth, Mandantentrennung, Geldbeträge, Tagebuch-Unveränderlichkeit) mit automatisierten Tests; Rest pragmatisch.
- **Responsive:** Desktop & Tablet als primäre Ziel-Viewports; Layouts von Anfang an fluid.

---

## MS 0 — Setup & Fundament

**Ziel:** Ein deploybares, leeres Gerüst, das schon in der Cloud läuft.

**Umfang**
- Next.js (App Router, TS) initialisiert, Tailwind + shadcn/ui eingerichtet, Framer Motion installiert.
- Supabase-Projekt (EU) angebunden; server-/client-seitige Clients konfiguriert.
- Basis-Layout (Shell mit Platzhalter-Navigation), ein Theme-Grundgerüst über CSS-Variablen.
- Deploy-Pipeline auf Vercel (EU); erste Live-URL.
- Ordnerstruktur `/core` und `/modules/handwerk` angelegt.

**Fertig, wenn:** eine geschützte Platzhalter-Seite in der Cloud erreichbar ist und der Build sauber durchläuft.

---

## MS 1 — Auth & Multi-Tenancy  · 🔍 Review-Checkpoint

**Ziel:** Sicheres Login und wasserdichte Datentrennung zwischen Firmen.

**Umfang**
- Supabase Auth (E-Mail/Passwort) mit Login/Logout/Passwort-Reset.
- Datenmodell: `companies` (Tenants), `profiles` (verknüpft mit auth-User, `company_id`, `role`), Rollen `admin` / `mitarbeiter`.
- Einladungs-Flow: Admin lädt Mitarbeiter per E-Mail in die eigene Firma ein.
- **RLS-Policies** auf allen Tenant-Tabellen: ein Nutzer sieht ausschließlich Daten seiner `company_id`.
- Rollenbasierte Sichtbarkeit im UI (Admin sieht Verwaltung, Mitarbeiter nicht).

**Daten-/Sicherheitshinweise:** Das ist das Fundament. RLS wird auf DB-Ebene erzwungen, nicht im App-Code.

**Review-Checkpoint:** RLS-Policies und Einladungs-Flow manuell prüfen — gezielt testen, dass Firma A niemals Daten von Firma B laden kann (auch nicht über manipulierte Requests).

**Fertig, wenn:** zwei Testfirmen parallel existieren und nachweislich keine Datenüberschneidung möglich ist.

---

## MS 2 — Theming / Corporate Design

**Ziel:** Jede Firma passt Oberfläche an ihr Corporate Design an.

**Umfang**
- Einstellungs-Seite (Admin): Logo-Upload (Supabase Storage), Primär-/Akzentfarben.
- Theming über CSS-Variablen, die pro Firma gesetzt werden; shadcn-Komponenten übernehmen die Werte.
- Live-Vorschau der Änderungen.

**Fertig, wenn:** zwei Firmen sichtbar unterschiedliche Farben/Logo haben, ohne Code-Änderung.

---

## MS 3 — CRM-lite (Kunden & Kontakte)

**Ziel:** Kundenstamm, an dem später Projekte hängen.

**Umfang**
- Tabelle `contacts` (`company_id`, Firmenname/Person, Kontaktdaten, Notizen) + RLS.
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
- Tabelle `diary_entries` (`project_id`, `author_id`, `created_at`, Text) — **append-only**: keine Updates/Deletes auf Einträge (per RLS/Policy erzwungen).
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

## MS 9 — Politur & Responsive-Feinschliff

**Ziel:** Aus „funktioniert" wird „fühlt sich hochwertig an".

**Umfang**
- Animationen für Zustands-/Prozess-Feedback (Framer Motion): Ladezustände, Erfolg, Übergänge.
- Responsive-Feinschliff für Desktop & Tablet; leere Zustände, Fehlermeldungen, Onboarding-Politur.
- Konsistenz-Durchgang über alle Module.

**Fertig, wenn:** ein Neukunde die App ohne Erklärung bedienen kann und sie sich rund anfühlt.

---

## Nach dem MVP (nicht Teil dieses Plans)

Rechnungen/E-Rechnung/DATEV via lexoffice/sevDesk · Materialbedarfs-Rechner · Kundenportal · KI-Marketing (Premium) · Automations-Builder · CRM-Integrationen · Handy-/PWA-/Offline-Ausbau · weitere Branchenmodule (z. B. Makler).
