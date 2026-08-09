"use client";

// ===== theme-provider.tsx — modo claro/oscuro + skin elegida =====
//
// Dos preferencias, un solo provider porque siempre se consumen juntas: la
// paleta que recibe un motor es (skin × modo). Ambas se persisten en
// localStorage con el mismo patrón que lib/guest-id.ts (av_guest_id):
// av_theme para el modo y av_skin para la skin.
//
// El estado se inicializa con un lazy initializer que lee localStorage en el
// primer render de cliente (no en un efecto): así el canvas se pinta ya con
// la paleta correcta y no hay un frame con clasico/dark. La contraparte para
// el CSS es el script inline de app/layout.tsx, que pone data-theme en <html>
// antes del primer paint; los dos leen la misma clave, así que nunca
// discrepan. Ver node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DEFAULT_SKIN,
  getSkin,
  isSkinId,
  type GameSkin,
  type SkinId,
  type ThemeMode,
} from "@/lib/games/skins";

export const THEME_STORAGE_KEY = "av_theme";
export const SKIN_STORAGE_KEY = "av_skin";
const DEFAULT_MODE: ThemeMode = "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  skinId: SkinId;
  skin: GameSkin;
  toggleMode: () => void;
  setSkinId: (id: SkinId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function readSkinId(): SkinId {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    return isSkinId(stored) ? stored : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readMode);
  const [skinId, setSkinIdState] = useState<SkinId>(readSkinId);

  // Refleja el modo en <html data-theme> (el script inline ya lo dejó bien en
  // la carga inicial; esto cubre los cambios posteriores del toggle).
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const setSkinId = useCallback((id: SkinId) => {
    setSkinIdState(id);
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, id);
    } catch {}
  }, []);

  const skin = getSkin(skinId, mode);

  return (
    <ThemeContext.Provider value={{ mode, skinId, skin, toggleMode, setSkinId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  }
  return ctx;
}
