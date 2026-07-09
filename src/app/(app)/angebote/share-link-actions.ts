"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";

export type ShareLinkActionState = { error: string | null; token: string | null };

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

function generateShareToken(): string {
  // 256 Bit CSPRNG-Zufall, URL-sicher kodiert - identisches Muster wie
  // Einladungs-Tokens (siehe src/app/team/actions.ts).
  return randomBytes(32).toString("base64url");
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

  const days = Number(formData.get("expiresInDays") ?? 30);
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
