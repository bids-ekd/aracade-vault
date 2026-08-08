# SPEC 10 — Snake (juego real)

> **Status:** Implemented
> **Depends on:** [05-asteroides-juego-real](./05-asteroides-juego-real.md), [06-tabla-juegos-supabase](./06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](./07-leaderboard-asteroides.md), [08-tetris](./08-tetris.md), [09-arkanoid](./09-arkanoid.md)
> **Date:** 2026-08-08
> **Objective:** Construir Snake desde cero (sin `game.js` de referencia — solo un spritesheet de frutas provisto por el usuario en `references/sources-assets/05-snake-assets/`) como un motor + componente React/Next.js real en `components/games/snake/`, agregado vía el registro genérico de motores reales (`lib/games/registry.ts` + `components/games/engine-registry.tsx`), con comida renderizada usando sprites reales de fruta y leaderboard real en Supabase.

## Scope

**In:**

- Nueva entrada en el catálogo: `id: "snake"`, `title: "SNAKE"`, `short: "El clásico Snake, jugable de verdad — con frutas reales."`, `long: "Guiá una serpiente de neón por una grilla que no perdona: cada fruta real que devorás —de las 22 del huerto— la hace más larga y la partida más veloz. Tocar el borde o tu propia cola es el fin. El cuarto juego del Vault con motor real."`, `cat: "ARCADE"`, `color: "green"` (reutilizado — ARCADE ya agota los 4 colores del enum; verde es el color temático de una serpiente y ya se repite entre `serpentina`/`ranaria`), `cover: "cover-snake-real"`, `controls: "teclado"`, `best: 4890`, `plays: "2.1K"`. `serpentina` (mock, `cover-snake`) queda **intacta**, sin ningún cambio.
- Clase CSS nueva `.cover-snake-real` en el bloque `/* Cover art generators */` de `app/globals.css`, visualmente distinta de `.cover-snake` (la de `serpentina`) pese a compartir temática y color.
- Asset copiado: `references/sources-assets/05-snake-assets/fruits.png` → `public/games/snake/fruits.png`.
- `sprites.js` **no se copia tal cual** (asigna a `window.SPRITE_ATLAS`, un global de navegador) — se porta su contenido a `components/games/snake/fruit-atlas.ts`, un módulo de datos puro (`export const FRUIT_ATLAS: Record<FruitKey, {x,y,w,h}>`), sin tocar `window`/`document`, consistente con que el motor nunca toca el DOM.
- Motor en TypeScript `components/games/snake/engine.ts` (sin `document`/`window`/`ctx`/`Image` globales): grilla lógica 20×15 celdas (40px cada una, sobre el lienzo 800×600), movimiento a tics fijos (tick inicial 150ms, gira en incrementos de 90°, nunca permite invertir 180° sobre sí misma), serpiente de 3 segmentos arrancando centrada mirando a la derecha, colisión con el borde y con su propia cola = game over instantáneo, spawn de una fruta a la vez en una celda vacía aleatoria eligiendo entre las 22 claves de `FRUIT_ATLAS` (uniforme), +10 puntos por fruta comida, nivel sube cada 5 frutas comidas bajando el tick 50ms (piso de 60ms). Envuelto en `SnakeEngine` (`reset`/`update`/`draw`/`getState`).
- El motor **no dibuja la fruta como imagen** (no posee ningún `Image`) — `draw()` dibuja la grilla, el cuerpo de la serpiente (vectorial) y el HUD en vivo (SCORE/NIVEL); `getState()` reporta además `foodCell: {x, y}` y `foodSprite: FruitKey` (celda y clave de fruta activa), mismo patrón que el buffer `sfx` de `ArkanoidState` — el motor reporta _qué_ hay que dibujar, nunca _cómo_ se dibuja con una API de navegador.
- Componente cliente `components/games/snake/snake-canvas.tsx`: precarga `fruits.png` en un `HTMLImageElement` al montar y **no arranca el loop hasta que resuelve** (regla de assets del checklist), canvas único DPR-aware 800×600 lógicos, loop `requestAnimationFrame` (`dt` clamp a 50ms, `lastTime` reseteado al reanudar), tras cada `engine.draw(ctx)` dibuja la fruta activa (`ctx.drawImage` recortando `FRUIT_ATLAS[foodSprite]` sobre la celda `foodCell`), listeners de teclado (`ArrowLeft/Right/Up/Down`, `preventDefault`, edge-triggered, ignora la tecla si invierte la dirección actual 180°), congelamiento total del loop en pausa, `onStateChange({score, level})` (sin `lives`) y `onGameOver(finalScore)` conectados a `getState()`, limpieza de listeners y `cancelAnimationFrame` al desmontar.
- Registro: se agrega `"snake"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`).
- Fila nueva en `public.games` de Supabase para `snake` (mismo esquema que `asteroides`/`tetris`/`arkanoid`), aplicada vía `apply_migration` y verificada con `execute_sql`.
- Leaderboard real: reutiliza sin cambios el mecanismo genérico de SPEC 07 (`guardarPuntuacion`, `getMejoresPuntuaciones`, etc., parametrizados por `gameSlug`/`game_id`).

**Out of scope (para specs futuros):**

- Cualquier cambio a `serpentina` (id, título, copy, cover, comportamiento) — queda intacta y simulada.
- Controles táctiles/on-screen para SNAKE — solo teclado en este spec, mismo criterio que Asteroides/Tetris/Arkanoid.
- Wrap-around de bordes — se descarta explícitamente a favor de muerte instantánea (Snake clásico).
- Sonido/música — no hay asset de audio provisto para este juego.
- Jerarquía de puntos por tipo de fruta (todas valen lo mismo) — sin power-ups, sin obstáculos, sin comida especial temporizada.
- Portar cualquier otro juego — este spec construye exactamente Snake.
- Ranking global cruzando juegos, anti-cheat real server-side — límites heredados sin cambios de SPEC 07.

## Data model

**1. Atlas de frutas portado** (`components/games/snake/fruit-atlas.ts`) — mismos valores que `sprites.js`, sin el global `window.SPRITE_ATLAS`:

```ts
// components/games/snake/fruit-atlas.ts — datos puros, sin document/window.
// Portado 1:1 desde references/sources-assets/05-snake-assets/sprites.js
// (fila "mediana" de fruits.png, y=136–295, 160px de alto).

export type FruitKey =
  | "banana"
  | "orange"
  | "grape"
  | "garlic"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "peach"
  | "peanut"
  | "apple"
  | "tomato"
  | "berries"
  | "grapes2"
  | "pineapple"
  | "melon";

export type SpriteRect = { x: number; y: number; w: number; h: number };

export const FRUIT_ATLAS: Record<FruitKey, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

export const FRUIT_KEYS = Object.keys(FRUIT_ATLAS) as FruitKey[];
```

**2. Contrato del motor** (`components/games/snake/engine.ts`):

```ts
import type { FruitKey } from "./fruit-atlas";

export type SnakeState = {
  score: number;
  level: number; // arranca en 1, sube cada 5 frutas
  status: "playing" | "gameover"; // Snake no tiene estado "won" — es un juego infinito hasta chocar
  foodCell: { x: number; y: number }; // coordenadas de grilla (0–19, 0–14) de la fruta activa
  foodSprite: FruitKey; // qué fruta del atlas dibujar ahí — el motor nunca la dibuja él mismo
};

export type SnakeInput = {
  left: boolean; // ArrowLeft presionada este frame (edge-triggered, la detecta snake-canvas.tsx)
  right: boolean;
  up: boolean;
  down: boolean;
  // Un giro que invierte 180° la dirección actual se ignora dentro del motor,
  // incluso si snake-canvas.tsx lo deja pasar — doble resguardo.
};

export class SnakeEngine {
  constructor(width: number, height: number); // 800, 600 → grilla 20×15 celdas de 40px
  reset(): void; // (re)inicia partida: score 0, nivel 1, serpiente de 3 segmentos centrada
  // mirando a la derecha, tick 150ms, fruta nueva en celda vacía aleatoria
  update(dt: number, input: SnakeInput): void;
  // acumula dt en un contador interno; avanza la serpiente una celda cada vez
  // que el contador alcanza el tick vigente (no cada frame) — el tick baja
  // 50ms cada 5 frutas comidas, con piso de 60ms
  draw(ctx: CanvasRenderingContext2D): void;
  // dibuja la grilla, el cuerpo de la serpiente (vectorial, segmentos con
  // resplandor neón) y el HUD en vivo (SCORE/NIVEL) sobre el lienzo lógico
  // 800×600; NO dibuja la fruta (eso lo hace snake-canvas.tsx con
  // FRUIT_ATLAS + drawImage) ni overlays de pausa/game over
  getState(): SnakeState;
}
```

`SnakeState` es asignable a `GameEngineState` (`lib/games/types.ts`) — `foodCell`/`foodSprite` son campos propios de este motor, igual que `sfx` en `ArkanoidState`; `SnakeCanvas` los lee de `getState()` directamente, sin pasarlos por `onStateChange`.

**3. Componente canvas** (`components/games/snake/snake-canvas.tsx`):

```tsx
export function SnakeCanvas(props: GameCanvasProps): JSX.Element;
```

Mismas responsabilidades que `AsteroidsCanvas`/`TetrisCanvas`/`ArkanoidCanvas`: posee el `<canvas>` único (DPR-aware, 800×600 lógicos), el loop `requestAnimationFrame` (`dt` clamp a 50ms, `lastTime` reseteado al reanudar), congelamiento total en pausa, `onStateChange`/`onGameOver` conectados a `getState()`. Además:

- Al montar, crea un `HTMLImageElement`, le asigna `src = "/games/snake/fruits.png"` y **no inicia el loop hasta que `onload` resuelve** (estado `assetsReady`, spinner o pantalla en blanco mientras tanto — mismo criterio del checklist de assets).
- Listener de teclado (`ArrowLeft/Right/Up/Down`, `preventDefault`) que arma el `SnakeInput` edge-triggered, descartando en el propio componente cualquier tecla que invierta 180° la dirección actual reportada por el último `getState()` (resguardo duplicado con el del motor).
- En cada frame, después de `engineRef.current.draw(ctx)`, lee `getState().foodCell`/`foodSprite`, busca el rect en `FRUIT_ATLAS` y hace `ctx.drawImage(fruitImg, rect.x, rect.y, rect.w, rect.h, dx, dy, cellSize, cellSize)` para dibujar la fruta activa sobre su celda.
- Cleanup de listeners y `cancelAnimationFrame` al desmontar, igual que los motores existentes.

**4. Fila nueva en Supabase:**

```sql
insert into public.games (slug, title, short, long, cat, cover, color, controls, best, plays)
values (
  'snake', 'SNAKE',
  'El clásico Snake, jugable de verdad — con frutas reales.',
  'Guiá una serpiente de neón por una grilla que no perdona: cada fruta real que devorás —de las 22 del huerto— la hace más larga y la partida más veloz. Tocar el borde o tu propia cola es el fin. El cuarto juego del Vault con motor real.',
  'ARCADE', 'cover-snake-real', 'green', 'teclado', 4890, '2.1K'
);
```

## Implementation plan

1. **Fila de catálogo.** Aplicar el `insert` de la sección anterior con `apply_migration` de Supabase MCP (mostrando el SQL y pidiendo confirmación antes). Verificar después con `execute_sql` que la fila existe con los valores esperados.
2. **Cover art.** Agregar `.cover-snake-real` (con `::before`/`::after` según haga falta) al bloque `/* Cover art generators */` de `app/globals.css`, paleta verde propia, visualmente distinta de `.cover-snake` (la portada de `serpentina`) pese a compartir color temático. `/biblioteca` ya muestra la ficha "SNAKE" con su propia portada.
3. **Assets de fruta.** Copiar `references/sources-assets/05-snake-assets/fruits.png` a `public/games/snake/fruits.png`. Crear `components/games/snake/fruit-atlas.ts` portando el contenido de `sprites.js` (22 entradas `{x,y,w,h}`) a un módulo de datos puro (`FRUIT_ATLAS`, `FruitKey`, `FRUIT_KEYS`), sin ningún global `window.SPRITE_ATLAS`. Paso aislado, sin código todavía que lo consuma.
4. **Motor.** Escribir `components/games/snake/engine.ts` desde cero (sin `document`/`window`/`ctx`/`Image` globales): grilla lógica 20×15 celdas de 40px, movimiento a tics fijos acumulando `dt` (tick inicial 150ms, -50ms cada 5 frutas comidas, piso 60ms), giro en incrementos de 90° descartando cualquier inversión de 180°, colisión con borde y con la propia cola = `status: "gameover"`, spawn de fruta en celda vacía aleatoria eligiendo `FruitKey` uniforme entre `FRUIT_KEYS`, +10 puntos por fruta, serpiente de 3 segmentos centrada mirando a la derecha en `reset()`. `draw()` dibuja grilla + cuerpo vectorial + HUD en vivo (SCORE/NIVEL); `getState()` expone `foodCell`/`foodSprite` además de `score`/`level`/`status`, sin dibujar la fruta él mismo. Envuelto en `SnakeEngine` (`reset`/`update`/`draw`/`getState`). Archivo aislado, aún no conectado a ninguna pantalla.
5. **Componente canvas.** Crear `components/games/snake/snake-canvas.tsx`: precarga `fruits.png` en un `HTMLImageElement` al montar y no arranca `requestAnimationFrame` hasta que resuelve (`assetsReady`), canvas único DPR-aware, loop con `dt` clamp a 50ms y reset de `lastTime` al reanudar, listeners de teclado (`ArrowLeft/Right/Up/Down`, `preventDefault`, descarta inversión de 180° antes de encolar el input), tras cada `engine.draw(ctx)` dibuja la fruta activa vía `ctx.drawImage` usando `FRUIT_ATLAS[foodSprite]` y `foodCell`, congelamiento total del loop en pausa, `onStateChange({score, level})`/`onGameOver` conectados a `getState()`, limpieza de listeners y `cancelAnimationFrame` al desmontar. Componente aislado, aún no montado en ninguna pantalla.
6. **Registro.** Agregar `"snake"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`). **Desde este paso, `/juego/snake/jugar` ya es jugable de punta a punta** sin tocar `game-player.tsx`, `score-actions.ts`, `salon-hall.tsx` ni `app/juego/[id]/page.tsx` — el mecanismo genérico que dejaron los specs anteriores hace el resto.
7. **Verificación de leaderboard.** Confirmar que `/salon` y `/juego/snake` muestran datos reales de Supabase para `snake`, y que guardar una puntuación desde el modal de fin de partida persiste correctamente, respetando el rate-limit de 10s y las reglas de identidad (sesión/`guest_id`) ya existentes sin cambios.
8. **Revisión final.** `npm run lint` y `npm run build` sin errores; recorrido manual completo de `/juego/snake/jugar` — mover con las 4 flechas, imposibilidad de invertir 180°, comer frutas (variedad de sprites reales visibles, +10 pts cada una), avance de nivel y aceleración cada 5 frutas, choque contra el borde = game over, choque contra la propia cola = game over, HUD externo (Puntuación/Nivel, sin tarjeta de Vidas) sincronizado con el HUD interno del canvas, PAUSA congela el juego por completo, FIN fuerza el fin de partida, GUARDAR PUNTUACIÓN persiste en Supabase, JUGAR DE NUEVO arranca una partida nueva desde cero; confirmar en paralelo que `/juego/serpentina/jugar`, `/juego/asteroides/jugar`, `/juego/tetris/jugar`, `/juego/arkanoid/jugar` y el resto del catálogo siguen funcionando exactamente igual que antes (sin regresiones).

## Acceptance criteria

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La tabla `games` de Supabase tiene una fila nueva `snake` con los valores acordados, verificada vía `execute_sql`.
- [x] `/biblioteca` muestra una ficha nueva "SNAKE" (portada `.cover-snake-real`, acento verde), separada de "SERPENTINA", que sigue existiendo sin cambios como mock.
- [x] `/juego/snake` (detalle) muestra el copy aprobado, la etiqueta "TECLADO" y la sección "MEJORES PUNTUACIONES" con datos reales de Supabase.
- [x] `/juego/snake/jugar` renderiza el canvas real: la serpiente se mueve en grilla a tics fijos, gira con `←`/`→`/`↑`/`↓`, nunca puede invertir 180° sobre sí misma.
- [x] Cada fruta comida se dibuja con un sprite real del atlas (`fruits.png`), no una forma vectorial genérica; distintas frutas aparecen a lo largo de una partida (selección aleatoria entre las 22).
- [x] Comer una fruta suma +10 puntos, hace crecer un segmento a la serpiente y genera una fruta nueva en una celda vacía.
- [x] Cada 5 frutas comidas sube el nivel y el tick baja 50ms (con piso de 60ms) — la partida se siente perceptiblemente más rápida.
- [x] Tocar el borde del tablero termina la partida instantáneamente (`status: "gameover"`), sin wrap-around.
- [x] Chocar contra el propio cuerpo termina la partida instantáneamente (`status: "gameover"`).
- [x] El HUD dentro del canvas (SCORE/NIVEL) se ve durante toda la partida, sincronizado con el HUD externo de la plataforma (Puntuación/Nivel, sin tarjeta de Vidas).
- [x] El canvas no arranca el loop hasta que `fruits.png` termina de cargar (sin fotogramas con fruta rota/ausente al iniciar).
- [x] PAUSA congela el juego por completo (nada se mueve, el teclado no responde); REANUDAR retoma sin saltos bruscos.
- [x] El botón "FIN" fuerza el fin de partida inmediatamente con el score acumulado, abriendo el modal de fin de partida.
- [x] Desde el modal, "GUARDAR PUNTUACIÓN" persiste el score real en Supabase (tabla `scores`, `game_id` de `snake`), respetando el rate-limit de 10s y las reglas de identidad (sesión o invitado).
- [x] "JUGAR DE NUEVO" arranca una partida nueva desde cero (score 0, nivel 1, serpiente de 3 segmentos centrada), remontando el motor vía `key={resetToken}`.
- [x] `/salon` muestra un tab "SNAKE" con podio y tabla de datos reales de Supabase, igual que "ASTEROIDES"/"TETRIS"/"ARKANOID"; el resto de los tabs (incluido `serpentina`, mock) sigue exactamente igual.
- [x] No hay regresiones en ningún otro juego del catálogo (`serpentina`, `asteroides`, `tetris`, `arkanoid` y el resto de los mock).

## Decisions

- **Sí:** ficha nueva y aislada (`id: "snake"`), `serpentina` queda intacta y simulada. Mismo precedente que Rocas/Asteroides, Caída/Tetris, Bloque Buster/Arkanoid.
- **Sí:** título **"SNAKE"** (nombre real, sin traducir) en vez de "SERPIENTE". Decisión explícita del usuario — evita confundirse con "SERPENTINA" (el mock ya existente) y sigue el mismo criterio que Tetris/Arkanoid (nombres originales, no traducidos).
- **No:** título "SERPIENTE". Descartado por el parecido demasiado cercano a "SERPENTINA" dentro de la misma biblioteca.
- **Sí:** clase de portada `cover-snake-real` en vez de `cover-viper` o `cover-fruit-snake`. Decisión explícita del usuario.
- **Sí:** `color: "green"` reutilizado, pese a que ya lo usan `serpentina` y `ranaria` dentro de ARCADE — la paleta de 4 colores del enum está agotada en esa categoría, y verde es el color temático correcto para una serpiente. Primer caso documentado del Vault donde se reutiliza color a falta de uno libre, en vez de forzar una elección sin asociación temática.
- **No:** `yellow`/`magenta` solo por estar más libres dentro de ARCADE. Descartado — sin asociación temática con una serpiente, y el usuario prefirió fidelidad de color sobre unicidad forzada.
- **Sí:** la comida se dibuja con sprites reales del atlas provisto (`fruits.png`) en vez de render 100% vectorial. Decisión explícita del usuario — aprovecha el asset entregado específicamente para esto; primer juego real del Vault que usa una imagen para el _gameplay_ en sí (Arkanoid ya usaba audio, pero no gráficos rasterizados).
- **No:** render 100% vectorial de la comida (mismo criterio que Asteroides/Tetris/Arkanoid). Se consideró por consistencia visual pero el usuario priorizó usar los sprites reales.
- **Sí:** el motor nunca posee ni crea el `Image` de `fruits.png` — reporta `foodCell`/`foodSprite` en su estado (`getState()`) y es `SnakeCanvas` quien precarga y dibuja la imagen con `drawImage`. Mismo principio que el buffer `sfx` de `ArkanoidState`: el motor reporta _qué_ hace falta dibujar/reproducir, nunca toca una API de navegador él mismo.
- **Sí:** `sprites.js` se porta a un módulo TS de datos puro (`fruit-atlas.ts`) en vez de copiarse tal cual — el original asigna a `window.SPRITE_ATLAS`, un global de navegador que el motor no debe tocar bajo ninguna circunstancia.
- **Sí:** movimiento a grilla con tics fijos (Snake clásico) en vez de movimiento continuo. Decisión explícita del usuario.
- **No:** movimiento continuo tipo Slither.io. Descartado por alejarse del Snake clásico y del estilo retro/pixelado del resto del catálogo.
- **Sí:** muerte instantánea al tocar el borde del tablero, sin wrap-around. Decisión explícita del usuario — comportamiento clásico de Snake, el que la mayoría de los jugadores espera.
- **No:** wrap-around de bordes (mismo criterio que Asteroids). Se consideró pero se descartó específicamente para Snake.
- **Sí:** se agrega un campo `level` al contrato del motor y una tarjeta "Nivel" al HUD externo, pese a que la recomendación inicial fue omitirlo. Decisión explícita del usuario tras resolver una ambigüedad en las respuestas — sube cada 5 frutas comidas, bajando el tick 50ms con piso de 60ms.
- **Sí:** se reutiliza la clase `.hud-stat.level` ya existente en `app/globals.css` (introducida por Asteroides) — no hace falta CSS nuevo para la tarjeta de Nivel.
- **Sí:** controles solo de teclado (flechas), sin WASD ni soporte táctil. Decisión explícita del usuario, mismo criterio que el resto de juegos reales del catálogo.
- **Sí:** un giro que invertiría 180° la dirección actual se descarta tanto en `SnakeCanvas` (al encolar el input) como dentro del motor — doble resguardo para que la serpiente nunca pueda chocar contra sí misma por una tecla mal filtrada en un solo lugar.
- **Sí:** selección de fruta aleatoria uniforme entre las 22 disponibles; todas valen los mismos +10 puntos. Decisión explícita del usuario — simplicidad sobre una jerarquía de puntos por tipo de fruta.
- **Sí:** progresión de velocidad "cada 5 frutas, -50ms por nivel, piso 60ms" sobre la alternativa más agresiva (cada 3 frutas). Decisión explícita del usuario.
- **Sí:** grilla de 20×15 celdas de 40px (encastra exacto en el lienzo lógico 800×600, sin recortes), serpiente de 3 segmentos centrada mirando a la derecha al iniciar. Decisión explícita del usuario.
- **No:** sonido — a diferencia de Arkanoid, no hay ningún asset de audio provisto para Snake; este spec no agrega ninguno.
- **Sí (heredado):** motor DOM-free (`engine.ts`) envuelto por un componente `"use client"` que posee toda la integración con React/navegador. Mismo split que Asteroides/Tetris/Arkanoid.
- **Sí (heredado):** overlays de fin de partida/pausa se eliminan del motor; el modal y el botón de pausa ya existentes de la plataforma manejan ambos flujos.
- **Sí (heredado):** reinicio vía `key={resetToken}` (remount de React), nunca un `reset()` imperativo expuesto por el canvas.
- **Sí (heredado):** leaderboard real desde este mismo spec, reutilizando sin cambios el mecanismo genérico de SPEC 07, mismos controles anti-abuso (`CHECK` de rango, rate-limit de 10s, RLS) sin ningún control nuevo específico de este juego.

## Risks

| Risk                                                                                                                                                                                                      | Mitigation                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Las coordenadas de `sprites.js` fueron detectadas "por análisis de píxeles" (según su propio comentario) de un asset de terceros — algún rect podría estar levemente desalineado y recortar mal una fruta | Se verificó visualmente la imagen completa contra las 22 entradas antes de portar el atlas; el paso 8 del plan incluye un recorrido manual que revisa explícitamente que cada fruta se vea completa y sin recortes |
| Cargar `fruits.png` de forma asíncrona podría fallar (404, red) y dejar el canvas sin arrancar nunca el loop, sin ningún mensaje para el jugador                                                          | Riesgo aceptado y sin manejo de error especial en este spec (mismo criterio que otros fetches del catálogo) — el paso 5 solo contempla el camino feliz (`onload`); se revisita si se vuelve un problema real       |
| Reutilizar `color: "green"` en una tercera ficha ARCADE (junto a `serpentina`/`ranaria`) podría generar confusión visual pese a tener portadas distintas                                                  | Mitigado por portadas CSS completamente distintas (`cover-snake-real` vs. `cover-snake` vs. `cover-rana`) y copy que aclara explícitamente que es "el cuarto juego del Vault con motor real"                       |
| El acumulador de tics (grilla a paso fijo) podría desincronizarse visualmente si el navegador dropea frames de forma sostenida, acumulando varios pasos de grilla en un único `update()`                  | El clamp de `dt` a 50ms por frame (mismo patrón que los demás motores) limita cuánto puede acumularse por frame; el paso 8 del plan verifica manualmente que el movimiento se sienta fluido en un recorrido real   |
| Olvidar la segunda entrada de registro (`components/games/engine-registry.tsx`) después de agregar el slug a `lib/games/registry.ts`                                                                      | `Record<RealGameSlug, …>` lo convierte en error de compilación de TypeScript, no un gap silencioso en runtime — el paso 6 del plan señala ambas ediciones explícitamente                                           |
| Un score falso "plausible" desde un cliente modificado (riesgo residual heredado de SPEC 07)                                                                                                              | Aceptado; la revalidación server-side de la partida sigue fuera de alcance hasta que sea un problema real                                                                                                          |
