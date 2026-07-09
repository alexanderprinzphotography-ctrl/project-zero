import { AppShell } from "@/core/ui/app-shell";
import { FadeIn } from "@/core/ui/fade-in";
import { getUserContext } from "@/core/auth/get-user-context";
import { getThemeMode } from "@/core/theme/theme-cookie";

/**
 * "Baustellen-Zentrale"-Chrome (Header/Sidebar) - gilt fuer alle Routen in
 * dieser Gruppe. Das oeffentliche Kundenportal (/angebot/<token>, MS 12a)
 * liegt bewusst AUSSERHALB dieser Route-Group und bekommt dadurch nur das
 * minimale Root-Layout ohne diese Chrome.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [userContext, themeMode] = await Promise.all([getUserContext(), getThemeMode()]);

  return (
    <AppShell userContext={userContext} themeMode={themeMode}>
      <FadeIn>{children}</FadeIn>
    </AppShell>
  );
}
