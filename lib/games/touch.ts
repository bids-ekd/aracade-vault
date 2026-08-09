// ===== touch.ts — qué motores ya tienen controles táctiles =====
//
// Dato plano, sin "use client": mismo régimen que lib/games/registry.ts y
// lib/games/skins.ts. game-player.tsx lo consulta para decidir si monta el
// panel de controles (fuera de `.crt`, layout tipo GameBoy) y aplica
// `touch-action: none` durante la partida — nada de esto se activa para un
// motor que no esté en esta lista, aunque el dispositivo sea táctil.
//
// Registro explícito y tipado en vez de inferir por convención: agregar un
// juego nuevo acá es la única forma de habilitarle el patrón táctil, no una
// detección automática que podría prender el panel de controles de sorpresa
// en un motor que todavía no integró TouchControls.
import type { RealGameSlug } from "@/lib/games/registry";

export const TOUCH_ENABLED_GAME_SLUGS: readonly RealGameSlug[] = ["asteroides"];
