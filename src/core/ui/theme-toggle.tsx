"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setThemeMode } from "@/core/theme/theme-actions";
import type { ThemeMode } from "@/core/theme/theme-cookie";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
];

function applyImmediately(mode: ThemeMode) {
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

export function ThemeToggle({ current }: { current: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(current);

  function handleSelect(next: ThemeMode) {
    setMode(next);
    applyImmediately(next);
    void setThemeMode(next);
  }

  return (
    <div className="flex gap-1">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={mode === opt.value ? "default" : "outline"}
          onClick={() => handleSelect(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
