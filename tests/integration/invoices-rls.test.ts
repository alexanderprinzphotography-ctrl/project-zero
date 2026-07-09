import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Review-Checkpoint MS 11b: invoices ist ein reiner Referenz-/Statusspiegel.
 * admin+projektleiter der eigenen Firma duerfen lesen, mitarbeiter nicht,
 * Cross-Tenant ist isoliert, und nach dem Anlegen sind Betrag/Rechnungsnummer
 * fuer den Client unveraenderlich - nur status/last_synced_at/due_date duerfen
 * per Update beruehrt werden (additive-Grants-Sperre wie MS 9a/11a).
 * Erfordert SUPABASE_SERVICE_ROLE_KEY - ohne wird die Suite uebersprungen.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasServiceRole = Boolean(url && anonKey && serviceRoleKey);

type ProfileRow = { id: string; company_id: string; role: string };

describe.skipIf(!hasServiceRole)("invoices RLS + Grants (MS 11b)", () => {
  let adminClient: SupabaseClient;
  let adminAClient: SupabaseClient;
  let projektleiterAClient: SupabaseClient;
  let mitarbeiterAClient: SupabaseClient;
  let adminBClient: SupabaseClient;

  const suffix = Date.now();
  const password = "Test1234!Sicher";
  const emailAdminA = `ms11b-admin-a-${suffix}@example.com`;
  const emailPlA = `ms11b-pl-a-${suffix}@example.com`;
  const emailMaA = `ms11b-ma-a-${suffix}@example.com`;
  const emailAdminB = `ms11b-admin-b-${suffix}@example.com`;

  let adminAId: string;
  let plAId: string;
  let maAId: string;
  let adminBId: string;
  let companyAId: string;
  let companyBId: string;
  let contactAId: string;
  let quoteAId: string;
  let invoiceId: string;

  beforeAll(async () => {
    adminClient = createClient(url!, serviceRoleKey!);

    const users = await Promise.all(
      [emailAdminA, emailPlA, emailMaA, emailAdminB].map((email) =>
        adminClient.auth.admin.createUser({ email, password, email_confirm: true }),
      ),
    );
    for (const { error } of users) if (error) throw error;
    [adminAId, plAId, maAId, adminBId] = users.map((u) => u.data.user!.id);

    adminAClient = createClient(url!, anonKey!);
    projektleiterAClient = createClient(url!, anonKey!);
    mitarbeiterAClient = createClient(url!, anonKey!);
    adminBClient = createClient(url!, anonKey!);

    await adminAClient.auth.signInWithPassword({ email: emailAdminA, password });
    await projektleiterAClient.auth.signInWithPassword({ email: emailPlA, password });
    await mitarbeiterAClient.auth.signInWithPassword({ email: emailMaA, password });
    await adminBClient.auth.signInWithPassword({ email: emailAdminB, password });

    const { data: profileAdminA, error: regAErr } = await adminAClient.rpc("register_company", {
      company_name: `MS11b Test Firma A ${suffix}`,
      full_name: "Test Admin A",
    });
    if (regAErr) throw regAErr;
    companyAId = (profileAdminA as ProfileRow).company_id;

    const { data: profileAdminB, error: regBErr } = await adminBClient.rpc("register_company", {
      company_name: `MS11b Test Firma B ${suffix}`,
      full_name: "Test Admin B",
    });
    if (regBErr) throw regBErr;
    companyBId = (profileAdminB as ProfileRow).company_id;

    const { error: plProfileErr } = await adminClient
      .from("profiles")
      .insert({ id: plAId, company_id: companyAId, role: "projektleiter", full_name: "Test PL A", email: emailPlA });
    if (plProfileErr) throw plProfileErr;

    const { error: maProfileErr } = await adminClient
      .from("profiles")
      .insert({ id: maAId, company_id: companyAId, role: "mitarbeiter", full_name: "Test MA A", email: emailMaA });
    if (maProfileErr) throw maProfileErr;

    const { data: contact, error: contactErr } = await adminAClient
      .from("contacts")
      .insert({ type: "privat", first_name: "Max", last_name: "Mustermann" })
      .select("id")
      .single();
    if (contactErr) throw contactErr;
    contactAId = contact.id;

    const { data: quote, error: quoteErr } = await adminAClient
      .from("quotes")
      .insert({ customer_id: contactAId })
      .select("id")
      .single();
    if (quoteErr) throw quoteErr;
    quoteAId = quote.id;

    const { data: invoice, error: invoiceErr } = await adminAClient
      .from("invoices")
      .insert({
        quote_id: quoteAId,
        contact_id: contactAId,
        provider: "sevdesk",
        provider_invoice_id: "ext-1",
        provider_invoice_number: "RE-1001",
        status: "offen",
        gross_total_cents: 11900,
        net_total_cents: 10000,
        invoice_date: "2026-07-09",
      })
      .select("id")
      .single();
    if (invoiceErr) throw invoiceErr;
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    if (!adminClient) return;
    if (invoiceId) await adminClient.from("invoices").delete().eq("id", invoiceId);
    if (quoteAId) await adminClient.from("quotes").delete().eq("id", quoteAId);
    if (contactAId) await adminClient.from("contacts").delete().eq("id", contactAId);
    await adminClient.auth.admin.deleteUser(adminAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(plAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(maAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(adminBId).catch(() => {});
    if (companyAId) await adminClient.from("company_counters").delete().eq("company_id", companyAId);
    if (companyBId) await adminClient.from("company_counters").delete().eq("company_id", companyBId);
    if (companyAId) await adminClient.from("companies").delete().eq("id", companyAId);
    if (companyBId) await adminClient.from("companies").delete().eq("id", companyBId);
  });

  it("admin der eigenen Firma sieht die Rechnung", async () => {
    const { data, error } = await adminAClient
      .from("invoices")
      .select("provider_invoice_number, status")
      .eq("id", invoiceId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.provider_invoice_number).toBe("RE-1001");
  });

  it("projektleiter der eigenen Firma sieht die Rechnung ebenfalls", async () => {
    const { data, error } = await projektleiterAClient
      .from("invoices")
      .select("provider_invoice_number")
      .eq("id", invoiceId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.provider_invoice_number).toBe("RE-1001");
  });

  it("mitarbeiter der eigenen Firma sieht keine Rechnungen", async () => {
    const { data, error } = await mitarbeiterAClient.from("invoices").select("id").eq("id", invoiceId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Firma B sieht die Rechnung von Firma A nicht (Cross-Tenant)", async () => {
    const { data, error } = await adminBClient.from("invoices").select("id").eq("id", invoiceId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("admin darf den Status aktualisieren (erlaubte Spalte)", async () => {
    const { error } = await adminAClient
      .from("invoices")
      .update({ status: "bezahlt", last_synced_at: new Date().toISOString() })
      .eq("id", invoiceId);
    expect(error).toBeNull();

    const { data } = await adminClient.from("invoices").select("status").eq("id", invoiceId).single();
    expect(data?.status).toBe("bezahlt");
  });

  it("admin darf gross_total_cents NICHT per Client-Update aendern (additive-Grants-Sperre)", async () => {
    const { error } = await adminAClient.from("invoices").update({ gross_total_cents: 1 }).eq("id", invoiceId);
    expect(error).not.toBeNull();

    const { data } = await adminClient.from("invoices").select("gross_total_cents").eq("id", invoiceId).single();
    expect(data?.gross_total_cents).toBe(11900);
  });

  it("admin darf provider_invoice_number NICHT per Client-Update aendern", async () => {
    const { error } = await adminAClient
      .from("invoices")
      .update({ provider_invoice_number: "FAKE-1" })
      .eq("id", invoiceId);
    expect(error).not.toBeNull();

    const { data } = await adminClient
      .from("invoices")
      .select("provider_invoice_number")
      .eq("id", invoiceId)
      .single();
    expect(data?.provider_invoice_number).toBe("RE-1001");
  });

  it("keine DELETE-Policy - die Rechnung laesst sich per Client nicht loeschen", async () => {
    await adminAClient.from("invoices").delete().eq("id", invoiceId);

    const { data } = await adminClient.from("invoices").select("id").eq("id", invoiceId).maybeSingle();
    expect(data?.id).toBe(invoiceId);
  });
});
