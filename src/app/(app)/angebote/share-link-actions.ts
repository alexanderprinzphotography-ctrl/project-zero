"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";

export type ShareLinkActionState = { error: string | null; token: string | null };

const DEFAULT_EXPIRES_IN_DAYS = 30;

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

function generateShareToken(): string {
  // 256 Bit CSPRNG-Zufall, URL-sicher kodiert - identisches Muster wie
  // Einladungs-Tokens (siehe src/app/team/actions.ts).
  return randomBytes(32).toString("base64url");
}

export type EnsureShareLinkResult = { ok: true; token: string } | { ok: false; error: string };

/**
 * Wiederverwendet einen noch gueltigen (nicht widerrufenen, nicht abgelaufenen)
 * Share-Link zu diesem Angebot, falls vorhanden - sonst legt sie einen neuen
 * an (Standard-Gueltigkeit). Gemeinsam genutzt vom "Link erstellen"-Button
 * (share-link-section.tsx) und dem E-Mail-Versand (email-actions.ts).
 */
export async function ensureShareLink(quoteId: string): Promise<EnsureShareLinkResult> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { ok: false, error: "Nur Admin oder Projektleiter können Links erstellen." };
  }
  if (!context.isWritable) {
    return { ok: false, error: "Testphase abgelaufen – Aktion ist gesperrt." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("quote_share_links")
    .select("token, expires_at, revoked_at")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && !existing.revoked_at && new Date(existing.expires_at) > new Date()) {
    return { ok: true, token: existing.token };
  }

  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("quote_share_links").insert({
    quote_id: quoteId,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, error: "Link konnte nicht erstellt werden." };
  }

  return { ok: true, token };
}

export async function createShareLink(
  quoteId: string,
  _prevState: ShareLinkActionState,
  formData: FormData,
): Promise<ShareLinkActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Links erstellen.", token: null };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Aktion ist gesperrt.", token: null };
  }

  const days = Number(formData.get("expiresInDays") ?? DEFAULT_EXPIRES_IN_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return { error: "Bitte eine gültige Anzahl Tage angeben (1–365).", token: null };
  }

  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("quote_share_links").insert({
    quote_id: quoteId,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    return { error: "Link konnte nicht erstellt werden.", token: null };
  }

  revalidatePath(`/angebote/${quoteId}`);
  return { error: null, token };
}

export async function revokeShareLink(
  quoteId: string,
  linkId: string,
  _prevState: ShareLinkActionState,
  _formData: FormData,
): Promise<ShareLinkActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Links widerrufen.", token: null };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Aktion ist gesperrt.", token: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("quote_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);

  if (error) {
    return { error: "Link konnte nicht widerrufen werden.", token: null };
  }

  revalidatePath(`/angebote/${quoteId}`);
  return { error: null, token: null };
}
