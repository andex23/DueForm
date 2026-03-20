"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import {
  APP_THEMES,
  applyTheme,
  DEFAULT_THEME,
  getStoredTheme,
  THEME_CHANGED_EVENT,
  type AppThemeId,
} from "@/lib/theme";

interface Props {
  compact?: boolean;
  className?: string;
}

export default function ThemeSwitcher({
  compact = false,
  className = "",
}: Props) {
  const [activeTheme, setActiveTheme] = useState<AppThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const syncTheme = () => {
      setActiveTheme(getStoredTheme());
    };

    syncTheme();
    window.addEventListener(THEME_CHANGED_EVENT, syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const handleThemeChange = (themeId: AppThemeId) => {
    setActiveTheme(applyTheme(themeId));
  };

  return (
    <div
      className={`rounded-[12px] border border-border bg-bg-card/92 shadow-[0_8px_18px_rgba(0,0,0,0.14)] ${compact ? "p-2" : "p-3.5"} ${className}`}
    >
      {compact ? (
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-dim text-accent">
              <Palette size={13} />
            </div>
            <div>
              <div className="text-[11px] font-medium text-text">
                Choose a theme
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim text-accent">
            <Palette size={15} />
          </div>
          <div>
            <div className="text-[13px] font-medium text-text">
              Choose a theme
            </div>
          </div>
        </div>
      )}

      <div className={`grid ${compact ? "grid-cols-3 gap-1.5" : "gap-2"}`}>
        {APP_THEMES.map((theme) => {
          const isActive = activeTheme === theme.id;

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className={`rounded-lg border text-left transition-all ${
                isActive
                  ? "border-accent/45 bg-accent-dim text-accent"
                  : "border-border bg-bg-elevated/70 text-text hover:border-border-hover"
              } ${compact ? "px-2.5 py-2" : "px-3 py-3"}`}
            >
              <div className={`flex ${compact ? "flex-col items-start gap-1.5" : "items-center gap-2.5"}`}>
                <div className="flex items-center gap-1">
                  <span
                    className="h-3 w-3 rounded-full border border-white/10"
                    style={{ background: theme.colors.background }}
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-white/10"
                    style={{ background: theme.colors.card }}
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-white/10"
                    style={{ background: theme.colors.accent }}
                  />
                </div>
                <div className={`min-w-0 ${compact ? "space-y-0.5" : ""}`}>
                  <div className={`${compact ? "text-[10px] leading-[1rem] uppercase tracking-[0.12em]" : "truncate text-[12px]"} font-semibold`}>
                    {compact ? theme.shortName.toUpperCase() : theme.name}
                  </div>
                  {compact && (
                    <div className={`text-[9px] leading-[0.95rem] ${isActive ? "text-accent/80" : "text-text-dim"}`}>
                      {theme.name.split(" ").slice(0, 1).join("")}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
