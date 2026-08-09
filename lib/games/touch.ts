// ===== touch.ts — qué motores ya tienen controles táctiles =====
//
// Dato plano, sin "use client": mismo régimen que lib/games/registry.ts y
// lib/games/skins.ts. game-player.tsx lo consulta para decidir si aplica el
// aviso de rotación ("GIRÁ TU DISPOSITIVO") y el touch-action: none durante
// la partida — nada de esto se activa para un motor que no esté en esta
// lista, aunque el dispositivo sea táctil.
//
// Registro explícito y tipado en vez de inferir por convención: agregar un
// juego nuevo acá es la única forma de habilitarle el patrón táctil, no una
// detección automática que podría prender el aviso de rotación de sorpresa
// en un motor que todavía no integró TouchControls.
import type { RealGameSlug } from "@/lib/games/registry";

export const TOUCH_ENABLED_GAME_SLUGS: readonly RealGameSlug[] = ["asteroides"];
