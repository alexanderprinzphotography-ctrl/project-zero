-- MS 11b Korrektur: die UPDATE-RLS-Policy auf invoices fehlte.
--
-- Die vorherige Migration hat den Tabellen-Grant entzogen und gezielt nur
-- status/last_synced_at/due_date neu vergeben (additive-Grants-Muster aus
-- MS 9a/11a) - aber Spalten-Grants und RLS-Policies sind zwei GETRENNTE
-- Schichten. Ohne eigene UPDATE-Policy gilt bei aktiviertem RLS Default-Deny
-- fuer UPDATE, unabhaengig vom Spalten-Grant: kein Update war moeglich, auch
-- nicht auf den erlaubten Spalten (verifiziert: admin konnte status trotz
-- korrektem Grant nicht aendern - Update lief ohne Fehler, aber 0 Zeilen
-- betroffen).
--
-- Bewusst OHNE company_is_writable(): der Status-Sync spiegelt nur, was
-- sevdesk bereits weiss (kein neues Geschaeftsdatum), und soll wie bei
-- company_integrations.status auch im Nur-Lese-Zustand (abgelaufener Trial)
-- moeglich bleiben. Der eigentliche Schutz kommt weiterhin vom Spalten-Grant:
-- Betrag und Rechnungsnummer bleiben so oder so unantastbar.

create policy "invoices_update" on public.invoices
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() in ('admin', 'projektleiter')
  );
