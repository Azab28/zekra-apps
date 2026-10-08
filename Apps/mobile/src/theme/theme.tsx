/** The current look: light/dark (the setting or the device's), the colour style, the bar's look and the text size. */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useStore } from "@/core/store";
import type { NavStyle } from "@/core/settings";
import { makeTheme, type Theme } from "./colors";

/** `scale`: text sizes (1.15 with «خط كبير»). */
type CurrentTheme = Theme & { nav: NavStyle; scale: number };

const ThemeContext = createContext<CurrentTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useStore();
  const scheme = useColorScheme();
  const dark = settings.theme === "dark" || (settings.theme === "system" && scheme === "dark");
  const value = useMemo(
    () => ({ ...makeTheme(dark, settings.palette), nav: settings.nav, scale: settings.large ? 1.15 : 1 }),
    [dark, settings.palette, settings.nav, settings.large],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): CurrentTheme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("useTheme outside ThemeProvider");
  return t;
}
