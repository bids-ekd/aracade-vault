// ===== types.ts — contrato compartido entre motores de juego y la plataforma =====
//
// Sin dependencias de React ni de Next.js: lo importan tanto los motores
// (components/games/<slug>/) como el registro de componentes cliente
// (components/games/engine-registry.ts) y el reproductor (game-player.tsx).

import type { GameSkin } from "@/lib/games/skins";

// Estado que un motor real reporta hacia afuera en cada frame. `score` es
// obligatorio — todo juego tiene puntuación. `lives`/`level`/`lines` son
// opcionales: cada motor expone solo los campos que le aplican (p. ej. un
// juego sin vidas, o uno que cuenta líneas en vez de nivel), y el HUD externo
// de la plataforma (player-hud) oculta la tarjeta correspondiente cuando el
// campo viene `undefined`, en vez de asumir que todos los juegos reales
// tienen la misma forma que Asteroides.
export type GameEngineState = {
  score: number;
  lives?: number;
  level?: number;
  lines?: number;
  status?: "playing" | "won" | "gameover";
};

// Props que debe aceptar el componente canvas de cualquier motor real,
// registrado en components/games/engine-registry.ts.
//
// `skin` la resuelve la plataforma (components/theme-provider.tsx: skin
// elegida × modo claro/oscuro) y la pasa siempre, a todos los motores. Un
// motor que todavía no fue "skineado" simplemente no la desestructura y sigue
// con sus colores literales — equivale a un clasico/dark fijo — así que
// ampliar este contrato no rompe la compilación de los motores pendientes.
// El motor NUNCA lee la paleta del DOM: entra por acá como dato explícito.
export type GameCanvasProps = {
  paused: boolean;
  skin: GameSkin;
  onStateChange: (state: GameEngineState) => void;
  onGameOver: (finalScore: number) => void;
};
