"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserContext } from "@/core/auth/get-user-context";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: (role: UserContext["role"]) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard, visible: () => true },
  { href: "/projekte", label: "Projekte", icon: Building2, visible: () => true },
  { href: "/kunden", label: "Kunden", icon: Users, visible: () => true },
  { href: "/zeiten", label: "Zeiten", icon: Clock, visible: () => true },
  { href: "/einsatzplanung", label: "Einsatzplanung", icon: CalendarDays, visible: () => true },
  { href: "/team", label: "Team", icon: UsersRound, visible: (role) => role !== "mitarbeiter" },
  { href: "/angebote", label: "Angebote", icon: FileText, visible: (role) => role !== "mitarbeiter" },
  { href: "/rechnungen", label: "Rechnungen", icon: Receipt, visible: (role) => role !== "mitarbeiter" },
  {
    href: "/leistungskatalog",
    label: "Leistungskatalog",
    icon: ClipboardList,
    visible: (role) => role !== "mitarbeiter",
  },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings, visible: (role) => role === "admin" },
  { href: "/konto/upgrade", label: "Abo", icon: CreditCard, visible: (role) => role === "admin" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ role }: { role: UserContext["role"] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {NAV_ITEMS.filter((item) => item.visible(role)).map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-2.5 py-2 transition-colors",
              active
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
