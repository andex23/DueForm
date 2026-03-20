export type AppThemeId = "slate-blue" | "soft-ivory" | "muted-olive";

export interface AppThemeDefinition {
  id: AppThemeId;
  name: string;
  shortName: string;
  colors: {
    background: string;
    card: string;
    accent: string;
  };
}

export const THEME_STORAGE_KEY = "dueform-theme";
export const THEME_CHANGED_EVENT = "dueform-theme-changed";
export const DEFAULT_THEME: AppThemeId = "slate-blue";

export const APP_THEMES: AppThemeDefinition[] = [
  {
    id: "slate-blue",
    name: "Slate Blue",
    shortName: "Slate",
    colors: {
      background: "#0B0B0C",
      card: "#121316",
      accent: "#7C8FA3",
    },
  },
  {
    id: "soft-ivory",
    name: "Soft Ivory",
    shortName: "Ivory",
    colors: {
      background: "#0C0B0A",
      card: "#151311",
      accent: "#D8D0C4",
    },
  },
  {
    id: "muted-olive",
    name: "Muted Olive",
    shortName: "Olive",
    colors: {
      background: "#0B0C0A",
      card: "#121510",
      accent: "#7E8B6F",
    },
  },
];

export function normalizeTheme(theme?: string | null): AppThemeId {
  if (theme === "soft-ivory" || theme === "muted-olive" || theme === "slate-blue") {
    return theme;
  }

  return DEFAULT_THEME;
}

export function getStoredTheme(): AppThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyTheme(theme: string): AppThemeId {
  const nextTheme = normalizeTheme(theme);

  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = nextTheme;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGED_EVENT, { detail: nextTheme })
    );
  }

  return nextTheme;
}
