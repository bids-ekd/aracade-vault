# SPEC 09 — Arkanoid (juego real)

> **Status:** Implemented
> **Depends on:** [05-asteroides-juego-real](./05-asteroides-juego-real.md), [06-tabla-juegos-supabase](./06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](./07-leaderboard-asteroides.md), [08-tetris](./08-tetris.md)
> **Date:** 2026-08-08
> **Objective:** Portar el juego de Arkanoid de `references/started-games/04-arkanoid/` (canvas HTML5 vanilla con spritesheet y audio) a un motor + componente React/Next.js real en `components/games/arkanoid/`, agregado vía el registro genérico de motores reales (`lib/games/registry.ts` + `components/games/engine-registry.tsx`), con gráficos redibujados en vectorial, sonido portado y leaderboard real en Supabase.

## Scope

**In:**

- Nueva entrada en el catálogo: `id: "arkanoid"`, `title: "ARKANOID"`, `short: "El clásico rompe-bloques, con paddle y pelota de verdad."`, `long: "Controlá el paddle con teclado o mouse y rebotá la pelota para destruir cinco muros de bloques cada vez más traicioneros. La velocidad crece en cada nivel — superalos todos para ganar de verdad, no solo para sumar puntos."`, `cat: "ARCADE"`, `color: "magenta"` (distinto del cyan de `bloque-buster`, la ficha mock de este mismo juego), `cover: "cover-arkanoid"`, `controls: "teclado"`, `best: 45000`, `plays: "1.9K"`. `bloque-buster` queda **intacto**, mock, sin ningún cambio.
- Clase CSS nueva `.cover-arkanoid` en el bloque `/* Cover art generators */` de `app/globals.css`, paleta magenta propia, visualmente distinta de `.cover-bricks`.
- Motor portado a TypeScript en `components/games/arkanoid/engine.ts` (sin `document`/`window`/`ctx` globales, sin `Audio`): paddle, pelota, bloques (los 5 niveles de `levels.js` portados 1:1 — parrilla completa, pirámide, tablero de ajedrez, filas con huecos, marco+cruz), colisión AABB, rebotes en paredes y paddle, rotura de bloque (+10 pts, animación de explosión vectorial), 3 vidas, velocidad de pelota creciente por nivel (×1.00 → ×1.46), estado de victoria real tras superar el nivel 5. Envuelto en `ArkanoidEngine` (`reset`/`update`/`draw`/`getState`).
- Render 100% vectorial (sin spritesheet): paddle y bloques como rectángulos, pelota como círculo, explosión como un efecto corto de partículas/círculo expandiéndose y desvaneciéndose en el color del bloque — mismo criterio estético que `AsteroidsEngine`/`TetrisEngine`. Colores de bloque del original (`red`/`yellow`/`cyan`/`magenta`/`hotpink`/`green`) preservados como fills.
- Sonido portado: `bounceSound`/`breakSound` (copiados a `public/games/arkanoid/sounds/`). El motor nunca instancia `Audio`; reporta en `getState()` los sonidos disparados ese frame (ver Data model) y `ArkanoidCanvas` —que posee y precarga los `Audio()`— los reproduce. **Primer juego real del Vault con audio**; sin control de volumen/mute (fuera de alcance).
- HUD en vivo dentro del canvas (score arriba-izquierda, "Nivel: N" arriba-centro, N vidas arriba-derecha) igual que el original, en paralelo con `onStateChange` para el HUD externo (`score`/`lives`/`level`; sin `lines`).
- Overlays eliminados del motor: sin `GAME OVER`, victoria ni pausa dibujados internamente — fin de partida (derrota o victoria) se reporta como `status: "gameover" | "won"`, resuelto por el modal existente de la plataforma. Se agrega una distinción mínima de copy en ese modal para `status === "won"` (primer juego que lo alcanza). Se elimina el atajo `P`/`Escape` de pausa y el selector de nivel por click durante la pausa — sin equivalente en el flujo de pausa de la plataforma.
- Controles: `←`/`→` sostenidas (con `preventDefault`) mueven el paddle a velocidad fija; `mousemove` continuo sobre el canvas posiciona el paddle directamente (con el mismo escalado DPR/CSS ya usado en otros motores). Sin soporte táctil (`controls: "teclado"`).
- Componente cliente `components/games/arkanoid/arkanoid-canvas.tsx`: canvas único DPR-aware 800×600 lógicos, loop `requestAnimationFrame` (`dt` clamp a 50ms, `lastTime` reseteado al reanudar), listeners de teclado + mouse con cleanup, congelamiento total en pausa, reproduce los 2 sonidos precargados según `getState().sfx`, `onStateChange`/`onGameOver` conectados.
- Registro: se agrega `"arkanoid"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`).
- Fila nueva en `public.games` de Supabase para `arkanoid` (mismo esquema que `asteroides`/`tetris`), aplicada vía `apply_migration` y verificada con `execute_sql`.
- Leaderboard real: reutiliza sin cambios el mecanismo genérico de SPEC 07 (`guardarPuntuacion`, `getMejoresPuntuaciones`, etc., parametrizados por `gameSlug`/`game_id`).

**Out of scope (for future specs):**

- Cualquier cambio a `bloque-buster` (id, título, copy, cover, comportamiento) — queda intacta y simulada.
- Controles táctiles/on-screen para ARKANOID — solo teclado y mouse en este spec.
- El selector de nivel por click durante la pausa y el atajo `P`/`Escape` del original — eliminados, sin reemplazo.
- Spritesheet real (`spritesheet-breakout.png`) — se descarta a favor de render vectorial.
- Control de volumen/mute para el audio nuevo — reproducción fija, sin ajustes.
- Más de los 5 niveles originales, o un editor de niveles.
- Anti-cheat real server-side, ranking global cruzando juegos — límites heredados sin cambios de SPEC 07.
- Portar cualquier otro juego de `references/started-games/`.

## Data model

**1. Contrato del motor** (`components/games/arkanoid/engine.ts`):

```ts
export type ArkanoidSfx = "bounce" | "break";

export type ArkanoidState = {
  score: number;
  lives: number;
  level: number; // 1–5
  status: "playing" | "won" | "gameover";
  sfx: ArkanoidSfx[]; // sonidos disparados durante el último update(); se vacía al iniciar cada update()
};

export type ArkanoidInput = {
  left: boolean; // ArrowLeft sostenida
  right: boolean; // ArrowRight sostenida
  mouseX: number | null; // ver nota debajo — edge-triggered, no una posición continua
};

export class ArkanoidEngine {
  constructor(width: number, height: number); // 800, 600
  reset(): void; // reinicia partida: score 0, 3 vidas, nivel 1, paddle centrado, pelota sobre el paddle, campo del nivel 1
  update(dt: number, input: ArkanoidInput): void;
  draw(ctx: CanvasRenderingContext2D): void;
  // dibuja paddle/pelota/bloques/explosiones vectoriales + HUD de juego en vivo
  // (SCORE/NIVEL/vidas), igual que el original; NO dibuja overlays de
  // GAME OVER/victoria/pausa (fin de partida lo maneja el modal de la plataforma).
  getState(): ArkanoidState;
}
```

`ArkanoidState` es asignable a `GameEngineState` (`lib/games/types.ts`) — `sfx` es un campo propio de este motor, no parte del contrato compartido; `ArkanoidCanvas` lo lee de `getState()` directamente, sin pasarlo por `onStateChange`.

**Nota sobre `mouseX` (edge-triggered, no continuo):** a diferencia de `left`/`right` (sostenidas), `mouseX` refleja el mismo criterio que "shoot" en Asteroides o el input de Tetris — lo detecta `ArkanoidCanvas` por evento, no el motor. En cada evento `mousemove` sobre el canvas, el componente guarda la coordenada X traducida al espacio lógico 800×600 (mismo escalado DPR/CSS que ya usan los demás motores) y la entrega en el próximo `update()`; si no hubo un `mousemove` nuevo desde el último frame, entrega `null` y el motor deja el control del paddle a `left`/`right`. Esto preserva el comportamiento del original — el mouse pisa la posición del paddle solo cuando efectivamente se mueve, el teclado sigue moviéndolo libremente el resto del tiempo — sin inventar una semántica de "posición continua" que el original tampoco tiene.

**Nota sobre `sfx` (eventos transitorios, no estado):** el motor nunca instancia `Audio`. Durante `update()`, cada vez que la pelota rebota (pared o paddle) o rompe un bloque, empuja el string correspondiente (`"bounce"` / `"break"`) a un buffer interno que `getState()` expone tal cual y que se reinicia vacío al principio del siguiente `update()`. `ArkanoidCanvas` lee `sfx` en cada frame y reproduce los `Audio()` que él mismo posee y precarga — el motor solo reporta _qué sonó_, nunca _cómo_ suena.

**2. Componente canvas** (`components/games/arkanoid/arkanoid-canvas.tsx`):

```tsx
export function ArkanoidCanvas(props: GameCanvasProps): JSX.Element;
```

Mismas responsabilidades que `AsteroidsCanvas`/`TetrisCanvas`: posee el `<canvas>` único (DPR-aware, 800×600 lógicos), el loop `requestAnimationFrame` (`dt` clamp a 50ms, `lastTime` reseteado al reanudar), congelamiento total en pausa, `onStateChange`/`onGameOver` conectados a `getState()`. Además:

- Listener de teclado (`ArrowLeft`/`ArrowRight`, con `preventDefault`) para `left`/`right`.
- Listener de `mousemove` sobre el `<canvas>` que traduce `clientX` a coordenadas lógicas (mismo cálculo de `scaleX` que ya usa el original, adaptado al DPR) y arma `mouseX` para el siguiente frame, edge-triggered como se describió arriba.
- Dos instancias de `Audio` precargadas al montar, apuntando a `/games/arkanoid/sounds/ball-bounce.mp3` y `/games/arkanoid/sounds/break-sound.mp3`; en cada frame, por cada entrada de `getState().sfx`, reproduce vía `.cloneNode().play()` (mismo patrón que el original, permite sonidos superpuestos).
- Cleanup de listeners y `cancelAnimationFrame` al desmontar, igual que los motores existentes.

**3. Assets a copiar:**

```
references/started-games/04-arkanoid/assets/sounds/ball-bounce.mp3  → public/games/arkanoid/sounds/ball-bounce.mp3
references/started-games/04-arkanoid/assets/sounds/break-sound.mp3  → public/games/arkanoid/sounds/break-sound.mp3
```

(El spritesheet `spritesheet-breakout.png` **no** se copia — render 100% vectorial, según lo acordado.)

**4. Fila nueva en Supabase:**

```sql
insert into public.games (slug, title, short, long, cat, cover, color, controls, best, plays)
values (
  'arkanoid', 'ARKANOID',
  'El clásico rompe-bloques, con paddle y pelota de verdad.',
  'Controlá el paddle con teclado o mouse y rebotá la pelota para destruir cinco muros de bloques cada vez más traicioneros. La velocidad crece en cada nivel — superalos todos para ganar de verdad, no solo para sumar puntos.',
  'ARCADE', 'cover-arkanoid', 'magenta', 'teclado', 45000, '1.9K'
);
```

## Implementation plan

1. **Fila de catálogo.** Aplicar el `insert` de la sección anterior con `apply_migration` de Supabase MCP (mostrando el SQL y pidiendo confirmación antes). Verificar después con `execute_sql` que la fila existe con los valores esperados.
2. **Cover art.** Agregar `.cover-arkanoid` (con `::before`/`::after` según haga falta) al bloque `/* Cover art generators */` de `app/globals.css`, paleta magenta distinta de `.cover-bricks` (la portada de `bloque-buster`). `/biblioteca` ya muestra la ficha "ARKANOID" con su propia portada.
3. **Assets de audio.** Copiar `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3` de la referencia a `public/games/arkanoid/sounds/`. Paso aislado, sin ningún código todavía que los consuma.
4. **Copy de victoria en el modal de fin de partida.** Ajustar el modal existente en `components/game-player.tsx` para distinguir `status === "won"` de `status === "gameover"` (mensaje de victoria vs. derrota), cambio acotado a ese condicional. Este paso toca un archivo compartido por todo el catálogo, así que se aísla y se verifica que el resto de los juegos (ninguno reporta `status: "won"` hoy) sigue mostrando exactamente el mismo copy de "fin de partida" que antes.
5. **Motor.** Portar `components/games/arkanoid/engine.ts` desde `references/started-games/04-arkanoid/game.js` + `levels.js`: paddle, pelota, los 5 niveles con sus patrones de bloques y multiplicador de velocidad, colisión AABB (paredes, paddle, bloques), rotura de bloque (+10 pts, empuja `"break"` al buffer `sfx`, dispara la animación de explosión vectorial), rebotes (empujan `"bounce"` al buffer `sfx`), 3 vidas, avance de nivel al vaciar el campo, `status: "won"` tras superar el nivel 5, todo sin `document`/`window`/`ctx`/`Audio` globales. `draw()` dibuja paddle/pelota/bloques como formas vectoriales, la explosión como el efecto de partículas acordado, y el HUD en vivo (SCORE/NIVEL/vidas). Archivo aislado, aún no conectado a ninguna pantalla.
6. **Componente canvas.** Crear `components/games/arkanoid/arkanoid-canvas.tsx`: canvas único DPR-aware, loop `requestAnimationFrame` (`dt` clamp a 50ms, reset de `lastTime` al reanudar), listeners de teclado (`ArrowLeft`/`ArrowRight` con `preventDefault`) y de `mousemove` sobre el canvas (traducido a `mouseX` edge-triggered), dos `Audio` precargados desde `public/games/arkanoid/sounds/` reproducidos según `getState().sfx`, congelamiento total del loop en pausa, `onStateChange`/`onGameOver` conectados, limpieza de listeners y `cancelAnimationFrame` al desmontar. Componente aislado, aún no montado en ninguna pantalla.
7. **Registro.** Agregar `"arkanoid"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`). **Desde este paso, `/juego/arkanoid/jugar` ya es jugable de punta a punta** sin tocar `game-player.tsx` (más allá del paso 4), `score-actions.ts`, `salon-hall.tsx` ni `app/juego/[id]/page.tsx`.
8. **Verificación de leaderboard.** Confirmar que `/salon` y `/juego/arkanoid` muestran datos reales de Supabase para `arkanoid`, y que guardar una puntuación desde el modal de fin de partida (tanto tras perder como tras ganar los 5 niveles) persiste correctamente, respetando el rate-limit de 10s y las reglas de identidad (sesión/`guest_id`) ya existentes sin cambios.
9. **Revisión final.** `npm run lint` y `npm run build` sin errores; recorrido manual completo de `/juego/arkanoid/jugar` — mover el paddle con teclado y con mouse, rebotes con sonido, romper bloques con sonido y animación de explosión vectorial, progreso de los 5 niveles con velocidad creciente, pérdida de vidas, PAUSA congela el juego por completo (sin selector de nivel, sin atajo `P`/`Escape`), FIN fuerza el fin de partida, alcanzar 0 vidas abre el modal con copy de derrota, superar el nivel 5 abre el modal con copy de victoria, GUARDAR PUNTUACIÓN persiste en Supabase en ambos casos, JUGAR DE NUEVO arranca una partida nueva; confirmar en paralelo que `/juego/bloque-buster/jugar`, `/juego/asteroides/jugar`, `/juego/tetris/jugar` y el resto del catálogo siguen funcionando exactamente igual que antes (sin regresiones).

## Acceptance criteria

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La tabla `games` de Supabase tiene una fila nueva `arkanoid` con los valores acordados, verificada vía `execute_sql`.
- [x] `/biblioteca` muestra una ficha nueva "ARKANOID" (portada `.cover-arkanoid`, acento magenta), separada de "BLOQUE BUSTER", que sigue existiendo sin cambios como mock.
- [x] `/juego/arkanoid` (detalle) muestra el copy aprobado, la etiqueta "TECLADO" y la sección "MEJORES PUNTUACIONES" con datos reales de Supabase.
- [x] `/juego/arkanoid/jugar` renderiza el canvas real: paddle controlable con `←`/`→` y con el mouse, pelota que rebota en paredes/paddle (con sonido), bloques que se rompen (+10 pts, sonido, animación de explosión vectorial), los 5 niveles con los patrones del original y velocidad creciente (×1.00 → ×1.46). [^1]
- [x] El HUD dentro del canvas (SCORE/NIVEL/vidas) se ve durante toda la partida, sincronizado con el HUD externo de la plataforma (Puntuación/Vidas/Nivel).
- [x] No existe ningún selector de nivel por click ni atajo `P`/`Escape` — la pausa es exclusivamente el botón de la plataforma.
- [x] El botón "PAUSA" congela el juego por completo (nada se mueve, ni teclado ni mouse responden); "REANUDAR" retoma sin saltos bruscos.
- [x] El botón "FIN" fuerza el fin de partida inmediatamente con el score acumulado.
- [x] Al llegar a 0 vidas, se abre el modal de fin de partida con copy de derrota (`status: "gameover"`).
- [x] Al superar el nivel 5, se abre el mismo modal de fin de partida con copy de victoria (`status: "won"`) — primer juego del Vault que ejercita ese estado. [^1]
- [x] Desde el modal, "GUARDAR PUNTUACIÓN" persiste el score real en Supabase (tabla `scores`, `game_id` de `arkanoid`) tanto tras derrota como tras victoria, respetando el rate-limit de 10s y las reglas de identidad (sesión o invitado). [^1]
- [x] "JUGAR DE NUEVO" arranca una partida nueva desde cero (score 0, 3 vidas, nivel 1, campo del nivel 1), remontando el motor vía `key={resetToken}`.
- [x] `/salon` muestra un tab "ARKANOID" con podio y tabla de datos reales de Supabase, igual que "ASTEROIDES"/"TETRIS"; el resto de los tabs (incluido `bloque-buster`, mock) sigue exactamente igual.
- [x] Los sonidos de rebote/rotura suenan únicamente en `arkanoid`; ningún otro juego del catálogo se ve afectado por los cambios de este spec.
- [x] No hay regresiones en ningún otro juego del catálogo (`bloque-buster`, `asteroides`, `tetris` y el resto de los mock).

[^1]: Las partes específicas de **superar los 5 niveles / `status: "won"` / guardado tras victoria** se verificaron con un script aislado que condujo `ArkanoidEngine` con física real (sin tocar estado privado) hasta limpiar los 5 niveles y confirmar la transición a `"won"`, más revisión de código del ternario del modal y de `guardarPuntuacion` (idéntico sin importar el `status`) — decisión explícita del usuario para no invertir ~5-10 min de tiempo real jugando los 5 niveles vía automatización de browser. El resto de cada criterio (controles, sonido, explosión, derrota, guardado tras derrota, JUGAR DE NUEVO, etc.) sí se verificó jugando partidas reales en el navegador.

## Decisions

- **Sí (heredado):** motor DOM-free (`engine.ts`) envuelto por un componente `"use client"` que posee toda la integración con React/navegador. Mismo split que Asteroides/Tetris.
- **Sí (heredado):** overlays de fin de partida/pausa se eliminan del motor; el modal y el botón de pausa ya existentes de la plataforma manejan ambos flujos.
- **Sí (heredado):** reinicio vía `key={resetToken}` (remount de React), nunca un `reset()` imperativo expuesto por el canvas.
- **Sí (heredado):** mismos controles anti-abuso de SPEC 07 (`CHECK` de rango, rate-limit de 10s, RLS) sin ningún control nuevo específico de este juego.
- **Sí:** ficha nueva y aislada (`id: "arkanoid"`), `bloque-buster` queda intacta y simulada. Mismo precedente que Rocas/Asteroides y Caída/Tetris.
- **Sí:** `color: "magenta"`, único color de la paleta sin usar todavía dentro de ARCADE — diferencia a Arkanoid de `bloque-buster` (cyan) a simple vista.
- **Sí:** render 100% vectorial, sin portar el spritesheet del original. Decisión explícita del usuario — consistencia con el estilo ya establecido por Asteroides/Tetris, sin agregar una dependencia de imagen nueva.
- **No:** portar `spritesheet-breakout.png` y dibujar con `drawImage`. Se consideró en la fase de preguntas pero el usuario prefirió vectorial.
- **Sí:** se porta el audio (`bounceSound`/`breakSound`) bajo `public/games/arkanoid/sounds/`. Decisión explícita del usuario — primer juego real del Vault con sonido. Sin control de volumen/mute (fuera de alcance).
- **Sí:** el motor reporta los sonidos disparados como un buffer transitorio (`sfx`) en su estado, sin instanciar `Audio` él mismo; `ArkanoidCanvas` posee y reproduce los `Audio()`. Mantiene la regla de que el motor nunca toca el DOM/navegador.
- **No:** que el componente canvas infiera los sonidos comparando estado entre frames. Se descartó por duplicar lógica que el motor ya conoce con precisión.
- **Sí:** se agrega una explosión vectorial simple (partículas/círculo que se expande y desvanece) al romper un bloque, en vez de no tener ningún efecto. Decisión explícita del usuario — preserva el feedback visual del original sin depender de sprites.
- **Sí:** controles de teclado (`←`/`→`) y de mouse (`mousemove`), ambos como en el original. Decisión explícita del usuario — primer juego real del Vault con soporte de mouse. `mouseX` se trata como edge-triggered (detectado por el componente canvas, no por el motor), mismo criterio que otras acciones edge-triggered ya establecidas.
- **No:** soporte táctil — `controls: "teclado"`, sin controles on-screen, mismo criterio que Asteroides/Tetris.
- **Sí:** se elimina el selector de nivel por click durante la pausa y el atajo `P`/`Escape`. Decisión explícita del usuario — mismo criterio que Tetris al quitar su atajo `P`; ninguno tiene equivalente en el flujo de pausa de la plataforma.
- **Sí:** se agrega una distinción mínima de copy (`"won"` vs. `"gameover"`) en el modal de fin de partida compartido. Decisión explícita del usuario — primer juego que alcanza `status: "won"`, ya soportado por el contrato pero nunca ejercitado.
- **No:** tratar `"won"` igual que `"gameover"` sin copy especial. Se descartó a favor de distinguir la victoria.
- **Sí:** leaderboard real en Supabase desde este mismo spec, reutilizando sin cambios el mecanismo genérico de SPEC 07. Decisión explícita del usuario.
- **Sí:** slug `"arkanoid"`, coherente con el nombre real del juego portado (mismo criterio que `asteroides`/`tetris`).
- **Sí:** `best: 45000`, `plays: "1.9K"` como placeholders mock, en el mismo orden de magnitud que Asteroides/Tetris.

## Risks

| Risk                                                                                                                                                                             | Mitigation                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una mecánica del original se pierde silenciosamente durante el puerto                                                                                                            | El informe de triage de la Fase 2 queda documentado en la historia de este spec; los criterios de aceptación enumeran explícitamente cada mecánica en alcance                                                   |
| Olvidar la segunda entrada de registro (`components/games/engine-registry.tsx`) después de agregar el slug a `lib/games/registry.ts`                                             | `Record<RealGameSlug, …>` lo convierte en error de compilación de TypeScript, no un gap silencioso en runtime — el paso 7 del plan señala ambas ediciones explícitamente                                        |
| Un score falso "plausible" desde un cliente modificado (riesgo residual heredado de SPEC 07)                                                                                     | Aceptado; la revalidación server-side de la partida sigue fuera de alcance hasta que sea un problema real                                                                                                       |
| Mezclar `mouseX` (edge-triggered) con `left`/`right` sostenidas podría producir un comportamiento levemente errático si el jugador sostiene una flecha y mueve el mouse a la vez | Riesgo aceptado — es fiel al comportamiento ya algo inconsistente del original (dos fuentes de input escribiendo la misma posición); no se agrega arbitraje adicional no solicitado                             |
| Reproducir audio (`.play()`) podría fallar silenciosamente si el navegador bloquea el autoplay antes de cualquier gesto del usuario                                              | Mitigado en la práctica: los sonidos solo se disparan en respuesta a eventos de juego (rebote/rotura), que ocurren después de que el jugador ya interactuó con la pantalla (tecla o mouse) para empezar a jugar |
| Sin spritesheet, la explosión vectorial se ve visualmente más simple que los 4 frames de sprite del original                                                                     | Aceptado — se prioriza consistencia visual con el estilo ya establecido por Asteroides/Tetris por sobre la fidelidad exacta del efecto                                                                          |
| Primer uso real de `status: "won"` en la plataforma — el modal compartido de fin de partida nunca ejercitó ese branch antes                                                      | El paso 4 del plan aísla y verifica ese cambio antes de conectar el motor, confirmando explícitamente que el resto del catálogo (que nunca reporta `"won"`) no se ve afectado                                   |
