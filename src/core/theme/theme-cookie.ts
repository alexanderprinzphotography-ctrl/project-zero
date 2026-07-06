import { cookies } from "next/headers";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_COOKIE_NAME = "theme";

export async function getThemeMode(): Promise<ThemeMode> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE_NAME)?.value;
  return value === "light" || value === "dark" ? value : "system";
}
