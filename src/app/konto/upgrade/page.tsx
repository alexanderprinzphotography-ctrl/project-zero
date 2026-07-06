import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserContext } from "@/core/auth/get-user-context";

export default async function UpgradePage() {
  const context = await getUserContext();

  if (!context) redirect("/login");
  if (context.role !== "admin") redirect("/");

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Upgrade</CardTitle>
          <CardDescription>
            Echte Bezahlung folgt in einem späteren Meilenstein. Meldet euch bei Fragen zur
            Testphase gerne bei uns.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Firma: {context.companyName} · Status: {context.planStatus}
        </CardContent>
      </Card>
    </div>
  );
}
