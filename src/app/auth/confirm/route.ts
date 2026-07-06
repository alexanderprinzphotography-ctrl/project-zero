import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/core/supabase/server";
import { ensureCompanyForUser } from "@/core/auth/ensure-company";

/**
 * Ziel der Bestaetigungs-/Recovery-Links aus den Supabase-Auth-E-Mails
 * (Token-Hash-Flow, siehe README fuer die noetige Anpassung der E-Mail-Templates
 * im Supabase-Dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      if (type === "signup" || type === "email") {
        await ensureCompanyForUser(supabase);
      }
      redirect(next);
    }
  }

  redirect("/login?error=Bestaetigungslink ungueltig oder abgelaufen.");
}
