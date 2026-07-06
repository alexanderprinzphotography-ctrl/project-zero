# modules/handwerk

Branchenspezifische Logik für Handwerks- und Baubetriebe.

Hier landen alle Anpassungen, die nur für diese Branche gelten: spezifische Projekt-/Baustellen-Felder,
Konfiguration der generischen `Projekt`-Objekte aus `core/`, branchentypische Ansichten und Workflows.

**Regel:** Dieses Modul konfiguriert und erweitert `core/`, ersetzt es aber nie. Andere Branchen
bekommen später eigene Module unter `src/modules/<branche>/`, ohne `core/` anzufassen.
