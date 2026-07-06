import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/core/ui/app-shell";
import { FadeIn } from "@/core/ui/fade-in";
import { getUserContext } from "@/core/auth/get-user-context";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userContext = await getUserContext();

  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell userContext={userContext}>
          <FadeIn>{children}</FadeIn>
        </AppShell>
      </body>
    </html>
  );
}
