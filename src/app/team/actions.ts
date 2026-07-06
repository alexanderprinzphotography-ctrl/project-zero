"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";

export type InvitationActionState = { error: string | null; link: string | null };

const ALLOWED_ROLES = ["admin", "projektleiter", "mitarbeiter"];

function generateInvitationToken(): string {
  // 256 Bit CSPRNG-Zufall, URL-sicher kodiert - nicht ratebar.
  return randomBytes(32).toString("base64url");
}

export async function createInvitation(
  _prevState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können Einladungen erstellen.", link: null };
  }

  const role = String(formData.get("role") ?? "mitarbeiter");
  const type = String(formData.get("type") ?? "single");
  const expiresInDays = Number(formData.get("expiresInDays") ?? 7);

  if (!ALLOWED_ROLES.includes(role)) {
    return { error: "Ungültige Rolle.", link: null };
  }
  if (!Number.isFinite(expiresInDays) || expiresInDays < 1 || expiresInDays > 90) {
    return { error: "Ablauf muss zwischen 1 und 90 Tagen liegen.", link: null };
  }

  const supabase = await createClient();
  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("invitations").insert({
    token,
    role,
    max_uses: type === "team" ? null : 1,
    expires_at: expiresAt,
  });

  if (error) {
    if (error.message.toLowerCase().includes("row-level security")) {
      return {
        error: "Einladungen können während der abgelaufenen Testphase nicht mehr erstellt werden.",
        link: null,
      };
    }
    return { error: "Einladung konnte nicht erstellt werden.", link: null };
  }

  revalidatePath("/team");

  const origin = (await headers()).get("origin");
  return { error: null, link: `${origin}/einladung/${token}` };
}

export async function revokeInvitation(
  _prevState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können Einladungen widerrufen.", link: null };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Ungültige Einladung.", link: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.message.toLowerCase().includes("row-level security")) {
      return {
        error: "Einladungen können während der abgelaufenen Testphase nicht widerrufen werden.",
        link: null,
      };
    }
    return { error: "Einladung konnte nicht widerrufen werden.", link: null };
  }

  revalidatePath("/team");
  return { error: null, link: null };
}
