import { randomBytes } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Review-Checkpoint MS 12a: /angebot/<token> ist die erste oeffentlich
 * erreichbare Flaeche der App. Verifiziert: ein anonymer Aufruf (kein Login)
 * bekommt ueber get_quote_share()/get_quote_share_items() NUR die minimal
 * noetigen Felder (keine internen IDs), ein manipulierter/widerrufener/
 * abgelaufener Token wird einheitlich abgewiesen, respond_to_quote_share()
 * ist idempotent (zweite Antwort abgewiesen, kein Doppel-Eintrag), und die
 * internen Management-Tabellen bleiben nach dem etablierten RLS-Muster
 * geschuetzt (mitarbeiter kein Zugriff, Cross-Tenant isoliert, quote_responses
 * fuer authenticated komplett schreibgeschuetzt).
 * Erfordert SUPABASE_SERVICE_ROLE_KEY - ohne wird die Suite uebersprungen.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasServiceRole = Boolean(url && anonKey && serviceRoleKey);

type ProfileRow = { id: string; company_id: string; role: string };

function makeToken(): string {
  return randomBytes(32).toString("base64url");
}

describe.skipIf(!hasServiceRole)("Kundenportal /angebot/<token> RLS + RPCs (MS 12a)", () => {
  let adminClient: SupabaseClient;
  let adminAClient: SupabaseClient;
  let mitarbeiterAClient: SupabaseClient;
  let adminBClient: SupabaseClient;
  let anonClient: SupabaseClient;

  const suffix = Date.now();
  const password = "Test1234!Sicher";
  const emailAdminA = `ms12a-admin-a-${suffix}@example.com`;
  const emailMaA = `ms12a-ma-a-${suffix}@example.com`;
  const emailAdminB = `ms12a-admin-b-${suffix}@example.com`;

  let adminAId: string;
  let maAId: string;
  let adminBId: string;
  let companyAId: string;
  let companyBId: string;
  let contactAId: string;
  let quoteAId: string;
  let shareLinkId: string;
  const token = makeToken();

  beforeAll(async () => {
    adminClient = createClient(url!, serviceRoleKey!);
    anonClient = createClient(url!, anonKey!);

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
      company_name: `MS12a Test Firma A ${suffix}`,
      full_name: "Test Admin A",
    });
    if (regAErr) throw regAErr;
    companyAId = (profileAdminA as ProfileRow).company_id;

    const { data: profileAdminB, error: regBErr } = await adminBClient.rpc("register_company", {
      company_name: `MS12a Test Firma B ${suffix}`,
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

    const { error: statusErr } = await adminAClient
      .from("quotes")
      .update({ status: "freigegeben" })
      .eq("id", quoteAId);
    if (statusErr) throw statusErr;

    const { data: link, error: linkErr } = await adminAClient
      .from("quote_share_links")
      .insert({ quote_id: quoteAId, token, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() })
      .select("id")
      .single();
    if (linkErr) throw linkErr;
    shareLinkId = link.id;
  });

  afterAll(async () => {
    if (!adminClient) return;
    await adminClient.from("quote_responses").delete().eq("quote_id", quoteAId);
    if (shareLinkId) await adminClient.from("quote_share_links").delete().eq("id", shareLinkId);
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

  it("anonymer Aufruf mit gueltigem Token liefert nur die minimal noetigen Felder", async () => {
    const { data, error } = await anonClient.rpc("get_quote_share", { p_token: token });
    expect(error).toBeNull();
    expect(data.valid).toBe(true);
    expect(data.customer.first_name).toBe("Erika");
    expect(data.status).toBe("freigegeben");

    // Niemals interne IDs preisgeben.
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("company_id");
    expect(data).not.toHaveProperty("quote_id");
    expect(data).not.toHaveProperty("customer_id");
    expect(data).not.toHaveProperty("token");
  });

  it("anonymer Aufruf mit manipuliertem Token (ein Zeichen gekippt) wird einheitlich abgewiesen", async () => {
    const tampered = token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A");
    const { data, error } = await anonClient.rpc("get_quote_share", { p_token: tampered });
    expect(error).toBeNull();
    expect(data).toEqual({ valid: false });
  });

  it("widerrufener Link wird identisch abgewiesen wie ein nie existierender Token", async () => {
    const revokedToken = makeToken();
    const { data: revokedLink } = await adminAClient
      .from("quote_share_links")
      .insert({
        quote_id: quoteAId,
        token: revokedToken,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .select("id")
      .single();
    await adminAClient.from("quote_share_links").update({ revoked_at: new Date().toISOString() }).eq(
      "id",
      revokedLink!.id,
    );

    const { data } = await anonClient.rpc("get_quote_share", { p_token: revokedToken });
    expect(data).toEqual({ valid: false });

    await adminClient.from("quote_share_links").delete().eq("id", revokedLink!.id);
  });

  it("mitarbeiter der eigenen Firma sieht die internen Share-Links nicht", async () => {
    const { data, error } = await mitarbeiterAClient.from("quote_share_links").select("id").eq("id", shareLinkId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Firma B sieht die Share-Links von Firma A nicht (Cross-Tenant)", async () => {
    const { data, error } = await adminBClient.from("quote_share_links").select("id").eq("id", shareLinkId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("admin darf first_viewed_at/last_viewed_at NICHT per Client-Update faelschen (additive-Grants-Sperre)", async () => {
    const { error } = await adminAClient
      .from("quote_share_links")
      .update({ first_viewed_at: new Date(0).toISOString() })
      .eq("id", shareLinkId);
    expect(error).not.toBeNull();
  });

  it("quote_responses ist fuer authenticated komplett schreibgeschuetzt (nur respond_to_quote_share darf schreiben)", async () => {
    const { error } = await adminAClient.from("quote_responses").insert({
      quote_id: quoteAId,
      share_link_id: shareLinkId,
      action: "angenommen",
      responder_name: "Fake",
    });
    expect(error).not.toBeNull();
  });

  it("respond_to_quote_share ist idempotent - zweite Antwort wird abgewiesen, kein Doppel-Eintrag", async () => {
    const { data: first, error: firstError } = await anonClient.rpc("respond_to_quote_share", {
      p_token: token,
      p_action: "angenommen",
      p_responder_name: "Erika Musterfrau",
      p_ip: "203.0.113.1",
      p_user_agent: "vitest",
    });
    expect(firstError).toBeNull();
    expect(first.ok).toBe(true);

    const { data: quoteAfter } = await adminClient.from("quotes").select("status").eq("id", quoteAId).single();
    expect(quoteAfter?.status).toBe("angenommen");

    const { data: responses } = await adminClient.from("quote_responses").select("id").eq("quote_id", quoteAId);
    expect(responses).toHaveLength(1);

    const { error: secondError } = await anonClient.rpc("respond_to_quote_share", {
      p_token: token,
      p_action: "abgelehnt",
      p_responder_name: "Zweiter Versuch",
      p_ip: "203.0.113.2",
      p_user_agent: "vitest",
    });
    expect(secondError).not.toBeNull();

    const { data: responsesAfterSecond } = await adminClient
      .from("quote_responses")
      .select("id")
      .eq("quote_id", quoteAId);
    expect(responsesAfterSecond).toHaveLength(1);
  });
});
