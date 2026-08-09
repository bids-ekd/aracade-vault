// ===== skins.ts — paletas de los motores de juego (skin × modo claro/oscuro) =====
//
// Dato plano, sin "use client" ni imports de React: lo consumen tanto los
// motores (components/games/<slug>/engine.ts, que corren en canvas) como el
// provider de tema (components/theme-provider.tsx) y el reproductor
// (components/game-player.tsx). Mismo régimen que lib/games/registry.ts.
//
// Por qué existe: los motores NO pueden leer del DOM ni de getComputedStyle
// (ver el contrato en lib/games/types.ts) — un engine.ts no toca
// document/window. Por eso la paleta no se resuelve desde las variables CSS
// de app/globals.css en tiempo de dibujo: entra como DATO EXPLÍCITO por el
// constructor del motor y se reemplaza con setSkin(). Los hex de acá son la
// contraparte en canvas de los tokens de :root / :root[data-theme="light"];
// si cambian allá, hay que cambiarlos acá a mano (no hay puente automático).
//
// Todos los ratios de contraste están medidos con la fórmula WCAG 2.1 contra
// el `bg` de su propia entrada: `ink` y `accent` (ambos se usan como texto del
// HUD interno del canvas) cumplen ≥ 4.5:1, y `primary`/`danger`/`ramp[i]`
// (entidades de juego) cumplen ≥ 3:1, en las 6 combinaciones.

export const SKIN_IDS = ["clasico", "neon", "retro"] as const;
export type SkinId = (typeof SKIN_IDS)[number];
export type ThemeMode = "dark" | "light";

// Paleta que recibe un motor. Claves semánticas, no por-juego: el mismo
// contrato sirve para las 4 pantallas y para cualquier motor futuro.
export type GameSkin = {
  bg: string; // fondo que pinta draw() antes de todo
  grid: string; // rejilla / detalle sutil
  ink: string; // texto del HUD interno
  inkDim: string;
  primary: string; // entidad principal: nave, serpiente, paddle
  accent: string; // secundaria: powerups, highlights
  danger: string;
  glow: number; // shadowBlur; 0 obligatorio en modo claro
  ramp: string[]; // rampa indexada: piezas de tetris, filas de arkanoid
};

// Invariante de `ramp`, respetada por las tres skins:
//   1. Tiene 7 entradas (suficientes para las 7 piezas de Tetris y para las
//      filas de Arkanoid, que la usarán como índice numérico).
//   2. Las 3 PRIMERAS entradas no colisionan con `primary`, `accent` ni
//      `danger`. Asteroides las usa para los 3 tamaños de asteroide
//      (ramp[size - 1]) y necesita que no se confundan con la nave (primary),
//      el powerup (accent) ni la llama/explosión (danger).
// Cualquier motor que se sume después puede indexar la rampa entera; solo hay
// que preservar esas dos propiedades al retocar una paleta.

// clasico — el look actual de Arcade Vault. Baseline de coste cero: los hex
// salen tal cual de los tokens de :root en app/globals.css.
const CLASICO_DARK: GameSkin = {
  bg: "#0a0a0f",
  grid: "#15151f",
  ink: "#e6e9ff",
  inkDim: "#8a8fb5",
  primary: "#e6e9ff",
  accent: "#00f5ff",
  danger: "#ff006e",
  glow: 8,
  ramp: ["#ffcf3a", "#00ff88", "#c77dff", "#f5ff00", "#4d7cff", "#ff9e00", "#c7d0e0"],
};

const CLASICO_LIGHT: GameSkin = {
  bg: "#f2f3fa",
  grid: "#d6dae8",
  ink: "#12142a",
  inkDim: "#464b6b",
  primary: "#1b1f3b",
  accent: "#00697a",
  danger: "#b8004f",
  glow: 0,
  ramp: ["#8a6100", "#0a7a45", "#6a3fb5", "#7a7000", "#2a4fb5", "#a35200", "#5a6474"],
};

// neon — saturación máxima, fondo casi negro con tinte violeta. Es la única
// skin con glow alto: la legibilidad viene del halo, no del grosor de trazo.
const NEON_DARK: GameSkin = {
  bg: "#0a0014",
  grid: "#1b0b33",
  ink: "#f4e9ff",
  inkDim: "#b98fe6",
  primary: "#00f0ff",
  accent: "#ff00e5",
  danger: "#ff2d55",
  glow: 18,
  ramp: ["#c77dff", "#39ff14", "#ffe600", "#9d7bff", "#ff8a00", "#00f0ff", "#ff00e5"],
};

const NEON_LIGHT: GameSkin = {
  bg: "#f7f2ff",
  grid: "#ded0f5",
  ink: "#1a0a2e",
  inkDim: "#5a3a80",
  primary: "#00768a",
  accent: "#c400b0",
  danger: "#d1003c",
  glow: 0,
  ramp: ["#7a1fd6", "#2e7d00", "#8f5f00", "#5b3fd6", "#a34a00", "#00768a", "#c400b0"],
};

// retro — CRT de fósforo ámbar con acento verde P1. Paleta corta a propósito
// (6 colores, con entradas repetidas en la rampa) y glow casi nulo: la
// identidad la da el trazo grueso, no el brillo.
const RETRO_DARK: GameSkin = {
  bg: "#140c00",
  grid: "#2b1a00",
  ink: "#ffcf70",
  inkDim: "#c08a2e",
  primary: "#ffb000",
  accent: "#4dff7d",
  danger: "#ff5a1f",
  glow: 2,
  ramp: ["#c98a1e", "#e0a83c", "#a37a1c", "#ffb000", "#4dff7d", "#ff5a1f", "#ffcf70"],
};

const RETRO_LIGHT: GameSkin = {
  bg: "#f5ecd8",
  grid: "#ddcfae",
  ink: "#2b1d05",
  inkDim: "#6b5426",
  primary: "#8a4b00",
  accent: "#1d6b2f",
  danger: "#a32000",
  glow: 0,
  ramp: ["#7a5a10", "#3f6b1d", "#8a4b00", "#6b4a00", "#1d6b2f", "#a32000", "#4a3a12"],
};

export const SKINS: Record<SkinId, Record<ThemeMode, GameSkin>> = {
  clasico: { dark: CLASICO_DARK, light: CLASICO_LIGHT },
  neon: { dark: NEON_DARK, light: NEON_LIGHT },
  retro: { dark: RETRO_DARK, light: RETRO_LIGHT },
};

export const DEFAULT_SKIN: SkinId = "clasico";

// Resolución total: nunca cae a un default silencioso para una combinación
// válida. `isSkinId` filtra lo que venga de localStorage (av_skin), que es
// texto arbitrario controlado por el usuario.
export function getSkin(id: SkinId, mode: ThemeMode): GameSkin {
  return SKINS[id][mode];
}

export function isSkinId(value: string | null | undefined): value is SkinId {
  return (SKIN_IDS as readonly string[]).includes(value ?? "");
}

// Nombre visible del selector de skin del reproductor.
export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "Clásico",
  neon: "Neón",
  retro: "Retro",
};

// Qué motores YA consumen la paleta (constructor + setSkin). El selector de
// skin del reproductor solo se muestra para estos slugs: el resto de los
// motores reales sigue con sus colores literales y cambiar de skin no haría
// nada visible. El agente skin-designer trabaja un juego por corrida y suma
// su slug acá al terminar.
export const SKINNED_GAME_SLUGS: readonly string[] = ["asteroides", "snake", "arkanoid"];
