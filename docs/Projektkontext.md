# Projektkontext — KI-gestützte Betriebsplattform für Handwerk & Bau

> Arbeitstitel: _(noch offen)_ · Lebendes Dokument — wird im Projektverlauf fortgeschrieben.

## 1. Vision

Eine modulare, KI-gestützte Webapp, die mittelständischen Betrieben so viele Aufgaben abnimmt, dass sie kaum noch externe Tools oder Dienstleister brauchen. Positionierung im Verkauf: **„das einzige Programm, das du noch brauchst."** Langfristig deckt sie Marketing, Vertrieb, Automatisierung und das operative Tagesgeschäft an einem Ort ab. Der Weg dorthin ist bewusst schrittweise: ein exzellenter Kern zuerst, weitere Bereiche als andockende Module.

## 2. Startnische (MVP-Fokus)

Handwerks- und Baubetriebe. Begründung: größter Schmerzpunkt (Tool- und Zettelchaos, WhatsApp-Koordination), dünne KI-native Konkurrenz, und die Anforderung „beweissichere Dokumentation" passt direkt aufs technische Fundament. Kern-Nutzenversprechen des MVP: eine **Baustellen-Zentrale**, mit der ein Betrieb ab Tag 1 seine Projekte führt.

## 3. Architekturprinzipien (verbindlich)

- **Modular:** branchenagnostischer Core + austauschbare Branchenmodule + zubuchbare Premium-Module. Freischaltung nach Kauf über Abo/Entitlement.
- **Generisches „Projekt" mit Typ:** Ein Projekt ist im Datenmodell ein generisches Objekt; das Branchenmodul bestimmt Felder, Tabs und Workflows (Baustelle = Projekt-Typ des Handwerk-Moduls). Für neue Branchen (z. B. Makler) wird nur das Modul getauscht, nicht die App umgebaut.
- **Konkret vor generisch:** Das Handwerk-Modul konkret bauen, die Nähte aber sauber halten (Feature-Flags, konfigurierbare Felder statt hartcodiertem „Baustelle"). Den generischen Core erst extrahieren, wenn zahlende Kunden da sind. **Keine verfrühte Abstraktion.**
- **Mandantenfähig (Multi-Tenant) ab der ersten Zeile:** strikte Datentrennung pro Firma, erzwungen auf Datenbank-Ebene (Supabase Row-Level Security), nicht nur im App-Code.
- **Web-first (Desktop & Tablet):** Priorität hat die vollwertige Webapp. Auf der Baustelle wird primär per Tablet gearbeitet, das dieselben Features komfortabel nutzen kann. Von Anfang an sauber responsive, damit die Tablet-Nutzung gut funktioniert. Handy-Feinschliff sowie PWA/Offline-Sync folgen in einer späteren Phase.

## 4. Tech-Stack

- **Frontend/Backend:** Next.js (App Router) + TypeScript + React
- **Plattform-Backend:** Supabase — Postgres, Auth, Datei-Storage (Baustellen-Fotos), Row-Level Security; EU-Region
- **UI:** Tailwind CSS + shadcn/ui (Theming über CSS-Variablen → Corporate-Design-Anpassung)
- **Animationen:** Framer Motion (Zustands-/Prozess-Feedback)
- **Hosting:** Vercel (EU-Region)
- **KI:** Anthropic Claude API
- **Abrechnung/Module:** Stripe (Subscriptions + Entitlements) — ab Modul-Phase
- **Rechnung/E-Rechnung:** Fach-API andocken (lexoffice / sevDesk) statt selbst bauen — GoBD-zertifiziert, mit DATEV-Export

## 5. Scope

### Im MVP enthalten
- Fundament: Multi-Tenant, Login für Admin & Mitarbeiter mit Rollen, Corporate-Design-Theming
- Schlankes eigenes CRM: Kunden / Kontakte (jedes Projekt hängt an einem Kunden)
- Projekte / Baustellen: anlegen, Infos hinterlegen, Mitarbeiter zuweisen
- Baustellen-Tagebuch: Foto-Upload + unveränderliches Zeitstempel-Log (beweissicher; zugleich Audit-Log)
- Projektbezogene Zeiterfassung
- Einfache Einsatzplanung: wer ist wann wo, Doppelbelegungen werden sichtbar
- Ein sichtbares KI-Feature: Angebot aus Projekt-/Vor-Ort-Daten generieren (Mensch bestätigt)

### Roadmap (nach MVP; im Verkauf schon als „kommt"-Module sichtbar)
- **Phase 2:** Rechnungen / E-Rechnung / DATEV (via lexoffice/sevDesk), Materialbedarfs-Rechner, Kundenportal
- **Phase 3:** KI-Marketing & Anzeigen-Analyse/-Optimierung (Premium), natürlichsprachiger Automations-Builder, CRM-Integrationen (HubSpot/Pipedrive)
- **Geprüft/offen:** Leadscraper — rechtlich heikel (DSGVO/UWG); nur mit sauberem Rechtskonzept

## 6. Compliance & Rahmenbedingungen (verbindlich)

- **DSGVO:** EU-Hosting (Supabase & Vercel EU-Region), AV-Verträge, Löschkonzept, dokumentierte KI-Datenverarbeitung.
- **GoBD / E-Rechnung:** nicht selbst zertifizieren — Fach-API andocken.
- **Beweissichere Doku:** Tagebuch-Einträge append-only (unveränderlich, mit Zeitstempel & Nutzer); Audit-Log über kritische Änderungen.
- **Kein Leadscraping im MVP.**

## 7. KI-Prinzipien

- **Reifegrad-Modell:** Start bei Stufe 1 (Assistent — Mensch löst aus & bestätigt). Architektur so anlegen, dass Stufe 2 (mehrschrittige Agenten mit Freigabe-Checkpoints) später möglich ist.
- **Mensch-im-Kreislauf** überall dort, wo Geld oder rechtsverbindliche Dokumente im Spiel sind.
- **Keine Selbst-Umschreibung** des Produktivcodes durch Agenten. KI arbeitet *in* der App, nicht *an* der App.

## 8. Zusammenarbeit mit Claude Code (Leitplanken)

- TypeScript strict; klare Modulgrenzen (Core / Branchenmodul / Premium).
- Für jede neue Tabelle mit Firmenbezug eine RLS-Policy — Mandantentrennung nie nur im App-Code.
- Kritische Pfade (Auth, Mandantentrennung, Geldbeträge, Tagebuch-Unveränderlichkeit) mit Tests absichern **und** manuell reviewen. Der Projektinhaber ist Fachinformatiker AE und prüft diese Teile bewusst.
- Inkrementell arbeiten: pro Schritt ein abgegrenztes, testbares Feature.
