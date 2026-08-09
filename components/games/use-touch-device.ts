"use client";

// ===== use-touch-device.ts — detección SSR-safe de dispositivo táctil =====
//
// useTouchDevice() expone si el puntero primario del dispositivo es "coarse"
// (dedo, no mouse fino) vía matchMedia("(pointer: coarse)"). Usa
// useSyncExternalStore (no useState+useEffect) para que el snapshot de
// servidor sea `false` de forma explícita: el servidor no puede evaluar
// matchMedia, y renderizar cualquier otra cosa en el HTML inicial produciría
// un desajuste de hidratación en el primer render de cliente. Se suscribe al
// evento "change" del MediaQueryList para reaccionar si el tipo de puntero
// cambia en caliente (p. ej. una laptop híbrida que conecta/desconecta un
// mouse), a diferencia del store vacío que game-player.tsx usa para
// `hydrated` (que nunca cambia una vez montado).

import { useSyncExternalStore } from "react";

const TOUCH_QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(TOUCH_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(TOUCH_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

// true si matchMedia("(pointer: coarse)") matchea; false en SSR y en desktop/mouse.
export function useTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
