import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { isQuoteEditable, type Quote } from "@/core/quotes/quote";
import { updateQuote } from "../../actions";
import { QuoteHeaderForm } from "../../quote-header-form";

export default async function AngebotBearbeitenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/");

  const supabase = await createClient();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle<Quote>();
  if (!quote) notFound();
  if (!isQuoteEditable(quote.status) || !context.isWritable) {
    redirect(`/angebote/${id}`);
  }

  const { data: customers } = await supabase
    .from("contacts")
    .select("id, type, company_name, first_name, last_name")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("is_archived", false)
    .order("title", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Angebot #${quote.quote_number} bearbeiten`} />
      <div className="max-w-2xl">
        <QuoteHeaderForm
          quote={quote}
          customers={customers ?? []}
          projects={projects ?? []}
          action={updateQuote.bind(null, id)}
          submitLabel="Änderungen speichern"
        />
      </div>
    </div>
  );
}
