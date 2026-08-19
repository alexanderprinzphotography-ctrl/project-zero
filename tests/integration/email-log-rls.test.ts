import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * MS 12b: email_log ist ein reines Versand-Protokoll. admin+projektleiter der
 * eigenen Firma duerfen lesen und (als vertrauenswuerdiger interner Akteur)
 * schreiben, mitarbeiter hat keinen Zugriff, Cross-Tenant ist isoliert, und
 * das Protokoll ist nach dem Schreiben unveraenderlich (kein UPDATE/DELETE).
 * Erfordert SUPABASE_SERVICE_ROLE_KEY - ohne wird die Suite uebersprungen.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasServiceRole = Boolean(url && anonKey && serviceRoleKey);

type ProfileRow = { id: string; company_id: string; role: string };

describe.skipIf(!hasServiceRole)("email_log RLS (MS 12b)", () => {
  let adminClient: SupabaseClient;
  let adminAClient: SupabaseClient;
  let mitarbeiterAClient: SupabaseClient;
  let adminBClient: SupabaseClient;

  const suffix = Date.now();
  const password = "Test1234!Sicher";
  const emailAdminA = `ms12b-admin-a-${suffix}@example.com`;
  const emailMaA = `ms12b-ma-a-${suffix}@example.com`;
  const emailAdminB = `ms12b-admin-b-${suffix}@example.com`;

  let adminAId: string;
  let maAId: string;
  let adminBId: string;
  let companyAId: string;
  let companyBId: string;
  let contactAId: string;
  let quoteAId: string;
  let logId: string;

  beforeAll(async () => {
    adminClient = createClient(url!, serviceRoleKey!);

    const users = await Promise.all(
      [emailAdminA, emailMaA, emailAdminB].map((email) =>
        adminClient.auth.admin.createUser({ email, password, email_confirm: true }),
      ),
    );
    for (const { error } of users) if (error) throw error;
    [adminAId, maAId, adminBId] = users.map((u) => u.data.user!.id);

    adminAClient = createClient(url!, anonKey!);
    mitarbeiterAClient = createClient(url!, anonKey!);
    adminBClient = createClient(url!, anonKey!);

    await adminAClient.auth.signInWithPassword({ email: emailAdminA, password });
    await mitarbeiterAClient.auth.signInWithPassword({ email: emailMaA, password });
    await adminBClient.auth.signInWithPassword({ email: emailAdminB, password });

    const { data: profileAdminA, error: regAErr } = await adminAClient.rpc("register_company", {
      company_name: `MS12b Test Firma A ${suffix}`,
      full_name: "Test Admin A",
    });
    if (regAErr) throw regAErr;
    companyAId = (profileAdminA as ProfileRow).company_id;

    const { data: profileAdminB, error: regBErr } = await adminBClient.rpc("register_company", {
      company_name: `MS12b Test Firma B ${suffix}`,
      full_name: "Test Admin B",
    });
    if (regBErr) throw regBErr;
    companyBId = (profileAdminB as ProfileRow).company_id;

    const { error: maProfileErr } = await adminClient
      .from("profiles")
      .insert({ id: maAId, company_id: companyAId, role: "mitarbeiter", full_name: "Test MA A", email: emailMaA });
    if (maProfileErr) throw maProfileErr;

    const { data: contact, error: contactErr } = await adminAClient
      .from("contacts")
      .insert({ type: "privat", first_name: "Erika", last_name: "Musterfrau" })
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

    const { data: log, error: logErr } = await adminAClient
      .from("email_log")
      .insert({
        quote_id: quoteAId,
        to_email: "erika@example.com",
        subject: "Ihr Angebot",
        status: "gesendet",
        provider_message_id: "<test@relay.brevo.com>",
      })
      .select("id")
      .single();
    if (logErr) throw logErr;
    logId = log.id;
  });

  afterAll(async () => {
    if (!adminClient) return;
    if (logId) await adminClient.from("email_log").delete().eq("id", logId);
    if (quoteAId) await adminClient.from("quotes").delete().eq("id", quoteAId);
    if (contactAId) await adminClient.from("contacts").delete().eq("id", contactAId);
    await adminClient.auth.admin.deleteUser(adminAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(maAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(adminBId).catch(() => {});
    if (companyAId) await adminClient.from("company_counters").delete().eq("company_id", companyAId);
    if (companyBId) await adminClient.from("company_counters").delete().eq("company_id", companyBId);
    if (companyAId) await adminClient.from("companies").delete().eq("id", companyAId);
    if (companyBId) await adminClient.from("companies").delete().eq("id", companyBId);
  });

  it("admin der eigenen Firma sieht den Protokolleintrag", async () => {
    const { data, error } = await adminAClient.from("email_log").select("to_email, status").eq("id", logId).maybeSingle();
    expect(error).toBeNull();
    expect(data?.to_email).toBe("erika@example.com");
    expect(data?.status).toBe("gesendet");
  });

  it("mitarbeiter der eigenen Firma sieht das Mail-Protokoll nicht", async () => {
    const { data, error } = await mitarbeiterAClient.from("email_log").select("id").eq("id", logId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Firma B sieht das Mail-Protokoll von Firma A nicht (Cross-Tenant)", async () => {
    const { data, error } = await adminBClient.from("email_log").select("id").eq("id", logId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("mitarbeiter kann keinen Protokolleintrag anlegen (kein Versand möglich)", async () => {
    const { error } = await mitarbeiterAClient.from("email_log").insert({
      quote_id: quoteAId,
      to_email: "fake@example.com",
      subject: "Fake",
      status: "gesendet",
    });
    expect(error).not.toBeNull();
  });

  it("das Protokoll ist unveränderlich - kein Update möglich", async () => {
    const { error } = await adminAClient.from("email_log").update({ status: "fehler" }).eq("id", logId);
    expect(error).not.toBeNull();

    const { data } = await adminClient.from("email_log").select("status").eq("id", logId).single();
    expect(data?.status).toBe("gesendet");
  });

  it("das Protokoll lässt sich per Client nicht löschen", async () => {
    await adminAClient.from("email_log").delete().eq("id", logId);
    const { data } = await adminClient.from("email_log").select("id").eq("id", logId).maybeSingle();
    expect(data?.id).toBe(logId);
  });
});
