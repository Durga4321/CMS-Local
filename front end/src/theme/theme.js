export const THEME_STORAGE_KEY = "cms-theme-color";

export const THEME_OPTIONS = [
  { id: "current", name: "Current Teal", color: "#0f9d9d", dark: "#0f5a61", soft: "#dff3f3", glow: "#b8e8e5" },
  { id: "cobalt", name: "Cobalt Blue", color: "#2563eb", dark: "#173f9a", soft: "#e6efff", glow: "#c6d8ff" },
  { id: "sapphire", name: "Sapphire Blue", color: "#0284c7", dark: "#075985", soft: "#e2f3fb", glow: "#b9e4f8" },
  { id: "ocean", name: "Ocean Blue", color: "#0f6fb2", dark: "#12456d", soft: "#e5f2fb", glow: "#c0def1" },
  { id: "midnight", name: "Midnight Navy", color: "#334155", dark: "#1e293b", soft: "#e8edf3", glow: "#cbd5e1" },
  { id: "graphite", name: "Graphite Dark", color: "#475569", dark: "#273449", soft: "#e9edf2", glow: "#cbd5e1" },
  { id: "breeze", name: "Teal Breeze", color: "#14b8a6", dark: "#0f766e", soft: "#def7f4", glow: "#b8eee7" },
  { id: "emerald", name: "Forest Emerald", color: "#16a34a", dark: "#166534", soft: "#e4f7ea", glow: "#bde8c9" },
  { id: "amber", name: "Golden Amber", color: "#d97706", dark: "#92400e", soft: "#fff3dc", glow: "#f9d89e" },
  { id: "cinnamon", name: "Warm Cinnamon", color: "#ea580c", dark: "#9a3412", soft: "#fff0e7", glow: "#f8c6a8" },
  { id: "bronze", name: "Mocha Bronze", color: "#a16207", dark: "#713f12", soft: "#fbf2dc", glow: "#ead39d" },
  { id: "rose", name: "Crimson Rose", color: "#e11d48", dark: "#9f1239", soft: "#ffe7ed", glow: "#f8b8c8" },
  { id: "wine", name: "Burgundy Wine", color: "#be185d", dark: "#831843", soft: "#fde7f1", glow: "#f3b8d1" },
  { id: "orchid", name: "Orchid Plum", color: "#9333ea", dark: "#6b21a8", soft: "#f3e8ff", glow: "#dec2fa" },
  { id: "purple", name: "Royal Purple", color: "#7c3aed", dark: "#5b21b6", soft: "#eee8ff", glow: "#d2c2fb" },
];

const getThemeOption = (id) =>
  THEME_OPTIONS.find((option) => option.id === id) || THEME_OPTIONS[0];

export const applyTheme = (theme) => {
  const option = typeof theme === "string" ? getThemeOption(theme) : theme || THEME_OPTIONS[0];
  const root = document.documentElement;

  root.dataset.cmsTheme = option.id;
  root.style.setProperty("--theme-primary", option.color);
  root.style.setProperty("--theme-primary-dark", option.dark);
  root.style.setProperty("--theme-primary-soft", option.soft);
  root.style.setProperty("--theme-primary-glow", option.glow);
  root.style.setProperty("--app-accent", option.color);
  root.style.setProperty("--app-accent-soft", option.soft);
  root.style.setProperty(
    "--app-gradient-bg",
    `radial-gradient(ellipse 70% 55% at 88% 10%, ${option.glow} 0%, transparent 72%), radial-gradient(ellipse 55% 45% at 8% 15%, ${option.soft} 0%, transparent 70%), linear-gradient(140deg, ${option.soft} 0%, #f8fafc 54%, ${option.soft} 100%)`
  );
  localStorage.setItem(THEME_STORAGE_KEY, option.id);
  window.dispatchEvent(new CustomEvent("cms-theme-change", { detail: option }));
  return option;
};

export const getSavedTheme = () => {
  try {
    return getThemeOption(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return THEME_OPTIONS[0];
  }
};

export const applySavedTheme = () => applyTheme(getSavedTheme());

