"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/core/supabase/server";

export type QuoteResponseActionState = { error: string | null; success: boolean };

/** IP/User-Agent immer serverseitig aus den Request-Headern lesen - der Client schickt sie nie selbst mit (sonst waeren sie faelschbar). */
async function requesterInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  return { ip, userAgent: h.get("user-agent") };
}

export async function respondToQuoteShare(
  token: string,
  action: "angenommen" | "abgelehnt",
  _prevState: QuoteResponseActionState,
  formData: FormData,
): Promise<QuoteResponseActionState> {
  const responderName = String(formData.get("responderName") ?? "").trim();
  if (!responderName) {
    return { error: "Bitte deinen Namen eingeben.", success: false };
  }

  const { ip, userAgent } = await requesterInfo();
  const supabase = await createClient();

  const { error } = await supabase.rpc("respond_to_quote_share", {
    p_token: token,
    p_action: action,
    p_responder_name: responderName,
    p_ip: ip,
    p_user_agent: userAgent,
  });

  if (error) {
    return {
      error: "Das hat nicht funktioniert. Bitte lade die Seite neu und versuche es erneut.",
      success: false,
    };
  }

  revalidatePath(`/angebot/${token}`);
  return { error: null, success: true };
}
