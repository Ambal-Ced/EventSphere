"use client";

import { useEffect, useState } from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
  DEFAULT_THEME,
  getStoredTheme,
} from "@/lib/theme";

export function useThemePreference(initial: ThemePreference = DEFAULT_THEME) {
  const [theme, setTheme] = useState<ThemePreference>(initial);

  useEffect(() => {
    setTheme(getStoredTheme());

    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<ThemePreference>).detail;
      if (detail === "light" || detail === "dark") {
        setTheme(detail);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const value = event.newValue;
        if (value === "light" || value === "dark") {
          setTheme(value);
        }
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return theme;
}


