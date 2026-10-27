"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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

// Dark mode exists only inside signed-in dashboards; the public website is always light.
const PORTAL_ROOTS = ["student", "teacher", "hoc", "finance", "applicant", "admin"];
function isPortalPath(pathname: string) {
  const [root, second] = pathname.split("/").filter(Boolean);
  if (!root || !PORTAL_ROOTS.includes(root)) return false;
  return !(root === "admin" && second === "login");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const portal = isPortalPath(pathname);
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemDark(mediaQuery.matches);
    try {
      const stored = localStorage.getItem("dla-theme");
      if (stored === "dark" || stored === "light" || stored === "system") setThemeState(stored);
    } catch {}
    const onChange = () => setSystemDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  const preferred: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const resolvedTheme = portal ? preferred : "light";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle("light", resolvedTheme === "light");
  }, [resolvedTheme]);

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
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
