import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/core/ui/app-shell";
import { FadeIn } from "@/core/ui/fade-in";
import { getUserContext } from "@/core/auth/get-user-context";
import { getThemeMode } from "@/core/theme/theme-cookie";
import { brandCssVars } from "@/core/theme/brand-style";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Baustellen-Zentrale",
  description: "Projekt- und Baustellenverwaltung für Handwerks- und Baubetriebe",
};

// Nur fuer den "system"-Modus noetig: Cookie/Server kennen die OS-Praeferenz
// nicht, daher blockierend VOR dem ersten Paint ausfuehren (next/script
// beforeInteractive), damit kein Hell/Dunkel-Flash entsteht.
const SYSTEM_THEME_SCRIPT = `
(function () {
  try {
    var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [userContext, themeMode] = await Promise.all([getUserContext(), getThemeMode()]);

  const htmlClassName = [
    geistSans.variable,
    geistMono.variable,
    "h-full",
    "antialiased",
    themeMode === "dark" ? "dark" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Markenfarben gelten firmenweit identisch in hell/dunkel - werden per
  // Inline-Style auf <html> gesetzt, das schlaegt jede Stylesheet-Regel
  // (auch .dark) fuer dieselbe Eigenschaft auf demselben Element.
  const brandStyle = userContext
    ? brandCssVars({ primaryColor: userContext.primaryColor, accentColor: userContext.accentColor })
    : {};

  return (
    <html
      lang="de"
      className={htmlClassName}
      style={brandStyle as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {themeMode === "system" && (
          <Script id="theme-system-init" strategy="beforeInteractive">
            {SYSTEM_THEME_SCRIPT}
          </Script>
        )}
        <AppShell userContext={userContext} themeMode={themeMode}>
          <FadeIn>{children}</FadeIn>
        </AppShell>
      </body>
    </html>
  );
}
