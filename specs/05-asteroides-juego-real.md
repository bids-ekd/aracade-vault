# SPEC 05 — Asteroides (juego real nuevo)

> **Status:** Implemented
> **Depends on:** [04-supabase-auth](./04-supabase-auth.md)
> **Date:** 2026-08-06
> **Objective:** Portar el juego de Asteroids de `references/started-games/02-asteroids/` (canvas HTML5 vanilla) a un motor + componente React/Next.js real en `components/games/asteroids/`, agregado como una entrada **nueva y aislada** del catálogo (`id: "asteroides"`, sin tocar el juego existente `rocas`) e integrado en `/juego/asteroides/jugar`, reemplazando la simulación mock de `GamePlayer` únicamente para esa entrada — el resto del catálogo, incluyendo `rocas`, sigue simulado sin ningún cambio.

## Scope

**In:**

- Nueva entrada en `GAMES` (`lib/data.ts`), completamente aislada de `rocas` (que queda intacto: mismo id, título, copy, cover y `controls: "teclado-tactil"`):
  - `id: "asteroides"`, `title: "ASTEROIDES"`
  - `short: "El clásico Asteroids, jugable de verdad."`
  - `long: "Pilota una nave triangular en el vacío del espacio, dispara y rota para partir asteroides en fragmentos cada vez más pequeños. El primer juego del Vault que corre con un motor real — sin simulación, cada partida es distinta."`
  - `cat: "SHOOTER"`, `color: "cyan"` (distinto del amarillo de `rocas`, para no confundirlas en la grilla)
  - `cover: "cover-asteroides"` (clase CSS nueva)
  - `best`/`plays`: valores mock nuevos, placeholder igual que el resto del catálogo (no derivados de partidas reales)
  - `controls: "teclado"`
- Clase CSS nueva `.cover-asteroides` en `app/globals.css`, siguiendo el mismo patrón que las `.cover-*` existentes (gradientes/formas vía `::before`/`::after`) pero con composición y paleta propias — visualmente distinguible de `.cover-rocas` en la biblioteca.
- Motor del juego portado a TypeScript en `components/games/asteroids/engine.ts`, sin dependencias de React ni del DOM global (`document`/`window`): clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` portadas ~1:1 desde `references/started-games/02-asteroids/game.js`, encapsuladas en una clase `AsteroidsEngine` que expone `reset()`, `update(dt, input)`, `draw(ctx)` y `getState()`.
- Mecánicas del juego original preservadas tal cual: nave con rotación/impulso/drag, disparo, asteroides que se dividen (grande → mediano → pequeño), envolvimiento toroidal de bordes, 3 vidas con invencibilidad parpadeante al reaparecer, partículas de explosión, niveles progresivos (`nextLevel()`), y el power-up de disparo triple (recogible cian, `POWERUP_DROP_CHANCE`/`killsSinceSpawn` garantizado a los 5 kills, duración 5s).
- **HUD en vivo del juego (SCORE/NIVEL/vidas/"3x Ns") se mantiene dibujado dentro del canvas, tal como en `game.js`.** Además, el motor notifica el mismo estado hacia React (`onStateChange`) para que el HUD externo de la plataforma (`player-hud`: Puntuación/Vidas/Nivel) se actualice en paralelo — ambos visibles y sincronizados a la vez, sin que uno reemplace al otro.
- Se elimina únicamente el overlay interno `GAME OVER` (`drawOverlay` en estado gameover) y su atajo de teclado "Espacio para reiniciar" (`pressed('Space')` dentro de `initGame()` en ese estado) — el fin de partida pasa a manejarlo exclusivamente el modal ya existente de la plataforma, para no tener dos flujos de reinicio compitiendo.
- Componente cliente `components/games/asteroids/asteroids-canvas.tsx`: monta el canvas (resolución física = 800×600 × `devicePixelRatio`, escalado por CSS al contenedor), corre el loop `requestAnimationFrame`, captura teclado (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space`, con `preventDefault` para que no haga scroll de la página) y traduce eso al `input` que recibe el motor en cada `update`. Reporta hacia afuera vía props: `onStateChange({ score, lives, level })` en cada cambio y `onGameOver(finalScore)` una sola vez al llegar a 0 vidas. Recibe `paused: boolean` — al pausar, congela el loop por completo (no se llama `requestAnimationFrame`, nada se mueve, se ignora el teclado); al reanudar, retoma sin saltos de `dt`. Limpieza de listeners y `cancelAnimationFrame` al desmontar.
- Campo nuevo `controls: "teclado" | "teclado-tactil"` en el tipo `Game` de `lib/data.ts`. Valor `"teclado"` **solo** para `asteroides`; `"teclado-tactil"` (comportamiento/etiqueta actual, sin cambios) para todo el resto del catálogo, `rocas` incluido.
- `app/juego/[id]/page.tsx`: la etiqueta fija `TECLADO / TÁCTIL` pasa a derivarse de `game.controls` (`"TECLADO"` solo para ASTEROIDES).
- `components/game-player.tsx`: cuando `game.controls === "teclado"` (es decir, únicamente para `id === "asteroides"`), la sección `.game-arena` (hoy divs CSS animados) se reemplaza por `<AsteroidsCanvas key={resetToken} .../>`; `score`, `lives` y `level` dejan de venir del `setInterval` simulado / fórmula (`1 + Math.floor(score/2500)`) y pasan a derivarse de `onStateChange`; `onGameOver` dispara el mismo modal de fin de partida ya existente (con el score final real). El botón "FIN" sigue funcionando igual que hoy (fuerza `over=true` con el score actual — "abandonar partida"); tanto pausa como el modal de fin de partida congelan el canvas (`paused={paused || over}`). "JUGAR DE NUEVO" incrementa un `resetToken` que remonta `AsteroidsCanvas` (motor nuevo desde cero) y resetea `score`/`lives`/`level` locales a sus valores iniciales (0/3/1). Para el resto de los juegos (`controls === "teclado-tactil"`, `rocas` incluido), `GamePlayer` sigue exactamente igual que hoy, sin ningún cambio de lógica.
- El guardado de puntuación en `localStorage` (`av_scores`, mismo formato `{ game, score, name, at }`) sigue funcionando sin cambios, ahora con `game: "asteroides"` y el score real de la partida jugada.

**Out of scope (for future specs):**

- Cualquier cambio al juego `rocas` (id, título, copy, cover, comportamiento) — queda intacto y simulado.
- Controles táctiles / on-screen para ASTEROIDES en móvil — queda con `controls: "teclado"` únicamente; jugar desde un dispositivo táctil sin teclado físico no es soportado en este spec.
- Portar o adaptar cualquier otro juego del catálogo (`rocas`, bloque-buster, caida, serpentina, gloton, invasores, ranaria, duelo-pixel) — siguen 100% simulados.
- Generalizar `GamePlayer` a un mecanismo plugin/genérico de "juego real" más allá del branching puntual sobre `controls === "teclado"` necesario para ASTEROIDES.
- Persistencia de puntuaciones en Supabase (sigue en `localStorage` mock, sin cambios respecto a specs anteriores).
- `best`/`plays`/dificultad (estrellas) del juego ASTEROIDES en `lib/data.ts` — placeholders mock, no derivados de las partidas reales.
- Sonido/música — el juego de referencia no tiene audio y este port tampoco lo agrega.

## Data model

```ts
// components/games/asteroids/engine.ts — sin dependencias de React ni del DOM global

export type AsteroidsStatus = "playing" | "dead" | "gameover";
// "playing"  → partida en curso
// "dead"     → nave recién destruida, respawn pendiente (deadTimer), no es fin de partida
// "gameover" → 0 vidas, GamePlayer debe leer el score final y disparar onGameOver

export type AsteroidsState = {
  score: number;
  lives: number;
  level: number;
  status: AsteroidsStatus;
};

export type AsteroidsInput = {
  left: boolean; // ArrowLeft sostenida
  right: boolean; // ArrowRight sostenida
  thrust: boolean; // ArrowUp sostenida
  shoot: boolean; // Space presionada este frame (edge-triggered, la detecta asteroids-canvas.tsx)
};

export class AsteroidsEngine {
  constructor(width: number, height: number); // 800, 600
  reset(): void; // (re)inicia partida: score 0, 3 vidas, nivel 1, campo nuevo
  update(dt: number, input: AsteroidsInput): void;
  draw(ctx: CanvasRenderingContext2D): void;
  // dibuja entidades + HUD de juego en vivo (SCORE/NIVEL/vidas/"3x Ns"), igual que game.js;
  // NO dibuja el overlay "GAME OVER" (ese fin de partida lo maneja el modal de la plataforma).
  getState(): AsteroidsState;
}
```

```tsx
// components/games/asteroids/asteroids-canvas.tsx
type AsteroidsCanvasProps = {
  paused: boolean;
  onStateChange: (state: { score: number; lives: number; level: number }) => void;
  onGameOver: (finalScore: number) => void;
};

export function AsteroidsCanvas(props: AsteroidsCanvasProps): JSX.Element;
// Uso en game-player.tsx: <AsteroidsCanvas key={resetToken} paused={paused || over} ... />
// El remount vía `key` es lo que dispara un motor (AsteroidsEngine) nuevo — no hay reset imperativo expuesto.
// El HUD de juego dentro del canvas y el HUD externo (player-hud) muestran el mismo score/lives/level
// en paralelo — no son alternativos, van los dos a la vez.
```

```ts
// lib/data.ts — campo nuevo en Game
export type GameControls = "teclado" | "teclado-tactil";

export type Game = {
  // ...campos existentes sin cambios (id, title, short, long, cat, cover, color, best, plays)
  controls: GameControls;
};

// GAMES: se agrega una entrada NUEVA (no reemplaza ninguna existente):
//   { id: "asteroides", title: "ASTEROIDES", cat: "SHOOTER", color: "cyan",
//     cover: "cover-asteroides", controls: "teclado", short/long según borrador aprobado }
// Todas las entradas existentes (rocas incluido) agregan controls: "teclado-tactil", sin otro cambio.
```

No se introduce ningún nuevo mecanismo de persistencia — `av_scores` en `localStorage` (definido en `components/game-player.tsx`) se reutiliza sin cambios de forma.

## Implementation plan

1. Agregar el campo `controls: "teclado" | "teclado-tactil"` al tipo `Game` en `lib/data.ts`; setear `"teclado-tactil"` en las 8 entradas existentes (incluida `rocas`, sin ningún otro cambio en ellas). Agregar la entrada nueva `asteroides` (id, title, short, long, cat, color, cover, best, plays, `controls: "teclado"`) al final de `GAMES`. El proyecto sigue compilando; `/juego/asteroides` y `/juego/asteroides/jugar` ya resuelven vía la ruta dinámica existente (aunque el detalle/jugador todavía no reflejan nada especial).
2. Crear la clase CSS `.cover-asteroides` en `app/globals.css`, siguiendo el patrón de las `.cover-*` existentes (gradientes/formas vía `::before`/`::after`) con paleta cian propia. La biblioteca (`/biblioteca`) ya muestra la ficha "ASTEROIDES" con su propia portada, distinta de "ROCAS".
3. Actualizar `app/juego/[id]/page.tsx`: la etiqueta fija `TECLADO / TÁCTIL` pasa a derivarse de `game.controls`. La ficha de detalle de `/juego/asteroides` ya muestra "TECLADO"; el resto del catálogo sigue mostrando "TECLADO / TÁCTIL" sin cambios.
4. Portar el motor a `components/games/asteroids/engine.ts`: clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` adaptadas desde `references/started-games/02-asteroids/game.js` (sin `document`/`window`/`ctx` globales — reciben el `CanvasRenderingContext2D` en `draw(ctx)`), envueltas en `AsteroidsEngine` (`reset`/`update`/`draw`/`getState`). `draw()` conserva el HUD en vivo (SCORE/NIVEL/vidas/3x) y descarta el overlay `GAME OVER`. Archivo aislado, sin conectar todavía a ninguna pantalla — el sistema sigue funcionando igual que antes.
5. Crear `components/games/asteroids/asteroids-canvas.tsx`: canvas con resolución física `800×600 × devicePixelRatio` escalado por CSS, loop `requestAnimationFrame` que instancia `AsteroidsEngine`, listeners de teclado (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` con `preventDefault`) traducidos a `AsteroidsInput`, congelamiento total del loop cuando `paused === true`, `onStateChange`/`onGameOver` disparados desde el resultado de `getState()` en cada frame, y limpieza (`cancelAnimationFrame` + `removeEventListener`) al desmontar. Componente aislado y aún no montado en ninguna pantalla.
6. Conectar `components/game-player.tsx`: cuando `game.controls === "teclado"`, renderizar `<AsteroidsCanvas key={resetToken} paused={paused || over} onStateChange={...} onGameOver={...} />` en vez de los divs `.game-arena`; `score`/`lives`/`level` locales pasan a derivarse de `onStateChange` (en vez del `setInterval` simulado / fórmula de nivel); `onGameOver` fuerza `over = true` con el score final; "JUGAR DE NUEVO" incrementa `resetToken` y resetea `score`/`lives`/`level` a `0`/`3`/`1`. Para el resto de los juegos, el comportamiento existente queda intacto. En este punto `/juego/asteroides/jugar` es jugable de punta a punta.
7. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual de `/juego/asteroides/jugar` — controles (rotar/impulsar/disparar), HUD interno del canvas y HUD externo de la plataforma muestran los mismos valores en todo momento, power-up de disparo triple, pérdida de vidas con parpadeo de invencibilidad, progreso de nivel, PAUSA congela el juego por completo, FIN fuerza el fin de partida con el score actual, 0 vidas abre el modal de fin de partida con el score real, guardar puntuación persiste en `localStorage` (`av_scores`, `game: "asteroides"`), JUGAR DE NUEVO arranca una partida nueva desde cero; confirmar en paralelo que `/juego/rocas/jugar` y el resto del catálogo siguen funcionando exactamente igual que antes (sin regresiones).

## Acceptance criteria

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] `/biblioteca` muestra una ficha nueva "ASTEROIDES" (portada `.cover-asteroides`, acento cian), separada de "ROCAS", que sigue existiendo sin cambios.
- [x] `/juego/asteroides` (detalle) muestra el copy aprobado y la etiqueta "TECLADO" (no "TECLADO / TÁCTIL").
- [x] `/juego/rocas` (detalle) sigue mostrando "TECLADO / TÁCTIL", igual que el resto del catálogo.
- [x] `/juego/asteroides/jugar` renderiza el canvas real del juego: nave controlable con `←`/`→`/`↑`, disparo con `Espacio`, asteroides que se dividen al ser destruidos, envolvimiento toroidal de bordes.
- [x] El HUD dentro del canvas (SCORE/NIVEL/vidas/indicador "3x" cuando aplica) se ve durante toda la partida.
- [x] El HUD externo de la plataforma (Puntuación/Vidas/Nivel en `player-hud`) muestra en todo momento los mismos valores que el HUD interno del canvas, sin desincronizarse.
- [x] Al perder una vida, la nave respawnea con parpadeo de invencibilidad temporal; al llegar a 0 vidas, el canvas ya no muestra un overlay "GAME OVER" propio — en su lugar se abre el modal de fin de partida de la plataforma con el score final correcto.
- [x] Destruir todos los asteroides de un nivel avanza al siguiente (el HUD de nivel, interno y externo, sube en sincronía).
- [x] Recoger el power-up cian activa disparo triple por su duración; al expirar, vuelve a disparo simple.
- [x] El botón "PAUSA" congela el juego por completo (nada se mueve, el teclado no responde) y "REANUDAR" retoma sin saltos bruscos.
- [x] El botón "FIN" fuerza el fin de partida inmediatamente con el score acumulado hasta ese momento, mostrando el modal de fin de partida.
- [x] Desde el modal de fin de partida, "GUARDAR PUNTUACIÓN" persiste el score real en `localStorage` bajo `av_scores` con `game: "asteroides"`.
- [x] "JUGAR DE NUEVO" desde el modal arranca una partida nueva desde cero (score 0, 3 vidas, nivel 1, campo de asteroides nuevo), tanto en el HUD interno como en el externo.
- [x] "SALIR" navega a `/juego/asteroides` sin errores en consola y sin loops de animación colgados (el `requestAnimationFrame` se cancela al desmontar).
- [x] `/juego/rocas/jugar` y el resto de los juegos del catálogo siguen funcionando exactamente igual que antes de este spec (simulación mock intacta, sin regresiones).

## Decisions

- **Sí:** juego nuevo y aislado (`id: "asteroides"`) en vez de reutilizar/renombrar `rocas`. Decisión explícita del usuario tras una confusión inicial en el spec — `rocas` queda intacto y simulado; el nuevo motor real vive en su propia entrada de catálogo, sin mezclarse.
- **No:** renombrar o tocar de cualquier forma la entrada `rocas` existente. Se descartó un intento inicial de renombrarla a "asteroides" — el usuario aclaró que debía ser un juego nuevo, separado.
- **Sí:** ruta genérica ya existente (`app/juego/[id]/`) para aislar el juego nuevo — no se agrega ruteo especial; alcanza con sumar el registro `asteroides` a `GAMES`.
- **Sí:** motor separado (`engine.ts`) sin dependencias de React, más un componente wrapper (`asteroids-canvas.tsx`) que sí es React. Permite portar la lógica de `game.js` casi 1:1, con el mínimo de refactor y riesgo, dejando toda la integración con React (rAF, teclado, ciclo de vida) en un solo lugar separado.
- **Sí:** HUD del juego (SCORE/NIVEL/vidas/3x) se mantiene dibujado dentro del canvas, tal como en el original, y en paralelo se notifica el mismo estado hacia React para el HUD externo de la plataforma. Decisión explícita del usuario — ambos HUD conviven, no uno reemplaza al otro, aunque los valores queden duplicados.
- **No:** HUD único (solo externo o solo interno). Se consideró inicialmente eliminar el HUD interno para evitar duplicación, pero el usuario pidió expresamente mantener los dos.
- **Sí:** se elimina el overlay interno "GAME OVER" y su atajo de Espacio para reiniciar. El fin de partida (guardar puntuación, reiniciar, volver al vault) ya tiene un flujo completo en la plataforma (modal existente); mantener el overlay del canvas hubiera creado dos mecanismos de reinicio compitiendo por el mismo estado.
- **Sí:** PAUSA congela el loop del juego por completo (sin `requestAnimationFrame`, sin lectura de teclado) en vez de seguir simulando de fondo. Comportamiento de pausa clásico de arcade, más simple de razonar que "sigue corriendo pero se ignora el input".
- **Sí:** el botón "FIN" se mantiene con su comportamiento actual (fuerza game over con el score actual, "abandonar partida"), igual que en el resto del catálogo. No se justifica un caso especial solo para este juego.
- **Sí:** reinicio vía `key={resetToken}` (remount de React) en vez de un método `reset()` imperativo expuesto por `AsteroidsCanvas`. Más idiomático en React, evita exponer una ref/API imperativa innecesaria.
- **Sí:** manejo de `devicePixelRatio` para nitidez en pantallas de alta densidad, mejora sobre el original (que renderiza a 800×600 fijo). El mundo lógico del juego sigue siendo 800×600 — solo cambia la resolución física de render.
- **Sí:** se incluye el power-up de disparo triple tal cual está en `game.js`, aunque no esté documentado en el README de referencia. Ya está completo en el código fuente, no agrega trabajo extra y es parte de la experiencia de juego real.
- **Sí:** controles solo de teclado para este spec, sin controles táctiles on-screen. Coherente con el juego de referencia; la etiqueta de la ficha de detalle ("TECLADO") ya lo comunica con precisión. Controles táctiles quedan para un spec futuro si se decide soportar ASTEROIDES en móvil.
- **Sí:** campo `controls: "teclado" | "teclado-tactil"` en `Game`, usado tanto para la etiqueta de la ficha de detalle como para que `GamePlayer` decida si monta el motor real o la simulación. Un solo campo dirige ambos usos en vez de comparar el `id` a mano en dos archivos distintos.
- **No:** generalizar `GamePlayer` a un mecanismo plugin para "juego real" genérico. Alcance explícitamente acotado a ASTEROIDES; con un solo juego real no se justifica una abstracción — se evalúa cuando exista un segundo caso.
- **Sí:** cover art nueva y distinta (`.cover-asteroides`) en vez de reutilizar `.cover-rocas`. Evita que dos fichas del catálogo luzcan visualmente idénticas en la biblioteca.
- **Sí:** `color: "cyan"` para la ficha de ASTEROIDES, distinto del amarillo de `rocas`, para diferenciarlas a simple vista dentro de la misma categoría (SHOOTER).
- **No:** persistencia de puntuaciones en Supabase para este spec. Sigue en `localStorage` mock, mismo criterio que specs anteriores.

## Risks

| Risk                                                                                                                                                                                                  | Mitigation                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desincronización visual entre el HUD interno del canvas (se dibuja cada frame, síncrono) y el HUD externo de React (`onStateChange` → `setState`, potencialmente un frame de atraso)                  | Aceptado como comportamiento esperado de tener dos HUD en paralelo (decisión explícita del usuario); la diferencia es de milisegundos y no afecta la jugabilidad.                       |
| Al pausar/reanudar, un `dt` grande acumulado por el tiempo pausado podría causar un salto brusco de física al reanudar si no se resetea `lastTime` del loop                                           | El paso 5 del plan contempla explícitamente resetear el timestamp del loop al reanudar, igual que ya hace el juego original al capar `dt` a 50ms por frame.                             |
| Los listeners de teclado (`ArrowLeft/Right/Up`, `Space`) con `preventDefault` global podrían interferir con la navegación del resto de la página si quedan activos fuera de `/juego/asteroides/jugar` | Los listeners se agregan en un `useEffect` con cleanup (`removeEventListener`) atado al ciclo de vida de `AsteroidsCanvas`; solo están activos mientras el componente está montado.     |
| `cancelAnimationFrame` u otro cleanup olvidado dejaría el loop corriendo en segundo plano tras salir de la pantalla ("SALIR" o cambio de ruta), degradando el rendimiento                             | Cleanup explícito en el `useEffect` de `AsteroidsCanvas` (paso 5 del plan); se verifica manualmente en el paso 7 (sin errores de consola ni loops colgados tras "SALIR").               |
| El manejo de `devicePixelRatio` (resolución física vs. lógica del canvas) es una fuente común de bugs sutiles (coordenadas de mouse/touch desalineadas, `ctx.scale` aplicado dos veces)               | No aplica interacción por mouse/touch en este spec (solo teclado); el `ctx.scale(dpr, dpr)` se aplica una única vez al crear el contexto, antes de cualquier `draw()`.                  |
| Confundir visualmente `rocas` y `asteroides` en la biblioteca pese a tener portada y color distintos, por describir temáticas similares (ambos son "asteroides" en el fondo)                          | Colores de acento distintos (amarillo vs. cian), portadas CSS distintas, y copy que menciona explícitamente "el primer juego del Vault que corre con un motor real" para diferenciarlo. |
