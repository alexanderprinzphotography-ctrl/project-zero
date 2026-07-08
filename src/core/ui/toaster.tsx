"use client";

import { Toaster as SonnerToaster } from "sonner";
import type { ThemeMode } from "@/core/theme/theme-cookie";

/** Duenner sonner-Wrapper, im Firmen-/App-Theme gestylt statt sonners Standardfarben. */
export function Toaster({ themeMode }: { themeMode: ThemeMode }) {
  return (
    <SonnerToaster
      theme={themeMode}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-border bg-card text-card-foreground shadow-lg text-sm",
          title: "font-medium",
          description: "text-muted-foreground",
          success: "!border-success/30 [&_[data-icon]]:!text-success-foreground",
          error: "!border-destructive/30 [&_[data-icon]]:!text-destructive",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
        },
      }}
    />
  );
}
