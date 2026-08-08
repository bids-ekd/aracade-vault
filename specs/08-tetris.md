# SPEC 08 — Tetris (real game)

> **Status:** Approved
> **Depends on:** [05-asteroides-juego-real](./05-asteroides-juego-real.md), [06-tabla-juegos-supabase](./06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](./07-leaderboard-asteroides.md)
> **Date:** 2026-08-07
> **Objective:** Portar el juego de Tetris de `references/started-games/03-tetris/` (HTML5 Canvas vanilla) a un motor + componente React/Next.js real en `components/games/tetris/`, agregado como una entrada **nueva y aislada** del catálogo (`id: "tetris"`, sin tocar el juego mock existente `caida`) e integrado vía el registro genérico de motores reales (`lib/games/registry.ts` + `components/games/engine-registry.tsx`), con leaderboard real en Supabase.

## Scope

**In:**

- Nueva entrada en el catálogo con motor real: `id: "tetris"`, `title: "TETRIS"`, copy propio, `cat: "PUZZLE"`, `color: "cyan"` (distinto del magenta de `caida`, la única otra ficha PUZZLE), `cover: "cover-tetris"`, `controls: "teclado"`, `best`/`plays` placeholders. `caida` queda **intacta**, mock, sin ningún cambio.
- Clase CSS nueva `.cover-tetris` en el bloque `/* Cover art generators */` de `app/globals.css`, con paleta cian propia, visualmente distinta de `.cover-tetro` (la portada de `caida`).
- Motor portado a TypeScript en `components/games/tetris/engine.ts` (sin `document`/`window`/`ctx` globales): tablero 10×20, las 8 piezas del original (I/O/T/S/Z/J/L + la pieza "tuerca" `N`), rotación horaria con wall kicks (`[0,±1,±2]`), detección de colisión, limpieza de líneas, ghost piece, siguiente pieza, puntuación clásica (`[0,100,300,500,800] × nivel`, hard drop +2/celda, soft drop +1/fila), niveles cada 10 líneas con velocidad creciente (`max(100, 1000-(nivel-1)×90)` ms). Envuelto en una clase `TetrisEngine` (`reset`/`update`/`draw`/`getState`).
- **Lienzo único de 800×600** (mismo patrón que `AsteroidsEngine`, no dos `<canvas>`): el tablero y la vista previa de la siguiente pieza se dibujan centrados dentro de ese lienzo lógico, para encajar sin deformarse en el marco 4:3 compartido (`.crt-screen`) sin tocar ningún CSS compartido con otros juegos.
- Componente cliente `components/games/tetris/tetris-canvas.tsx`: monta el canvas único (DPR-aware), loop `requestAnimationFrame` (`dt` en segundos, clamp a 50ms, `lastTime` reseteado al reanudar), captura teclado (`ArrowLeft`/`ArrowRight`/`ArrowDown`/`ArrowUp`/`KeyX`/`Space`, con `preventDefault` en las flechas y en `Space`) traducido a un `Input` edge-triggered fiel al original — cada acción (mover, rotar, soft-drop-un-paso, hard drop) se dispara una vez por evento `keydown`, sin repetición propia controlada por el motor (se apoya en el auto-repeat nativo del navegador, igual que `game.js`). **No se porta el atajo de teclado `P`** — la pausa la controla exclusivamente el botón de la plataforma, mismo criterio que Asteroides.
- Reporta hacia afuera vía `onStateChange({ score, lines, level })` (sin `lives`, que queda `undefined` y oculta su tarjeta) y `onGameOver(finalScore)` una sola vez al toparse el tablero.
- **Tarjeta "Líneas" nueva en el HUD externo** (`components/game-player.tsx`): bloque condicional a `lines !== undefined`, mismo patrón que Vidas/Nivel, más una clase `.hud-stat.lines` nueva en `app/globals.css` con su propio color de acento. Es la primera vez que se usa este campo, así que hoy no existe ningún lugar donde mostrarlo.
- Registro: se agrega `"tetris"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`).
- Fila nueva en la tabla `public.games` de Supabase para `tetris` (mismo esquema que la de `asteroides`), aplicada vía `apply_migration` y verificada con `execute_sql`.
- Leaderboard real: reutiliza sin cambios el mecanismo ya genérico de SPEC 07 (`guardarPuntuacion`, `migrarPuntuacionesLocales`, `getMejoresPuntuaciones`, `getMiMejorPuntuacion` en `lib/supabase/score-actions.ts`/`scores.ts`, ya parametrizados por `gameSlug`/`game_id`) — mismas reglas anti-abuso (rango, rate-limit de 10s, RLS) sin ningún control nuevo por juego.

**Out of scope (for future specs):**

- Cualquier cambio a `caida` (id, título, copy, cover, comportamiento) — queda intacta y simulada.
- Controles táctiles/on-screen para TETRIS — solo teclado en este spec, mismo criterio que Asteroides.
- DAS moderno (repetición de movimiento controlada por el motor mientras se mantiene la tecla) — se usa el modelo edge-triggered fiel al original.
- Sonido/música — el original no tiene audio.
- El toggle de tema propio del `game.js` original — se descarta; la plataforma ya tiene el suyo.
- Hold piece, sistema de rotación SRS, o cualquier modo multijugador — no existen en el original, no se agregan acá.
- Portar cualquier otro juego de `references/started-games/` — este spec porta exactamente Tetris.
- Ranking global cruzando juegos, anti-cheat real server-side — límites heredados sin cambios de SPEC 07.

## Data model

**1. Contrato público del motor** (`components/games/tetris/engine.ts`):

```ts
export type TetrisState = {
  score: number;
  lines?: number;
  level?: number;
  status?: "playing" | "gameover";
  // Tetris no tiene "lives" ni estado "won" (juego infinito hasta toparse) —
  // ambos quedan fuera del tipo en vez de forzados a undefined explícito.
};

export type TetrisInput = {
  moveLeft: boolean; // ArrowLeft presionada este frame (edge-triggered, la encola tetris-canvas.tsx)
  moveRight: boolean; // ArrowRight presionada este frame
  rotate: boolean; // ArrowUp o KeyX presionada este frame
  softDrop: boolean; // ArrowDown presionada este frame — baja un solo paso por evento,
  // igual que game.js; la repetición mientras se mantiene la tecla depende del
  // auto-repeat nativo del navegador, no de lógica del motor (fiel al original).
  hardDrop: boolean; // Space presionada este frame
};

export class TetrisEngine {
  constructor(width: number, height: number); // 800, 600
  reset(): void; // (re)inicia partida: tablero 10×20 vacío, score 0, lines 0, level 1, pieza nueva + siguiente
  update(dt: number, input: TetrisInput): void;
  draw(ctx: CanvasRenderingContext2D): void;
  // Dibuja tablero + pieza actual + ghost piece + vista previa de la siguiente pieza,
  // todo centrado dentro del lienzo lógico 800×600. NO dibuja HUD de texto
  // (score/lines/level) ni overlays de pausa/game over — eso lo resuelve
  // exclusivamente el HUD externo y el modal/overlay de la plataforma.
  getState(): TetrisState;
}
```

`TetrisState` es asignable a `GameEngineState` (`lib/games/types.ts`) sin inventar una forma paralela — mismo contrato que ya usan Asteroides y el resto del HUD (`player-hud`).

**Nota sobre input edge-triggered:** a diferencia de `AsteroidsCanvas` (que filtra `e.repeat` en `shoot` para evitar disparos repetidos), `tetris-canvas.tsx` **no** filtra `e.repeat` en ninguna tecla — deja pasar los `keydown` que el navegador reenvía por auto-repeat mientras la tecla está sostenida, encolando cada uno como una acción de un solo frame. Es la forma de preservar fielmente el comportamiento del original (que tampoco filtraba repeticiones), incluida la posibilidad de que mantener `Space` dispare varios hard drops seguidos si el SO repite el evento rápido — mismo comportamiento que `game.js`, documentado como riesgo aceptado más abajo.

**2. Componente canvas** (`components/games/tetris/tetris-canvas.tsx`):

```tsx
export function TetrisCanvas(props: GameCanvasProps): JSX.Element;
```

Mismas responsabilidades que `AsteroidsCanvas`: posee el `<canvas>` único (DPR-aware, 800×600 lógicos), el loop `requestAnimationFrame` (`dt` clamp a 50ms, `lastTime` reseteado al reanudar), los listeners de teclado con cleanup, y el congelamiento total del loop cuando `paused` es `true`.

**3. Fila nueva en Supabase:**

```sql
insert into public.games (slug, title, short, long, cat, cover, color, controls, best, plays)
values (
  'tetris', 'TETRIS',
  'El clásico Tetris, jugable de verdad.',
  'Encaja tetrominós antes de que la torre te sepulte. Rota, desliza y limpia líneas mientras la velocidad aumenta sin piedad cada 10 líneas. El segundo juego del Vault con motor real.',
  'PUZZLE', 'cover-tetris', 'cyan', 'teclado', 52000, '2.7K'
);
```

## Implementation plan

1. **Fila de catálogo.** Aplicar el `insert` de la sección anterior con `apply_migration` de Supabase MCP (mostrando el SQL y pidiendo confirmación antes). Verificar después con `execute_sql` que la fila existe con los valores esperados.
2. **Cover art.** Agregar `.cover-tetris` (con `::before`/`::after` según haga falta) al bloque `/* Cover art generators */` de `app/globals.css`, con paleta cian distinta de `.cover-tetro` (la portada de `caida`). `/biblioteca` ya muestra la ficha "TETRIS" con su propia portada.
3. **Tarjeta "Líneas" en el HUD externo.** Agregar la clase `.hud-stat.lines` a `app/globals.css` (color de acento propio, distinto de `.lives`/`.level`) y el bloque JSX condicional (`lines !== undefined`) en `components/game-player.tsx`, mismo patrón que las tarjetas Vidas/Nivel existentes. Este paso se hace **antes** de conectar el motor: es un cambio a un archivo compartido por todo el catálogo, así que se aísla y se verifica que el resto de los juegos (que nunca reportan `lines`) sigue sin mostrar esa tarjeta.
4. **Motor.** Portar `components/games/tetris/engine.ts` desde `references/started-games/03-tetris/game.js`: tablero 10×20, las 8 piezas, `rotateCW`/`tryRotate` con wall kicks, `collide`, `clearLines`, `ghostY`, puntuación y niveles, todo sin `document`/`window`/`ctx` globales, envuelto en `TetrisEngine` (`reset`/`update`/`draw`/`getState`). `draw()` dibuja tablero + pieza + ghost + siguiente pieza centrados en el lienzo lógico 800×600. Archivo aislado, aún no conectado a ninguna pantalla.
5. **Componente canvas.** Crear `components/games/tetris/tetris-canvas.tsx`: canvas único DPR-aware, loop `requestAnimationFrame` con `dt` clamp a 50ms y reset de `lastTime` al reanudar, listeners de teclado (`ArrowLeft`/`ArrowRight`/`ArrowDown`/`ArrowUp`/`KeyX`/`Space`, `preventDefault` en flechas y `Space`, sin filtrar `e.repeat`) que encolan cada acción como edge-triggered para el siguiente `update()`, congelamiento total del loop en pausa, `onStateChange`/`onGameOver` desde `getState()`, limpieza de listeners y `cancelAnimationFrame` al desmontar. Componente aislado, aún no montado en ninguna pantalla.
6. **Registro.** Agregar `"tetris"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`). **Desde este paso, `/juego/tetris/jugar` ya es jugable de punta a punta** sin tocar `game-player.tsx`, `score-actions.ts`, `salon-hall.tsx` ni `app/juego/[id]/page.tsx` — el mecanismo genérico que dejaron los specs anteriores hace el resto.
7. **Verificación de leaderboard.** Confirmar que `/salon` y `/juego/tetris` muestran datos reales de Supabase para `tetris`, y que guardar una puntuación desde el modal de fin de partida persiste correctamente, respetando el rate-limit de 10s y las reglas de identidad (sesión/`guest_id`) ya existentes sin cambios.
8. **Revisión final.** `npm run lint` y `npm run build` sin errores; recorrido manual completo de `/juego/tetris/jugar` — mover/rotar piezas, wall kicks, soft drop, hard drop, ghost piece, vista previa de la siguiente pieza, limpieza de líneas, progreso de nivel y velocidad, HUD externo (Puntuación/Líneas/Nivel, sin tarjeta de Vidas) sincronizado con el canvas, PAUSA congela el juego por completo, FIN fuerza el fin de partida, GUARDAR PUNTUACIÓN persiste en Supabase, JUGAR DE NUEVO arranca una partida nueva; confirmar en paralelo que `/juego/caida/jugar`, `/juego/asteroides/jugar` y el resto del catálogo siguen funcionando exactamente igual que antes (sin regresiones).

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La tabla `games` de Supabase tiene una fila nueva `tetris` con los valores acordados, verificada vía `execute_sql`.
- [ ] `/biblioteca` muestra una ficha nueva "TETRIS" (portada `.cover-tetris`, acento cian), separada de "CAÍDA", que sigue existiendo sin cambios como mock.
- [ ] `/juego/tetris` (detalle) muestra el copy aprobado, la etiqueta "TECLADO" y la sección "MEJORES PUNTUACIONES" con datos reales de Supabase.
- [ ] `/juego/tetris/jugar` renderiza el canvas real: mover con `←`/`→`, rotar con `↑`/`X` (con wall kicks), soft drop con `↓`, hard drop con `Espacio`, ghost piece visible, vista previa de la siguiente pieza visible, limpieza de líneas y avance de nivel/velocidad cada 10 líneas.
- [ ] El HUD externo (`player-hud`) muestra Puntuación, Líneas y Nivel — sin tarjeta de Vidas — sincronizado en todo momento con el estado del motor.
- [ ] La tarjeta "Líneas" nueva del HUD **no aparece** en ningún otro juego del catálogo (ninguno reporta `lines`).
- [ ] PAUSA congela el juego por completo (nada se mueve, el teclado no responde); REANUDAR retoma sin saltos bruscos.
- [ ] El botón "FIN" fuerza el fin de partida con el score acumulado, abriendo el modal de fin de partida.
- [ ] Desde el modal, "GUARDAR PUNTUACIÓN" persiste el score real en Supabase (tabla `scores`, `game_id` de `tetris`), respetando el rate-limit de 10s y las reglas de identidad (sesión o invitado).
- [ ] "JUGAR DE NUEVO" arranca una partida nueva desde cero (score 0, líneas 0, nivel 1, tablero vacío), remontando el motor vía `key={resetToken}`.
- [ ] `/salon` muestra un tab "TETRIS" con podio y tabla de datos reales de Supabase, igual que "ASTEROIDES"; el resto de los tabs (incluido `caida`, mock) sigue exactamente igual.
- [ ] No hay regresiones en ningún otro juego del catálogo (`caida`, `asteroides` y el resto de los mock).

## Decisions

- **Sí:** ficha nueva y aislada (`id: "tetris"`), `caida` queda intacta y simulada. Mismo precedente que Asteroides/Rocas, decisión explícita del usuario.
- **Sí:** nombre real del juego (`TETRIS`) para la ficha, igual que `ASTEROIDES` usó el nombre real de lo que porta.
- **Sí:** `color: "cyan"` para diferenciarla de `caida` (magenta), la única otra ficha PUZZLE.
- **Sí:** un solo `<canvas>` lógico 800×600 (mismo patrón que Asteroids) con tablero + siguiente pieza centrados dentro, en vez de un segundo `<canvas>` interno — evita deformar el tablero angosto dentro del marco 4:3 compartido (`.crt-screen`) sin tocar CSS compartido con otros juegos.
- **Sí:** modelo de input fiel al original — movimiento/rotación/soft-drop/hard-drop son edge-triggered por evento `keydown`, sin filtrar `e.repeat` y sin DAS propio del motor. Decisión explícita del usuario, preserva el feel exacto de `game.js`.
- **No:** DAS moderno (repetición de movimiento controlada por el motor mientras se sostiene la tecla). Se consideró en la fase de preguntas pero el usuario prefirió fidelidad al original.
- **Sí:** se agrega la tarjeta "Líneas" nueva al HUD externo (`.hud-stat.lines` + JSX en `game-player.tsx`), aunque signifique tocar un archivo compartido por todo el catálogo. Decisión explícita del usuario — necesaria porque `lines` nunca se había expuesto antes.
- **No:** dejar `lines` sin reportar al HUD externo. Se descartó a favor de agregar la tarjeta.
- **Sí:** se elimina el atajo de teclado `P` (pausa propia del original) — la pausa la controla exclusivamente el botón de la plataforma, mismo criterio que Asteroides.
- **Sí:** leaderboard real en Supabase desde este mismo spec, reutilizando sin cambios el mecanismo ya genérico de SPEC 07 (`guardarPuntuacion`/`migrarPuntuacionesLocales`/lecturas por `gameSlug`). Decisión explícita del usuario.
- **Sí:** todas las mecánicas del original entran en alcance (wall kicks, ghost piece, vista previa, hard/soft drop scoring, niveles) — el original es chico y no tiene nada que valga la pena diferir. Decisión explícita del usuario.
- **Sí (heredado):** motor DOM-free (`engine.ts`) envuelto por un componente `"use client"` (`tetris-canvas.tsx`) que posee toda la integración con React/navegador — mismo split que Asteroides.
- **Sí (heredado):** overlays de pausa/game over y atajos de reinicio se eliminan del motor; el modal y el overlay ya existentes de la plataforma manejan el fin de partida y la pausa.
- **Sí (heredado):** reinicio vía `key={resetToken}` (remount de React), nunca un `reset()` imperativo expuesto por el componente canvas.
- **Sí (heredado):** mismos controles anti-abuso de SPEC 07 (`CHECK` de rango, rate-limit de 10s, RLS atando `user_id` a `auth.uid()`) sin ningún control nuevo específico de este juego.

## Risks

| Risk                                                                                                                                                                                                                   | Mitigation                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un tablero angosto (300×600 originalmente) dibujado sin cuidado dentro del marco 4:3 compartido se vería deformado o descentrado                                                                                       | El motor dibuja dentro de un lienzo lógico 800×600 (paso 4 del plan), con el tablero y la vista previa centrados y con padding — mismo criterio que ya valida Asteroids en ese mismo marco             |
| Mantener `Space` sostenido (sin filtrar `e.repeat`, fiel al original) podría disparar varios hard drops seguidos si el sistema operativo repite el evento rápido, perdiendo una torre completa de piezas sin querer    | Riesgo aceptado y documentado — es el mismo comportamiento que ya tiene `game.js`; se preserva a propósito por fidelidad al original en vez de agregar protección nueva no solicitada                  |
| Agregar la tarjeta "Líneas" a `game-player.tsx`/`globals.css` (archivo compartido por las 10 fichas del catálogo) podría, por error, aparecer también en juegos que no reportan `lines`                                | El bloque es condicional a `lines !== undefined` (mismo patrón ya usado por Vidas/Nivel); se verifica explícitamente en el paso 8 del plan que ningún otro juego la muestra                            |
| Encolar acciones edge-triggered por frame (en vez de procesar cada `keydown` de forma síncrona como el original) podría perder una repetición de auto-repeat del SO si dos eventos caen dentro del mismo frame de 16ms | Riesgo aceptado como despreciable en la práctica — el intervalo de auto-repeat del SO (típicamente ≥30ms) es mayor al período de un frame a 60Hz, así que no se pierden pulsaciones reales del jugador |
| Olvidar la segunda entrada de registro (`components/games/engine-registry.tsx`) después de agregar el slug a `lib/games/registry.ts`                                                                                   | `Record<RealGameSlug, …>` lo convierte en error de compilación de TypeScript, no un gap silencioso en runtime — el paso 6 del plan señala ambas ediciones explícitamente                               |
| Un score falso "plausible" desde un cliente modificado (mismo riesgo residual heredado de SPEC 07)                                                                                                                     | Aceptado; la revalidación server-side de la partida sigue fuera de alcance hasta que sea un problema real                                                                                              |
