import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserContext } from "@/core/auth/get-user-context";

export default async function Home() {
  const context = await getUserContext();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Willkommen{context?.fullName ? `, ${context.fullName}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Auth und Mandantentrennung stehen. Business-Funktionen folgen in den nächsten
          Meilensteinen.
        </p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Status: MS 1a — Auth, Firmen &amp; Rollen</CardTitle>
          <CardDescription>
            Firma: {context?.companyName || "–"} · Rolle: {context?.role || "–"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nur du und Kolleg:innen deiner Firma können diese Daten sehen — erzwungen durch
          Row-Level Security in Postgres, nicht nur im App-Code.
        </CardContent>
      </Card>
    </div>
  );
}
