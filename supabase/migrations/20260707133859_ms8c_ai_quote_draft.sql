-- MS 8c: KI-Angebotsentwurf
-- Reine Nachvollziehbarkeits-/Kennzeichnungs-Spalten - keine neue RLS noetig,
-- die bestehenden Policies auf quotes/quote_items (MS 8b) decken sie ab.
-- Preise/Summen werden weiterhin ausschliesslich im Code berechnet (siehe
-- core/money/quote-math.ts); die KI liefert nur Katalog-Auswahl + Mengen.

alter table public.quotes
  add column is_ai_generated boolean not null default false,
  add column intake_description text,
  add column intake_rooms jsonb,
  add column unmatched_items jsonb;

alter table public.quote_items
  add column is_ai_suggested boolean not null default false,
  add column ai_note text;
