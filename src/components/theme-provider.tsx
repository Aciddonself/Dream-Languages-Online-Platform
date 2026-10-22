"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let preference: Theme = "system";
    const applyTheme = (preference: Theme) => {
      const resolved = preference === "system" ? (mediaQuery.matches ? "dark" : "light") : preference;
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.classList.toggle("light", resolved === "light");
    };

    try {
      const stored = localStorage.getItem("dla-theme");
      preference = stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(preference);
      applyTheme(preference);
    } catch {
      preference = "system";
      applyTheme("system");
    }

    const onSystemThemeChange = () => {
      if (preference === "system") applyTheme(preference);
    };
    mediaQuery.addEventListener("change", onSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", onSystemThemeChange);
  }, []);

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    const resolved = newTheme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : newTheme;
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.classList.toggle("light", resolved === "light");
    try {
      localStorage.setItem("dla-theme", newTheme);
    } catch (error) {
      console.error("Unable to save the theme preference.", error);
      toast.error("Your theme changed, but this browser could not save the preference.");
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
