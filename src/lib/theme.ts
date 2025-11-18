export const THEME_STORAGE_KEY = "eventsphere:theme";
export const THEME_CHANGE_EVENT = "eventsphere-theme-change";
export type ThemePreference = "light" | "dark";
export const DEFAULT_THEME: ThemePreference = "dark";

const LIGHT_THEME_BG = "#E5E7EB";
const LIGHT_THEME_TEXT = "#111827";

export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark' ? stored : '${DEFAULT_THEME}';
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '${LIGHT_THEME_BG}';
      document.body.style.color = '${LIGHT_THEME_TEXT}';
    } else {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    }
  } catch (err) {}
})();
`;

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
  } catch (error) {
    console.warn("Unable to read theme from storage", error);
    return DEFAULT_THEME;
  }
}

export function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  if (theme === "light") {
    root.classList.remove("dark");
    body.style.backgroundColor = LIGHT_THEME_BG;
    body.style.color = LIGHT_THEME_TEXT;
  } else {
    root.classList.add("dark");
    body.style.backgroundColor = "";
    body.style.color = "";
  }
  body.dataset.theme = theme;
}

export function dispatchThemeChange(theme: ThemePreference) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
}

export function setThemePreference(theme: ThemePreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  dispatchThemeChange(theme);
}

