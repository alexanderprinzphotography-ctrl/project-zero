# Baustellen-Zentrale

Mandantenfähige SaaS-Webapp für Handwerks- und Baubetriebe. Ausführlicher Kontext in
[`docs/Projektkontext.md`](docs/Projektkontext.md), Fahrplan in
[`docs/Implementierungsplan_MVP.md`](docs/Implementierungsplan_MVP.md).

## Stack

- Next.js (App Router) + TypeScript strict + React
- Supabase (Postgres, Auth, Storage, Row-Level Security), EU-Region
- Tailwind CSS + shadcn/ui
- Framer Motion
- Deploy: Vercel (Region fra1)

## Lokal starten

```bash
npm install
npm run dev
```

Die App läuft anschließend unter [http://localhost:3000](http://localhost:3000).

## Umgebungsvariablen

1. `.env.local.example` nach `.env.local` kopieren.
2. Werte aus dem Supabase-Dashboard eintragen (Project Settings → API):

```bash
cp .env.local.example .env.local
```

| Variable | Beschreibung |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL des Supabase-Projekts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Öffentlicher Anon-Key des Supabase-Projekts |

`.env.local` ist gitignored und darf nie committet werden.

## Build

```bash
npm run build
```

## Ordnerstruktur

- `src/core/` — branchenagnostische Bausteine (Auth, Tenancy, CRM, generische Projektverwaltung, UI-Grundgerüst)
- `src/modules/handwerk/` — branchenspezifische Logik für Handwerks-/Baubetriebe
- `src/app/` — Next.js-Routen
