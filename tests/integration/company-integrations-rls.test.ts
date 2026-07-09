import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Review-Checkpoint MS 11a: company_integrations darf den API-Key nie an
 * einen Client-Select ausliefern, nur admin der eigenen Firma darf lesen/
 * schreiben, projektleiter/mitarbeiter haben keinen Zugriff, Cross-Tenant ist
 * isoliert. Erfordert SUPABASE_SERVICE_ROLE_KEY - ohne wird die Suite
 * uebersprungen (siehe rls-tenant-isolation.test.ts fuer dasselbe Muster).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasServiceRole = Boolean(url && anonKey && serviceRoleKey);

type ProfileRow = { id: string; company_id: string; role: string };

describe.skipIf(!hasServiceRole)("company_integrations RLS + Grants (MS 11a)", () => {
  let adminClient: SupabaseClient;
  let adminAClient: SupabaseClient;
  let projektleiterAClient: SupabaseClient;
  let adminBClient: SupabaseClient;

  const suffix = Date.now();
  const password = "Test1234!Sicher";
  const emailAdminA = `ms11a-admin-a-${suffix}@example.com`;
  const emailPlA = `ms11a-pl-a-${suffix}@example.com`;
  const emailAdminB = `ms11a-admin-b-${suffix}@example.com`;

  let adminAId: string;
  let plAId: string;
  let adminBId: string;
  let companyAId: string;
  let companyBId: string;

  beforeAll(async () => {
    adminClient = createClient(url!, serviceRoleKey!);

    const { data: createdAdminA, error: errAdminA } = await adminClient.auth.admin.createUser({
      email: emailAdminA,
      password,
      email_confirm: true,
    });
    if (errAdminA || !createdAdminA.user) throw errAdminA ?? new Error("admin A konnte nicht angelegt werden");
    adminAId = createdAdminA.user.id;

    const { data: createdPlA, error: errPlA } = await adminClient.auth.admin.createUser({
      email: emailPlA,
      password,
      email_confirm: true,
    });
    if (errPlA || !createdPlA.user) throw errPlA ?? new Error("projektleiter A konnte nicht angelegt werden");
    plAId = createdPlA.user.id;

    const { data: createdAdminB, error: errAdminB } = await adminClient.auth.admin.createUser({
      email: emailAdminB,
      password,
      email_confirm: true,
    });
    if (errAdminB || !createdAdminB.user) throw errAdminB ?? new Error("admin B konnte nicht angelegt werden");
    adminBId = createdAdminB.user.id;

    adminAClient = createClient(url!, anonKey!);
    projektleiterAClient = createClient(url!, anonKey!);
    adminBClient = createClient(url!, anonKey!);

    await adminAClient.auth.signInWithPassword({ email: emailAdminA, password });
    await projektleiterAClient.auth.signInWithPassword({ email: emailPlA, password });
    await adminBClient.auth.signInWithPassword({ email: emailAdminB, password });

    const { data: profileAdminA, error: regAdminAErr } = await adminAClient.rpc("register_company", {
      company_name: `MS11a Test Firma A ${suffix}`,
      full_name: "Test Admin A",
    });
    if (regAdminAErr) throw regAdminAErr;
    companyAId = (profileAdminA as ProfileRow).company_id;

    const { data: profileAdminB, error: regAdminBErr } = await adminBClient.rpc("register_company", {
      company_name: `MS11a Test Firma B ${suffix}`,
      full_name: "Test Admin B",
    });
    if (regAdminBErr) throw regAdminBErr;
    companyBId = (profileAdminB as ProfileRow).company_id;

    // projektleiter direkt per service-role derselben Firma A zuordnen (kein
    // Einladungs-Flow noetig - der Trigger schuetzt nur Client-Updates, nicht
    // den service_role-Pfad).
    const { error: plProfileErr } = await adminClient
      .from("profiles")
      .insert({ id: plAId, company_id: companyAId, role: "projektleiter", full_name: "Test PL A", email: emailPlA });
    if (plProfileErr) throw plProfileErr;

    const { error: upsertErr } = await adminAClient.rpc("upsert_company_integration", {
      p_provider: "sevdesk",
      p_api_key_encrypted: "ciphertext-platzhalter-nicht-echt",
      p_key_last4: "abcd",
    });
    if (upsertErr) throw upsertErr;
  });

  afterAll(async () => {
    if (!adminClient) return;
    if (companyAId) await adminClient.from("company_integrations").delete().eq("company_id", companyAId);
    await adminClient.auth.admin.deleteUser(adminAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(plAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(adminBId).catch(() => {});
    if (companyAId) await adminClient.from("companies").delete().eq("id", companyAId);
    if (companyBId) await adminClient.from("companies").delete().eq("id", companyBId);
  });

  it("admin der eigenen Firma sieht Status-Metadaten, aber api_key_encrypted ist kein selektierbares Feld", async () => {
    const { data, error } = await adminAClient
      .from("company_integrations")
      .select("provider, status, key_last4")
      .eq("company_id", companyAId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.provider).toBe("sevdesk");
    expect(data?.status).toBe("ok");
    expect(data?.key_last4).toBe("abcd");
  });

  it("api_key_encrypted ist per Client-Select nicht lesbar (kein Spalten-Grant)", async () => {
    const { data, error } = await adminAClient
      .from("company_integrations")
      .select("api_key_encrypted")
      .eq("company_id", companyAId)
      .maybeSingle();

    expect(error).not.toBeNull();
  });

  it("projektleiter der eigenen Firma hat keinen Zugriff auf die Integration", async () => {
    const { data, error } = await projektleiterAClient
      .from("company_integrations")
      .select("provider, status")
      .eq("company_id", companyAId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("get_company_integration_secret liefert fuer projektleiter nichts zurueck", async () => {
    const { data } = await projektleiterAClient.rpc("get_company_integration_secret", {
      p_provider: "sevdesk",
    });
    expect(data).toBeNull();
  });

  it("Firma B (admin) sieht die Integration von Firma A nicht (Cross-Tenant)", async () => {
    const { data, error } = await adminBClient
      .from("company_integrations")
      .select("provider, status")
      .eq("company_id", companyAId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("get_company_integration_secret liefert fuer Firma B nichts zurueck, obwohl derselbe Provider-Name verwendet wird", async () => {
    const { data } = await adminBClient.rpc("get_company_integration_secret", {
      p_provider: "sevdesk",
    });
    expect(data).toBeNull();
  });

  it("admin kann die eigene Verbindung trennen (DELETE)", async () => {
    const { error } = await adminAClient.from("company_integrations").delete().eq("company_id", companyAId);
    expect(error).toBeNull();

    const { data } = await adminAClient
      .from("company_integrations")
      .select("provider")
      .eq("company_id", companyAId);
    expect(data).toEqual([]);
  });
});
