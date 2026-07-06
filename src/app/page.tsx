import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Willkommen bei der Baustellen-Zentrale
        </h1>
        <p className="mt-1 text-muted-foreground">
          Grundgerüst steht. Auth, Mandantentrennung und Business-Funktionen folgen in den
          nächsten Meilensteinen.
        </p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Status: MS 0 — Setup &amp; Fundament</CardTitle>
          <CardDescription>
            Next.js, Tailwind, shadcn/ui, Framer Motion und Supabase-Client-Setup sind
            eingerichtet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Beispiel-Button</Button>
        </CardContent>
      </Card>
    </div>
  );
}
