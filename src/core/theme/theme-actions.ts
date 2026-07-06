"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, type ThemeMode } from "./theme-cookie";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  const store = await cookies();
  store.set(THEME_COOKIE_NAME, mode, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
