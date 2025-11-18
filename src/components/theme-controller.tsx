"use client";

import { useEffect } from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  getStoredTheme,
  type ThemePreference,
  DEFAULT_THEME,
} from "@/lib/theme";

export function ThemeController() {
  useEffect(() => {
    const apply = (theme: ThemePreference) => {
      applyThemeToDocument(theme);
    };

    apply(getStoredTheme());

    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<ThemePreference>).detail;
      if (detail === "light" || detail === "dark") {
        apply(detail);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const value = event.newValue;
        if (value === "light" || value === "dark") {
          apply(value);
        } else {
          apply(DEFAULT_THEME);
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

  return null;
}


