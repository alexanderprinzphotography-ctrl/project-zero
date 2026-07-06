# CLAUDE.md — Baustellen-Zentrale

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
- „Projekt" ist ein generisches Objekt mit Typ; branchenspezifische Felder über Konfiguration, nicht hartcodiert.
- Konkret vor generisch: kein spekulatives Framework für andere Branchen bauen.

## Sicherheit (kritisch — YOU MUST)
- Multi-Tenancy: Jede Tabelle mit Firmenbezug bekommt eine `company_id` UND eine Row-Level-Security-Policy. Mandantentrennung NIE nur im App-Code.
- Keine Secrets im Code oder Repo. Alles über Env-Variablen; `.env.local` ist gitignored.
- Tagebuch-Einträge sind append-only (unveränderlich) — auf DB-Ebene erzwingen.
- Bei Geldbeträgen und rechtsverbindlichen Dokumenten immer Mensch-im-Kreislauf; KI-Ausgabe nie ungeprüft verbindlich machen.

## Arbeitsweise
- Immer im Scope des aktuellen Meilensteins bleiben. NICHT vorausschauend Features aus späteren Schritten bauen.
- Bei Unklarheit oder destruktiven Aktionen: nachfragen statt annehmen.
- Kritische Pfade (Auth, Mandantentrennung, Geldbeträge, Tagebuch) mit Tests absichern.
- Vor Commits müssen `npm run build` und Lint fehlerfrei durchlaufen.
- Code-Kommentare knapp auf Deutsch.

## Commands
- Dev-Server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`   (Script erst ergänzen – siehe unten)
- Tests: `npm run test` (Vitest; RLS-Integrationstests in `tests/integration` erfordern `SUPABASE_SERVICE_ROLE_KEY` und werden sonst übersprungen)
