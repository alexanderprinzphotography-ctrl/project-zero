"use client";

import { useState } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/core/auth/actions";
import { setThemeMode } from "@/core/theme/theme-actions";
import type { ThemeMode } from "@/core/theme/theme-cookie";
import type { UserContext } from "@/core/auth/get-user-context";

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "projektleiter":
      return "Projektleiter";
    default:
      return "Mitarbeiter";
  }
}

function initials(context: UserContext): string {
  const source = context.fullName?.trim() || context.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function applyThemeImmediately(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else if (mode === "light") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Nutzer-Menue in der Kopfzeile - buendelt Theme-Wahl (vormals drei einzelne Buttons) und Abmelden hinter einem Avatar-Trigger. */
export function UserMenu({ context, themeMode }: { context: UserContext; themeMode: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(themeMode);

  function handleThemeChange(next: ThemeMode) {
    setMode(next);
    applyThemeImmediately(next);
    void setThemeMode(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Avatar>
          <AvatarFallback>{initials(context)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{context.fullName ?? context.email}</span>
            <span>
              {context.companyName} · {roleLabel(context.role)}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => handleThemeChange(value as ThemeMode)}
        >
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                <Icon className="size-4" /> {opt.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()} className="text-destructive">
          <LogOut className="size-4" /> Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
