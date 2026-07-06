# core

Branchenagnostische Bausteine der Baustellen-Zentrale.

Alles, was unabhängig von der Handwerksbranche funktioniert, gehört hierher:
Auth, Mandantentrennung (Tenancy), CRM, generische Projektverwaltung, gemeinsame UI-Komponenten.

**Regel:** Branchenspezifische Logik (z. B. Handwerk-Felder) gehört NIE in dieses Verzeichnis —
sie lebt in `src/modules/<branche>/`. `core/` darf `modules/` nicht importieren.
