import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/core/ui/toaster";
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

// Kraeftige, geometrische Display-Schrift fuer Ueberschriften (MS 10a) - grenzt
// sich bewusst vom Geist-Sans-Fliesstext ab fuer eine klare Schrifthierarchie.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
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

/**
 * Minimales Root-Layout - nur das, was fuer JEDE Route gilt (html/body,
 * Schriften, Theme-Klasse/-Farben). Die "Baustellen-Zentrale"-Chrome
 * (Header/Sidebar) kommt aus (app)/layout.tsx - das oeffentliche Kundenportal
 * (/angebot/<token>, MS 12a) liegt bewusst AUSSERHALB dieser Gruppe und
 * bekommt dadurch nie diese Chrome (kein Next.js-Mechanismus erlaubt es,
 * das Root-Layout selbst pro Route zu variieren - Route-Groups sind dafuer
 * der vorgesehene Weg).
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [userContext, themeMode] = await Promise.all([getUserContext(), getThemeMode()]);

  const htmlClassName = [
    geistSans.variable,
    geistMono.variable,
    plusJakartaSans.variable,
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
        {children}
        <Toaster themeMode={themeMode} />
      </body>
    </html>
  );
}
