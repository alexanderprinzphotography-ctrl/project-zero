# CLAUDE.md — Baustellen-Zentrale

## Aktueller Stand
Fertig: MS 0–9 (9a Billing-Kern: Stripe/Abo/Status, 9b Feature-Gating: Pro schaltet KI frei), MS 10a–10d (Politur-Fundament, App-Shell-Redesign, Dashboard-Startseite, Innenseiten-Feinschliff), MS 11a (sevdesk-Verbindung: Provider-Abstraktion, verschlüsselte API-Key-Speicherung, Kontakt-Sync), MS 11b (Rechnung aus Angebot: sevdesk-Rechnungserstellung, mehrschichtige Idempotenz, Rechnungsübersicht mit Status-Sync und PDF-Proxy). Nächster Meilenstein noch offen. Nur im aktuellen Meilenstein arbeiten, nicht vorgreifen.

## Projekt (kurz)
Mandantenfähige SaaS-Webapp für Handwerks- und Baubetriebe (Arbeitstitel „Baustellen-Zentrale"). Kern: Projekt-/Baustellenverwaltung. Modularer Aufbau: branchenagnostischer Core + austauschbare Branchenmodule + zubuchbare Premium-Module.
Ausführlicher Kontext in `docs/Projektkontext.md`, Fahrplan in `docs/Implementierungsplan_MVP.md` — bei Bedarf lesen.

## Stack (verbindlich)
- Next.js (App Router) + TypeScript strict + React
- Supabase (Postgres, Auth, Storage, Row-Level Security), EU-Region
- Tailwind CSS + shadcn/ui (Theming über CSS-Variablen)
- Framer Motion
- Deploy: Vercel (Region fra1)

## Architektur-Regeln (immer beachten)
- Ordnertrennung strikt: `src/core/` = branchenagnostisch, `src/modules/handwerk/` = branchenspezifisch, `src/app/` = Routen. Branchenlogik gehört NIE in `core/`.
- „Projekt" ist ein generisches Objekt mit Typ; branchenspezifische Felder über Modul-Konfiguration + `metadata` (jsonb), nicht hartcodiert.
- Konkret vor generisch: kein spekulatives Framework für andere Branchen bauen.
- DB-Änderungen immer als versionierte SQL-Migrationsdateien im Repo (nicht nur im Studio klicken).

## Sicherheit (kritisch — YOU MUST)
- Multi-Tenancy: jede Tabelle mit Firmenbezug hat `company_id` UND eine RLS-Policy. Mandantentrennung NIE nur im App-Code.
- Mandantenzugriff in Policies über die `SECURITY DEFINER`-Funktion `current_company_id()`; KEINE rekursiven RLS-Policies (nicht `profiles` per Sub-Select gegen `profiles`).
- Trial-/Abo-Sperre: Schreib-Policies (INSERT/UPDATE/DELETE) auf Geschäftsdaten enthalten immer `company_is_writable()`; SELECT nicht. Nach Trial-Ablauf firmenweit Nur-Lese, auf DB-Ebene erzwungen.
- Rollen: `admin` (volle Verwaltung), `projektleiter` (Projekte/Team/Angebote), `mitarbeiter` (operativ). Schreiben auf Geschäftsdaten i. d. R. admin + projektleiter; Ausnahmen: Tagebuch-Einträge und eigene Zeiten darf auch `mitarbeiter` anlegen. Einladungen nur durch `admin`.
- Tagebuch beweissicher: append-only (keine UPDATE-/DELETE-Policies + Trigger) mit Hash-Kette pro Projekt; Fotos fließen in den Hash ein. Korrekturen sind neue, verknüpfte Einträge.
- Keine Secrets im Code/Repo; alles über Env-Variablen; `.env.local` gitignored. Anthropic-API-Aufrufe nur serverseitig.

## Geld & KI
- Geldbeträge immer als Ganzzahl in Cent, nie Float. Alle Arithmetik (Positionen, Summen, MwSt, netto/brutto) im Code, NIE durch die KI.
- KI schlägt vor / strukturiert; ein Mensch gibt frei (Mensch-im-Kreislauf bei Geld und verbindlichen Dokumenten). KI-Preise/-Positionen kommen aus dem Leistungskatalog, werden nicht geraten.
- Keine Selbst-Umschreibung des Produktivcodes durch Agenten.

## Daten-Konventionen
- Fortlaufende Nummern pro Firma (Kunden-, Projekt-, Angebotsnummer) über den atomaren, gekeyten Zähler mit Zeilensperre — nie `max()+1`.
- Zeiten: `timestamptz` speichern, Dauer aus absoluten Zeitpunkten rechnen (DST-sicher), keine stille Rundung.
- „Entfernen" von Stammdaten = archivieren/inaktiv setzen, kein Hard-Delete (wegen späterer Verknüpfungen).

## Etablierte DB-Helfer (wiederverwenden, nicht neu erfinden; Namen ggf. an die tatsächliche Umsetzung anpassen)
- `current_company_id()`, Rollen-Helfer (`current_role()` o. ä.) — SECURITY DEFINER, Firma/Rolle des Aufrufers.
- `company_is_writable()` — Trial-/Abo-Schreibsperre.
- Sichtbarkeits-Einstellungen: `companies.project_visibility` (`all`|`assigned`), `companies.schedule_visibility` (`own`|`team`) über zugehörige Helfer.
- Atomarer Nummern-Zähler (`company_id`, `counter_key`).
- `append_diary_entry()`, `verify_diary()` — Tagebuch-Hash-Kette.

## Arbeitsweise
- Immer im Scope des aktuellen Meilensteins bleiben; nicht vorgreifen.
- Bei Unklarheit oder destruktiven Aktionen: nachfragen statt annehmen.
- Kritische Pfade (Auth, Mandantentrennung, Geld, Tagebuch-Unveränderlichkeit, Zeit-/Summen-Berechnung) mit Tests absichern.
- Vor Commits müssen `npm run build`, `npm run lint` und `npm run typecheck` fehlerfrei durchlaufen.
- Code-Kommentare knapp auf Deutsch.
- Ziel-Viewports: Desktop & Tablet, responsive; Handy-Feinschliff später.

## Commands
- Dev-Server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm run test` (Vitest; RLS-Integrationstests in `tests/integration` erfordern `SUPABASE_SERVICE_ROLE_KEY` und werden sonst übersprungen)
