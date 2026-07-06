import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Automatisierte Tests fuer MS 1b gegen das echte (verlinkte) Supabase-Projekt -
 * kein lokales Docker-Postgres verfuegbar. Erfordert SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (siehe tests/integration/rls-tenant-isolation.test.ts), sonst wird
 * die Suite uebersprungen.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasServiceRole = Boolean(url && anonKey && serviceRoleKey);

type ProfileRow = { id: string; company_id: string; role: string };
type InvitationRow = { id: string; token: string; company_id: string };

describe.skipIf(!hasServiceRole)("Einladungen & Trial-Sperre (MS 1b)", () => {
  let adminClient: SupabaseClient;
  let ownerClient: SupabaseClient;
  let memberClient: SupabaseClient;
  let outsiderClient: SupabaseClient;

  const suffix = Date.now();
  const emailOwner = `ms1b-test-owner-${suffix}@example.com`;
  const emailMember = `ms1b-test-member-${suffix}@example.com`;
  const emailOutsider = `ms1b-test-outsider-${suffix}@example.com`;
  const password = "Test1234!Sicher";

  let ownerId: string;
  let memberId: string;
  let outsiderId: string;
  let companyId: string;
  let outsiderCompanyId: string;
  const createdInvitationIds: string[] = [];

  beforeAll(async () => {
    adminClient = createClient(url!, serviceRoleKey!);

    async function createConfirmedUser(email: string) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error(`Test-Nutzer ${email} konnte nicht angelegt werden`);
      return data.user.id;
    }

    ownerId = await createConfirmedUser(emailOwner);
    memberId = await createConfirmedUser(emailMember);
    outsiderId = await createConfirmedUser(emailOutsider);

    ownerClient = createClient(url!, anonKey!);
    memberClient = createClient(url!, anonKey!);
    outsiderClient = createClient(url!, anonKey!);

    const { error: ownerSignInErr } = await ownerClient.auth.signInWithPassword({
      email: emailOwner,
      password,
    });
    if (ownerSignInErr) throw ownerSignInErr;

    const { data: ownerProfile, error: regErr } = await ownerClient.rpc("register_company", {
      company_name: `MS1b Test Firma ${suffix}`,
      full_name: "Test Owner",
    });
    if (regErr) throw regErr;
    companyId = (ownerProfile as ProfileRow).company_id;

    const { error: outsiderSignInErr } = await outsiderClient.auth.signInWithPassword({
      email: emailOutsider,
      password,
    });
    if (outsiderSignInErr) throw outsiderSignInErr;

    const { data: outsiderProfile, error: outsiderRegErr } = await outsiderClient.rpc(
      "register_company",
      { company_name: `MS1b Test Fremdfirma ${suffix}`, full_name: "Test Outsider" },
    );
    if (outsiderRegErr) throw outsiderRegErr;
    outsiderCompanyId = (outsiderProfile as ProfileRow).company_id;

    // "member" tritt per Einladung als mitarbeiter bei, um den Admin-only-Schutz
    // auf invitations gegen einen echten Nicht-Admin derselben Firma zu testen.
    const { data: joinInvite, error: joinInviteErr } = await ownerClient
      .from("invitations")
      .insert({ token: `ms1b-join-${suffix}`, role: "mitarbeiter", max_uses: 1, expires_at: futureIso(7) })
      .select("id, token, company_id")
      .single();
    if (joinInviteErr) throw joinInviteErr;
    createdInvitationIds.push((joinInvite as InvitationRow).id);

    const { error: memberSignInErr } = await memberClient.auth.signInWithPassword({
      email: emailMember,
      password,
    });
    if (memberSignInErr) throw memberSignInErr;

    const { error: acceptErr } = await memberClient.rpc("accept_invitation", {
      token: (joinInvite as InvitationRow).token,
      full_name: "Test Member",
    });
    if (acceptErr) throw acceptErr;
  });

  afterAll(async () => {
    if (!adminClient) return;

    // Reihenfolge wichtig: invitations.created_by verweist ohne ON DELETE CASCADE
    // auf profiles - erst invitations loeschen, sonst blockiert das die
    // Cascade-Loeschung der Profile beim Loeschen der Auth-Nutzer.
    if (companyId) await adminClient.from("invitations").delete().eq("company_id", companyId);
    if (outsiderCompanyId) {
      await adminClient.from("invitations").delete().eq("company_id", outsiderCompanyId);
    }

    await adminClient.auth.admin.deleteUser(ownerId).catch(() => {});
    await adminClient.auth.admin.deleteUser(memberId).catch(() => {});
    await adminClient.auth.admin.deleteUser(outsiderId).catch(() => {});

    if (companyId) await adminClient.from("companies").delete().eq("id", companyId);
    if (outsiderCompanyId) {
      await adminClient.from("companies").delete().eq("id", outsiderCompanyId);
    }
  });

  function futureIso(days: number): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  function pastIso(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  it("member ist korrekt als mitarbeiter der Firma beigetreten (kein neues Unternehmen)", async () => {
    const { data: profile } = await ownerClient
      .from("profiles")
      .select("role, company_id")
      .eq("id", memberId)
      .maybeSingle<ProfileRow>();

    expect(profile?.role).toBe("mitarbeiter");
    expect(profile?.company_id).toBe(companyId);
  });

  it("nur admin darf Einladungen erstellen - mitarbeiter wird per RLS abgelehnt", async () => {
    const { error } = await memberClient
      .from("invitations")
      .insert({ token: `ms1b-denied-${suffix}`, role: "mitarbeiter", max_uses: 1, expires_at: futureIso(7) });

    expect(error).not.toBeNull();
  });

  it("nur admin darf Einladungen der eigenen Firma sehen - mitarbeiter bekommt eine leere Liste", async () => {
    const { data, error } = await memberClient.from("invitations").select("*");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("admin kann eine Einladung erstellen und sehen", async () => {
    const { data, error } = await ownerClient
      .from("invitations")
      .insert({ token: `ms1b-valid-${suffix}`, role: "projektleiter", max_uses: 1, expires_at: futureIso(7) })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data?.id) createdInvitationIds.push(data.id);
  });

  it("lehnt einen frei erfundenen Token ab", async () => {
    const { error } = await outsiderClient.rpc("accept_invitation", {
      token: "dieser-token-existiert-nicht",
      full_name: "Nobody",
    });

    expect(error).not.toBeNull();
  });

  it("lehnt einen abgelaufenen Token ab", async () => {
    const { data: expiredInvite, error: insertErr } = await adminClient
      .from("invitations")
      .insert({
        company_id: companyId,
        created_by: ownerId,
        token: `ms1b-expired-${suffix}`,
        role: "mitarbeiter",
        max_uses: 1,
        expires_at: pastIso(1),
      })
      .select("id, token")
      .single();
    expect(insertErr).toBeNull();
    if (expiredInvite?.id) createdInvitationIds.push(expiredInvite.id);

    const { error } = await outsiderClient.rpc("accept_invitation", {
      token: (expiredInvite as InvitationRow).token,
      full_name: "Nobody",
    });

    expect(error).not.toBeNull();
  });

  it("lehnt einen widerrufenen Token ab", async () => {
    const { data: revokedInvite, error: insertErr } = await ownerClient
      .from("invitations")
      .insert({ token: `ms1b-revoked-${suffix}`, role: "mitarbeiter", max_uses: 1, expires_at: futureIso(7) })
      .select("id, token")
      .single();
    expect(insertErr).toBeNull();
    if (revokedInvite?.id) createdInvitationIds.push(revokedInvite.id);

    const { error: revokeErr } = await ownerClient
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", (revokedInvite as InvitationRow).id);
    expect(revokeErr).toBeNull();

    const { error } = await outsiderClient.rpc("accept_invitation", {
      token: (revokedInvite as InvitationRow).token,
      full_name: "Nobody",
    });

    expect(error).not.toBeNull();
  });

  it("lehnt einen bereits aufgebrauchten Single-Use-Token ab", async () => {
    const { data: singleUseInvite, error: insertErr } = await ownerClient
      .from("invitations")
      .insert({ token: `ms1b-singleuse-${suffix}`, role: "mitarbeiter", max_uses: 1, expires_at: futureIso(7) })
      .select("id, token")
      .single();
    expect(insertErr).toBeNull();
    if (singleUseInvite?.id) createdInvitationIds.push(singleUseInvite.id);

    const firstUser = await createUserForSingleUseTest("first");
    const { error: firstAcceptErr } = await firstUser.client.rpc("accept_invitation", {
      token: (singleUseInvite as InvitationRow).token,
      full_name: "First",
    });
    expect(firstAcceptErr).toBeNull();

    const { error } = await outsiderClient.rpc("accept_invitation", {
      token: (singleUseInvite as InvitationRow).token,
      full_name: "Second",
    });

    expect(error).not.toBeNull();

    await adminClient.auth.admin.deleteUser(firstUser.id).catch(() => {});
  });

  async function createUserForSingleUseTest(label: string) {
    const email = `ms1b-test-${label}-${suffix}@example.com`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("Test-Nutzer konnte nicht angelegt werden");
    const client = createClient(url!, anonKey!);
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    return { id: data.user.id, client };
  }

  it("ein Nutzer, der bereits einer Firma angehoert, kann keine zweite Einladung annehmen", async () => {
    const { data: anotherInvite, error: insertErr } = await ownerClient
      .from("invitations")
      .insert({ token: `ms1b-already-member-${suffix}`, role: "mitarbeiter", max_uses: 1, expires_at: futureIso(7) })
      .select("id, token")
      .single();
    expect(insertErr).toBeNull();
    if (anotherInvite?.id) createdInvitationIds.push(anotherInvite.id);

    // outsiderClient gehoert bereits zur "Fremdfirma" (siehe beforeAll).
    const { error } = await outsiderClient.rpc("accept_invitation", {
      token: (anotherInvite as InvitationRow).token,
      full_name: "Outsider",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("bereits zu einer Firma");
  });

  it("Trial-Sperre: nach Ablauf blockiert INSERT/UPDATE auf invitations, SELECT bleibt moeglich", async () => {
    const { error: expireErr } = await adminClient
      .from("companies")
      .update({ trial_ends_at: pastIso(1) })
      .eq("id", companyId);
    expect(expireErr).toBeNull();

    try {
      const { data: selectData, error: selectErr } = await ownerClient.from("invitations").select("*");
      expect(selectErr).toBeNull();
      expect(Array.isArray(selectData)).toBe(true);

      const { error: insertErr } = await ownerClient
        .from("invitations")
        .insert({ token: `ms1b-blocked-${suffix}`, role: "mitarbeiter", max_uses: 1, expires_at: futureIso(7) });
      expect(insertErr).not.toBeNull();

      const anyInvitationId = createdInvitationIds[0];
      const { error: updateErr } = await ownerClient
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", anyInvitationId);
      expect(updateErr).not.toBeNull();
    } finally {
      // Firma fuer eventuell nachfolgende Tests/Cleanup wieder in einen
      // konsistenten (schreibbaren) Zustand versetzen.
      await adminClient.from("companies").update({ trial_ends_at: futureIso(14) }).eq("id", companyId);
    }
  });
});
