import Anthropic from "@anthropic-ai/sdk";

/**
 * KI-Angebotsentwurf: die KI waehlt NUR Katalog-Positionen (per exakter id)
 * und schaetzt Mengen - Preise/Summen kommen ausschliesslich aus dem Katalog
 * und werden im Code berechnet (siehe recalculate.ts/quote-math.ts), nie von
 * der KI. Tool-Use erzwingt strukturierte JSON-Ausgabe (robuster als
 * "antworte nur mit JSON" als Text-Anweisung) - Validierung gegen den echten
 * Firmen-Katalog passiert trotzdem separat im aufrufenden Server-Action
 * (Sicherheitsschicht gegen Halluzination), nicht hier.
 */

const MODEL = "claude-sonnet-5";

export type AiDraftRoom = {
  name: string;
  length: number;
  width: number;
  height: number;
  count: number;
  areaM2: number;
};

export type AiDraftCatalogItem = { id: string; name: string; unit: string };

export type AiDraftMatch = { catalog_item_id: string; menge: number; hinweis?: string };
export type AiDraftUnmatched = { beschreibung: string; hinweis?: string };

export type AiDraftResult = {
  matched: AiDraftMatch[];
  unmatched: AiDraftUnmatched[];
  introText: string | null;
  closingText: string | null;
};

const DRAFT_TOOL: Anthropic.Tool = {
  name: "submit_quote_draft",
  description:
    "Angebotsentwurf: ausgewaehlte Katalog-Positionen mit geschaetzter Menge sowie nicht zugeordnete Arbeiten.",
  input_schema: {
    type: "object",
    properties: {
      matched: {
        type: "array",
        description: "Katalog-Positionen, die zur Beschreibung passen.",
        items: {
          type: "object",
          properties: {
            catalog_item_id: {
              type: "string",
              description: "Exakte id aus dem uebergebenen Katalog - niemals erfinden.",
            },
            menge: { type: "number", description: "Geschaetzte Menge in der Einheit der Katalog-Position." },
            hinweis: { type: "string", description: "Kurze, nachvollziehbare Begruendung der Schaetzung." },
          },
          required: ["catalog_item_id", "menge"],
        },
      },
      unmatched: {
        type: "array",
        description: "Im Text genannte Arbeiten ohne passende Katalog-Position - NIE mit erfundener id versehen.",
        items: {
          type: "object",
          properties: {
            beschreibung: { type: "string" },
            hinweis: { type: "string" },
          },
          required: ["beschreibung"],
        },
      },
      intro_text: { type: "string", description: "Optionaler kurzer Anschreiben-Einleitungstext." },
      closing_text: { type: "string", description: "Optionaler kurzer Anschreiben-Schlusstext." },
    },
    required: ["matched", "unmatched"],
  },
};

const SYSTEM_PROMPT = `Du hilfst einem Handwerksbetrieb, aus einer Vor-Ort-Aufnahme einen Angebotsentwurf zu erstellen.

Regeln (unbedingt einhalten):
- Waehle AUSSCHLIESSLICH Positionen aus dem uebergebenen Leistungskatalog, referenziert ueber ihre exakte id. Erfinde NIEMALS eine id, die nicht in der Liste steht.
- Erfinde KEINE Preise - Preise kommen ausschliesslich aus dem Katalog im Code, du gibst nur Mengen an.
- Schaetze Mengen anhand der Beschreibung und ggf. angegebener Flaechen/Masse; sei konservativ und nachvollziehbar (kurzer Hinweis pro Position).
- Wenn eine im Text genannte Arbeit KEINE passende Katalog-Position hat, liste sie unter "unmatched" auf - erfinde dafuer NIE eine Position.
- Antworte ausschliesslich ueber das Tool submit_quote_draft.`;

function buildUserMessage(description: string, rooms: AiDraftRoom[], catalog: AiDraftCatalogItem[]): string {
  const roomsText =
    rooms.length > 0
      ? rooms
          .map(
            (r) =>
              `- ${r.name || "(ohne Namen)"}: ${r.length} m × ${r.width} m × ${r.height} m, Anzahl ${r.count}, Fläche je Raum ${r.areaM2} m²`,
          )
          .join("\n")
      : "Keine Räume/Maße angegeben.";

  const catalogText = catalog.map((c) => `- id=${c.id} | ${c.name} | Einheit: ${c.unit}`).join("\n");

  return [
    "Vor-Ort-Aufnahme (Freitext):",
    description,
    "",
    "Räume/Maße:",
    roomsText,
    "",
    "Leistungskatalog der Firma (NUR diese Positionen dürfen gewählt werden, ausschließlich per exakter id):",
    catalogText || "(Katalog ist leer)",
  ].join("\n");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export async function requestAiQuoteDraft(input: {
  description: string;
  rooms: AiDraftRoom[];
  catalog: AiDraftCatalogItem[];
}): Promise<AiDraftResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert.");
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input.description, input.rooms, input.catalog) }],
    tools: [DRAFT_TOOL],
    tool_choice: { type: "tool", name: "submit_quote_draft" },
  });

  const toolUseBlock = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUseBlock) {
    throw new Error("KI-Antwort enthielt keinen strukturierten Entwurf.");
  }

  const raw = asRecord(toolUseBlock.input) ?? {};

  const matched: AiDraftMatch[] = Array.isArray(raw.matched)
    ? raw.matched
        .map(asRecord)
        .filter((m): m is Record<string, unknown> => m !== null)
        .map((m) => ({
          catalog_item_id: String(m.catalog_item_id ?? "").trim(),
          menge: Number(m.menge),
          hinweis: typeof m.hinweis === "string" ? m.hinweis : undefined,
        }))
        .filter((m) => m.catalog_item_id && Number.isFinite(m.menge) && m.menge > 0)
    : [];

  const unmatched: AiDraftUnmatched[] = Array.isArray(raw.unmatched)
    ? raw.unmatched
        .map(asRecord)
        .filter((u): u is Record<string, unknown> => u !== null)
        .map((u) => ({
          beschreibung: String(u.beschreibung ?? "").trim(),
          hinweis: typeof u.hinweis === "string" ? u.hinweis : undefined,
        }))
        .filter((u) => u.beschreibung)
    : [];

  return {
    matched,
    unmatched,
    introText: typeof raw.intro_text === "string" && raw.intro_text.trim() ? raw.intro_text : null,
    closingText: typeof raw.closing_text === "string" && raw.closing_text.trim() ? raw.closing_text : null,
  };
}
