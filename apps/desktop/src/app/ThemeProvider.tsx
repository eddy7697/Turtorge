import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ResolvedTheme, ThemePreference } from "../types";

const ThemeContext = createContext<ResolvedTheme>("dark");

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const media = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(media.matches ? "dark" : "light");
  const resolvedTheme: ResolvedTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    const update = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [media]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return <ThemeContext.Provider value={resolvedTheme}>{children}</ThemeContext.Provider>;
}

export const useResolvedTheme = (): ResolvedTheme => useContext(ThemeContext);

