"use client";

// ===== engine-registry.tsx — con qué componente se juega cada slug real =====
//
// Complementa lib/games/registry.ts (que decide QUÉ slugs son reales) con el
// componente cliente concreto de cada uno. Vive en un módulo aparte, "use
// client", porque lib/games/registry.ts lo importan también Server
// Components (app/juego/[id]/page.tsx) — un módulo "use client" no puede
// invocarse desde ahí.
//
// Se usa next/dynamic en vez de imports estáticos porque game-player.tsx es
// el cliente de los 9 juegos del catálogo: con import estático, cualquiera
// que juegue uno de los 8 mock descargaría igual el motor de todos los
// juegos reales. Con dynamic(), cada motor es su propio chunk, pedido solo
// cuando corresponde.
//
// La ruta del import() debe ser un literal (no admite template string ni
// variable, ver node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md),
// así que el mapa es un objeto con un dynamic() prearmado por slug — no se
// puede generar dinámicamente a partir de REAL_GAME_SLUGS. No se pasa
// `ssr: false`: los canvas solo tocan window/document dentro de useEffect y
// ya se prerenderizan hoy: omitirlo preserva ese comportamiento.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { hasRealEngine, type RealGameSlug } from "@/lib/games/registry";
import type { GameCanvasProps } from "@/lib/games/types";

const GAME_ENGINES: Record<RealGameSlug, ComponentType<GameCanvasProps>> = {
  asteroides: dynamic(() =>
    import("@/components/games/asteroids/asteroids-canvas").then((m) => m.AsteroidsCanvas),
  ),
};

// GAME_ENGINES es un objeto de nivel de módulo: para un slug dado, siempre
// devuelve la misma referencia de componente entre llamadas, así que React
// reconcilia el mismo tipo entre renders y nunca remonta el canvas.
export function getGameEngine(slug: string): ComponentType<GameCanvasProps> | undefined {
  return hasRealEngine(slug) ? GAME_ENGINES[slug] : undefined;
}

// Componente puente: quien llama a getGameEngine() no puede usar el
// resultado directamente como tag JSX (`<Engine .../>`) porque el linter de
// React Compiler (react-hooks/static-components) trata cualquier valor que
// venga de una llamada a función como "componente creado durante el
// render", sin poder verificar que getGameEngine es una búsqueda estable en
// un mapa de módulo. Acá `engine` llega como prop —no como resultado de una
// llamada dentro de este mismo render— así que el análisis estático no lo
// marca. Sigue siendo exactamente la misma referencia estable.
export function GameEngineSlot({
  engine: Engine,
  ...props
}: GameCanvasProps & { engine: ComponentType<GameCanvasProps> }) {
  return <Engine {...props} />;
}
