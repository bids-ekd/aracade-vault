"use client";

// ===== touch-panel-portal.tsx — dónde vive el panel de controles táctiles =====
//
// El panel de controles debe quedar TOTALMENTE fuera de `.crt` (layout tipo
// GameBoy: la "pantalla" arriba, el "cuerpo con botones" abajo, como piezas
// separadas). Pero el wiring de esos botones (heldRef/shootQueuedRef) vive
// adentro de cada motor (p. ej. asteroids-canvas.tsx), que solo puede
// renderizar hijos dentro de `.game-arena` — bien adentro de `.crt`. Un
// Context + `createPortal` resuelve esa distancia sin tocar el contrato
// compartido (`GameCanvasProps`/`lib/games/types.ts`): game-player.tsx
// decide DÓNDE vive el nodo DOM del panel (fuera de `.crt`, estilo consola)
// y lo publica acá; cada motor solo necesita `useTouchPanelPortal()` para
// saber a qué nodo hacerle portal de su `<TouchControls>`.
import { createContext, useContext } from "react";

const TouchPanelPortalContext = createContext<HTMLDivElement | null>(null);

export const TouchPanelPortalProvider = TouchPanelPortalContext.Provider;

// null mientras el panel no está activo (desktop, o el slug no tiene touch
// habilitado) o todavía no se montó su nodo DOM — el motor debe chequear
// antes de hacer createPortal().
export function useTouchPanelPortal(): HTMLDivElement | null {
  return useContext(TouchPanelPortalContext);
}
