import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Automatisierter Cross-Tenant-Isolationstest gegen das echte (verlinkte)
 * Supabase-Projekt - es gibt kein lokales Docker-Postgres in dieser Umgebung.
 *
 * Erfordert SUPABASE_SERVICE_ROLE_KEY in .env.local (nur serverseitig, nie
 * committen), um Test-Nutzer vorbestaetigt anzulegen und danach wieder zu
 * loeschen. Ohne diesen Key wird die Suite uebersprungen - siehe
 * docs/MS1a_manueller_test.md fuer die manuelle Alternative.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasServiceRole = Boolean(url && anonKey && serviceRoleKey);

type ProfileRow = {
  id: string;
  company_id: string;
  role: string;
};

describe.skipIf(!hasServiceRole)("RLS Cross-Tenant-Isolation (MS 1a)", () => {
  let adminClient: SupabaseClient;
  let userAClient: SupabaseClient;
  let userBClient: SupabaseClient;

  const suffix = Date.now();
  const emailA = `ms1a-test-a-${suffix}@example.com`;
  const emailB = `ms1a-test-b-${suffix}@example.com`;
  const password = "Test1234!Sicher";

  let userAId: string;
  let userBId: string;
  let companyAId: string;
  let companyBId: string;

  beforeAll(async () => {
    adminClient = createClient(url!, serviceRoleKey!);

    const { data: createdA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (errA || !createdA.user) throw errA ?? new Error("Test-Nutzer A konnte nicht angelegt werden");
    userAId = createdA.user.id;

    const { data: createdB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (errB || !createdB.user) throw errB ?? new Error("Test-Nutzer B konnte nicht angelegt werden");
    userBId = createdB.user.id;

    userAClient = createClient(url!, anonKey!);
    userBClient = createClient(url!, anonKey!);

    const { error: signInAErr } = await userAClient.auth.signInWithPassword({
      email: emailA,
      password,
    });
    if (signInAErr) throw signInAErr;

    const { error: signInBErr } = await userBClient.auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (signInBErr) throw signInBErr;

    const { data: profileA, error: regAErr } = await userAClient.rpc("register_company", {
      company_name: `MS1a Test Firma A ${suffix}`,
      full_name: "Test Admin A",
    });
    if (regAErr) throw regAErr;
    companyAId = (profileA as ProfileRow).company_id;

    const { data: profileB, error: regBErr } = await userBClient.rpc("register_company", {
      company_name: `MS1a Test Firma B ${suffix}`,
      full_name: "Test Admin B",
    });
    if (regBErr) throw regBErr;
    companyBId = (profileB as ProfileRow).company_id;
  });

  afterAll(async () => {
    if (!adminClient) return;
    await adminClient.auth.admin.deleteUser(userAId).catch(() => {});
    await adminClient.auth.admin.deleteUser(userBId).catch(() => {});
    if (companyAId) await adminClient.from("companies").delete().eq("id", companyAId);
    if (companyBId) await adminClient.from("companies").delete().eq("id", companyBId);
  });

  it("legt bei der Registrierung atomar Firma + Admin-Profil an", async () => {
    const { data: profile } = await userAClient
      .from("profiles")
      .select("role, company_id")
      .eq("id", userAId)
      .maybeSingle();

    expect(profile?.role).toBe("admin");
    expect(profile?.company_id).toBe(companyAId);
  });

  it("Firma A kann die companies-Zeile von Firma B nicht per SELECT lesen", async () => {
    const { data, error } = await userAClient.from("companies").select("*").eq("id", companyBId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("Firma A kann die profiles-Zeile von Firma B nicht per SELECT lesen", async () => {
    const { data, error } = await userAClient.from("profiles").select("*").eq("id", userBId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("verhindert direkte Aenderung von role per Update auf das eigene Profil", async () => {
    const { error } = await userAClient
      .from("profiles")
      .update({ role: "mitarbeiter" })
      .eq("id", userAId);

    expect(error).not.toBeNull();
  });

  it("verhindert Firmenwechsel per Update auf das eigene Profil", async () => {
    const { error } = await userAClient
      .from("profiles")
      .update({ company_id: companyBId })
      .eq("id", userAId);

    expect(error).not.toBeNull();
  });
});
