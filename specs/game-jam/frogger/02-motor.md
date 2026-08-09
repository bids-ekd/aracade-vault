# SPEC NN — Frogger (juego real)

> **Status:** Draft
> **Depends on:** [05-asteroides-juego-real](../../05-asteroides-juego-real.md), [06-tabla-juegos-supabase](../../06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](../../07-leaderboard-asteroides.md), [08-tetris](../../08-tetris.md), [09-arkanoid](../../09-arkanoid.md), [10-snake](../../10-snake.md)
> **Date:** 2026-08-08
> **Objective:** Construir Frogger desde cero (sin fuente en `references/started-games/` — el juego se escribe apoyado en la mecánica del arcade clásico de 1981) como un motor + componente React/Next.js real en `components/games/frogger/`, agregado vía el registro genérico de motores reales (`lib/games/registry.ts` + `components/games/engine-registry.tsx`), con render 100% vectorial, reloj de partida dibujado dentro del lienzo y leaderboard real en Supabase.

> **Nota de promoción (borrar al promover):** esta spec nació como `specs/game-jam/frogger/02-motor.md`. Al copiarla a `specs/NN-frogger.md` hay que hacer exactamente dos ediciones mecánicas: (1) reemplazar `NN` en el título por el número que corresponda —hoy `ls specs/` llega hasta `10-snake.md`, así que sería **11**—, y (2) cambiar los enlaces de `Depends on` de `../../` a `./`. Nada más: el resto del documento está escrito para valer tal cual. Las reglas de juego que esta spec implementa están en `specs/game-jam/frogger/01-gameplay.md`, que **no** se promueve — si esta spec se aprueba, ese archivo pasa a ser material de referencia histórica y todo lo normativo vive acá.

## Scope

**In:**

- Nueva entrada en el catálogo con motor real: `id: "frogger"`, `title: "FROGGER"`, `short: "El clásico Frogger, jugable de verdad — carretera, río y cinco nenúfares."`, `long: "Cruzá cinco carriles de tráfico y un río de troncos y tortugas para llevar cinco ranas hasta sus nenúfares. Cada nivel acelera el asfalto, hunde más tortugas y te recorta el reloj. Un salto en falso y sos papilla. El quinto juego del Vault con motor real."`, `cat: "ARCADE"`, `color: "yellow"` (primer motor real del Vault en usar amarillo; distinto del magenta de `arkanoid` y del verde de `snake`, los otros dos ARCADE reales, y distinto del verde de `ranaria`, la ficha mock hermana), `cover: "cover-frogger"`, `controls: "teclado"`, `best: 32400`, `plays: "2.3K"`. `ranaria` queda **intacta**, mock, sin ningún cambio.
- Clase CSS nueva `.cover-frogger` en el bloque `/* Cover art generators */` de `app/globals.css`, paleta amarilla/asfalto propia, visualmente distinta de `.cover-rana` (la portada de `ranaria`). Definición literal en `03-arte.md`.
- Motor en TypeScript `components/games/frogger/engine.ts` (sin `document`/`window`/`localStorage`/`Audio`/`Image`): rejilla lógica de 13×13 celdas de 40 px sobre el lienzo 800×600, rana con salto discreto de una celda y `x` continua, 5 carriles de carretera y 5 de río con tráfico **determinista y cíclico** (sin RNG), berma y acera seguras, 5 nenúfares con estado de ocupación, tortugas sumergibles por ciclo desde el nivel 3, reloj de partida decreciente, 3 vidas + vida extra a los 20 000 puntos, mosca bonus, puntuación y curva de dificultad exactamente como las define `01-gameplay.md`. Envuelto en `FroggerEngine` (`reset`/`update`/`draw`/`getState`).
- Render 100% vectorial con primitivas de canvas (rectángulos, círculos, líneas): sin sprites, sin spritesheet, sin `public/games/frogger/`. Mismo criterio estético que `AsteroidsEngine`/`TetrisEngine`/`ArkanoidEngine`.
- HUD en vivo dentro del lienzo (SCORE arriba-izquierda, NIVEL arriba-centro, vidas como ranitas arriba-derecha, **barra de reloj** en la franja inferior), en paralelo con `onStateChange` para el HUD externo (`score`/`lives`/`level`; sin `lines`). El reloj existe **solo** dentro del lienzo — ver Decisions.
- Reporta hacia afuera vía `onStateChange({ score, lives, level, status })` y `onGameOver(finalScore)` una sola vez al llegar a 0 vidas.
- Controles: `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, edge-triggered, **filtrando `e.repeat`**, con `preventDefault` en las cuatro. Sin mouse, sin táctil.
- Componente cliente `components/games/frogger/frogger-canvas.tsx`: canvas único DPR-aware 800×600 lógicos, loop `requestAnimationFrame` (`dt` en segundos, clamp a 50 ms, `lastTime` reseteado al reanudar), listeners de teclado con cleanup, congelamiento total del loop en pausa, `onStateChange`/`onGameOver` conectados a `getState()`.
- Registro: se agrega `"frogger"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`).
- Fila nueva en `public.games` de Supabase para `frogger` (mismo esquema que `asteroides`/`tetris`/`arkanoid`/`snake`), aplicada vía `apply_migration` y verificada con `execute_sql`.
- Leaderboard real: reutiliza sin cambios el mecanismo genérico de SPEC 07 (`guardarPuntuacion`, `getMejoresPuntuaciones`, etc., parametrizados por `gameSlug`/`game_id`), con las mismas reglas anti-abuso (rango, rate-limit de 10 s, RLS).

**Out of scope (para specs futuros):**

- Cualquier cambio a `ranaria` (id, título, copy, cover, comportamiento) — queda intacta y simulada.
- **Cualquier cambio a `lib/games/types.ts` y a `components/game-player.tsx`.** Este spec no agrega ningún campo al contrato compartido ni ninguna tarjeta al HUD externo — el reloj se resuelve dentro del lienzo (ver Decisions).
- Controles táctiles/on-screen — solo teclado, mismo criterio que los cuatro motores reales existentes.
- Sonido/música — no hay assets de audio para este juego y no se generan.
- Elementos del arcade original que quedan fuera a propósito: la rana dama que hay que escoltar (+200), los cocodrilos que asoman en los nenúfares, la serpiente que patrulla la berma y los troncos, y las nutrias. El alcance se recorta a carretera + río + tortugas sumergibles + mosca bonus.
- Estado `status: "won"` — el juego es infinito por diseño y nunca lo reporta.
- Snap de la rana a la columna más cercana al aterrizar — se descarta explícitamente (ver Decisions).
- Ranking global cruzando juegos, anti-cheat real server-side — límites heredados sin cambios de SPEC 07.

## Data model

**1. Contrato público del motor** (`components/games/frogger/engine.ts`):

```ts
export type FroggerState = {
  score: number;
  lives: number; // 3 al empezar; +1 al superar 20 000 puntos (una vez por partida)
  level: number; // 1..∞
  status: "playing" | "gameover";
  // Frogger no tiene "lines" ni estado "won" (los niveles se repiten sin fin) —
  // ambos quedan fuera del tipo en vez de forzados a undefined explícito.
};

export type FroggerInput = {
  // Salto edge-triggered: exactamente una celda por pulsación. frogger-canvas.tsx
  // encola la última dirección pulsada desde el frame anterior y la limpia después
  // de cada update(). null = ninguna tecla nueva este frame.
  hop: "up" | "down" | "left" | "right" | null;
};

export class FroggerEngine {
  constructor(width: number, height: number); // 800, 600

  reset(): void;
  // (re)inicia partida: score 0, 3 vidas, nivel 1, 5 nenúfares libres, reloj lleno
  // (30 s), rana en la acera (fila 12, columna 6), carriles en su fase inicial.

  update(dt: number, input: FroggerInput): void;
  draw(ctx: CanvasRenderingContext2D): void;
  // Dibuja el mapa (nenúfares, río, berma, carretera, acera), las entidades de cada
  // carril, la rana (o su animación de muerte), la mosca bonus si está activa, el HUD
  // en vivo (SCORE/NIVEL/vidas) y la barra de reloj de la franja inferior — mismo
  // patrón que AsteroidsEngine.drawHUD(). NO dibuja overlays de pausa/game over: eso
  // lo resuelve exclusivamente el modal de la plataforma vía `status`.

  getState(): FroggerState;
}
```

`FroggerState` es asignable a `GameEngineState` (`lib/games/types.ts`) sin inventar ninguna forma
paralela y **sin agregarle ningún campo**: el reloj, la ocupación de los nenúfares y la fase de las
tortugas son estado interno del motor que solo se comunica dibujándolo.

**Nota sobre el reloj (por qué no está en el estado):** el arcade original tiene un temporizador por
intento que en esta plataforma no tiene dónde ir — `GameEngineState` admite
`score`/`lives`/`level`/`lines`/`status` y nada más. En vez de extender el contrato compartido, el
motor lo dibuja como una barra dentro de su propio lienzo. La alternativa está evaluada y descartada
en Decisions, con su costo explícito.

**Nota sobre el input edge-triggered:** `frogger-canvas.tsx` **sí filtra `e.repeat`** (a diferencia
de `TetrisCanvas`, que lo deja pasar por fidelidad a su original). Acá el auto-repeat del sistema
operativo dispararía una cadena de saltos de 30 ms de intervalo que mataría a la rana antes de que
el jugador levante el dedo. Mismo criterio que el `shoot` de `AsteroidsCanvas`. Además, el motor
ignora cualquier `hop` que llegue mientras un salto está en curso (ventana de 110 ms) o durante la
animación de muerte (700 ms): el componente puede encolar libremente, el motor arbitra.

**2. Geometría del lienzo** (constantes del motor, todas privadas):

| Constante  | Valor      | Nota                                                                |
| ---------- | ---------- | ------------------------------------------------------------------- |
| `CELL`     | 40 px      | Lado de celda; también el desplazamiento exacto de un salto.        |
| `COLS`     | 13         | 13 × 40 = 520 px de ancho de tablero.                               |
| `ROWS`     | 13         | 13 × 40 = 520 px de alto de tablero.                                |
| `OFFSET_X` | 140 px     | Centra el tablero: `(800 − 520) / 2`. Área jugable: x ∈ [140, 660]. |
| `OFFSET_Y` | 44 px      | Deja 44 px arriba para el HUD de texto y 36 px abajo para el reloj. |
| `FROG`     | 30 × 30 px | Caja de colisión de la rana, centrada en su posición.               |
| `HOP_MS`   | 110 ms     | Duración del salto; el input se ignora mientras dura.               |
| `DEATH_MS` | 700 ms     | Animación de muerte; el mundo sigue moviéndose, el input se ignora. |

**3. Componente canvas** (`components/games/frogger/frogger-canvas.tsx`):

```tsx
export function FroggerCanvas(props: GameCanvasProps): JSX.Element;
```

Mismas responsabilidades que `AsteroidsCanvas`/`SnakeCanvas`: posee el `<canvas>` único (DPR-aware,
800×600 lógicos), el loop `requestAnimationFrame` (`dt` clamp a 50 ms, `lastTime` reseteado al
reanudar), los listeners de teclado con cleanup, el congelamiento total del loop cuando `paused` es
`true`, y `onStateChange`/`onGameOver` derivados de `getState()`. No precarga ningún asset: el
render es 100% vectorial, así que el loop arranca en el primer frame sin esperar nada.

**4. Fila nueva en Supabase** (autoridad: [04-catalogo](./04-catalogo.md); reproducida acá literal
para que esta spec sea promovible tal cual):

```sql
insert into public.games (slug, title, short, long, cat, cover, color, controls, best, plays)
values (
  'frogger', 'FROGGER',
  'El clásico Frogger, jugable de verdad — carretera, río y cinco nenúfares.',
  'Cruzá cinco carriles de tráfico y un río de troncos y tortugas para llevar cinco ranas hasta sus nenúfares. Cada nivel acelera el asfalto, hunde más tortugas y te recorta el reloj. Un salto en falso y sos papilla. El quinto juego del Vault con motor real.',
  'ARCADE', 'cover-frogger', 'yellow', 'teclado', 32400, '2.3K'
);
```

## Implementation plan

1. **Fila de catálogo.** Aplicar el `insert` de la sección anterior con `apply_migration` de Supabase
   MCP (mostrando el SQL y pidiendo confirmación antes). Verificar después con `execute_sql` que la
   fila existe con los valores esperados. Desde este paso, `/biblioteca` y `/juego/frogger` ya
   muestran la ficha (todavía sin motor: cae al reproductor mock).
2. **Cover art.** Agregar `.cover-frogger` (con `::before`/`::after`) al bloque
   `/* Cover art generators */` de `app/globals.css`, con la definición exacta de `03-arte.md`:
   paleta asfalto + amarillo, visualmente distinta de `.cover-rana` (la portada de `ranaria`).
   Verificar en `/biblioteca` que las dos fichas se distinguen a simple vista.
3. **Motor — mapa y carriles.** Crear `components/games/frogger/engine.ts` con la geometría de la
   tabla de arriba, la definición declarativa de los 10 carriles (fila, tipo, sentido, velocidad
   base, cantidad y ancho de entidades) y el avance cíclico determinista: cada carril mantiene un
   offset que avanza `velocidad × multiplicadorDeNivel × dt` y se envuelve con módulo sobre la
   longitud de su tira. `draw()` dibuja mapa + carriles. Sin rana todavía: se verifica visualmente
   que el tráfico circula parejo y sin huecos imposibles.
4. **Motor — rana, colisiones y muerte.** Agregar la rana (posición continua en `x`, fila discreta
   en `y`), el salto de una celda con tween de `HOP_MS` (rechazando los que salgan del tablero),
   la colisión AABB contra vehículos, la regla de apoyo por centro sobre troncos/tortugas, el
   arrastre en el río, el ahogo, la salida por los bordes, la animación de muerte de `DEATH_MS` y
   la reaparición en la acera. Las seis formas de muerte de `01-gameplay.md` quedan cubiertas acá.
5. **Motor — nenúfares, reloj, puntuación y niveles.** Ocupación de los 5 nenúfares con su
   tolerancia de encaje, matorral y nenúfar ocupado como muerte, reloj decreciente por nivel con
   reinicio en cada intento, tortugas sumergibles (nivel ≥ 3 y ≥ 5, con fases desfasadas), mosca
   bonus, la tabla de puntuación completa, la vida extra a los 20 000, el avance de nivel al
   completar los 5 nenúfares y `status: "gameover"` a 0 vidas. `draw()` suma el HUD en lienzo
   (SCORE/NIVEL/vidas) y la barra de reloj. Archivo aislado, aún no conectado a ninguna pantalla.
6. **Componente canvas.** Crear `components/games/frogger/frogger-canvas.tsx`: canvas único
   DPR-aware, loop `requestAnimationFrame` con `dt` clamp a 50 ms y reset de `lastTime` al reanudar,
   listener de teclado con las 4 flechas (`preventDefault`, **filtrando `e.repeat`**) que encola el
   `hop` para el siguiente `update()`, congelamiento total del loop en pausa, `onStateChange` /
   `onGameOver` desde `getState()`, limpieza de listeners y `cancelAnimationFrame` al desmontar.
   Componente aislado, aún no montado en ninguna pantalla.
7. **Registro.** Agregar `"frogger"` a `REAL_GAME_SLUGS` (`lib/games/registry.ts`) y su entrada
   `dynamic()` a `GAME_ENGINES` (`components/games/engine-registry.tsx`). **Desde este paso,
   `/juego/frogger/jugar` ya es jugable de punta a punta** sin tocar `game-player.tsx`,
   `score-actions.ts`, `salon-hall.tsx` ni `app/juego/[id]/page.tsx`.
8. **Verificación de leaderboard.** Confirmar que `/salon` y `/juego/frogger` muestran datos reales
   de Supabase para `frogger`, y que guardar una puntuación desde el modal de fin de partida
   persiste correctamente, respetando el rate-limit de 10 s y las reglas de identidad
   (sesión/`guest_id`) ya existentes sin cambios.
9. **Revisión final.** `npm run lint` y `npm run build` sin errores; recorrido manual completo de
   `/juego/frogger/jugar` — saltar en las cuatro direcciones, morir de las seis formas posibles,
   montar troncos y tortugas, ver hundirse las tortugas a partir del nivel 3, llenar los 5
   nenúfares y subir de nivel, cobrar la mosca bonus, agotar el reloj, verificar la vida extra a los
   20 000, HUD externo (Puntuación/Vidas/Nivel, sin tarjeta de Líneas) sincronizado con el HUD en
   lienzo, PAUSA congela todo (incluido el reloj), FIN fuerza el fin de partida, GUARDAR PUNTUACIÓN
   persiste en Supabase, JUGAR DE NUEVO arranca una partida nueva; confirmar en paralelo que
   `/juego/ranaria/jugar`, los cuatro motores reales existentes y el resto del catálogo siguen
   funcionando exactamente igual que antes (sin regresiones).

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La tabla `games` de Supabase tiene una fila nueva `frogger` con los valores acordados,
      verificada vía `execute_sql`.
- [ ] `/biblioteca` muestra una ficha nueva "FROGGER" (portada `.cover-frogger`, acento amarillo),
      separada de "RANARIA", que sigue existiendo sin cambios como mock.
- [ ] `/juego/frogger` (detalle) muestra el copy aprobado, la etiqueta "TECLADO" y la sección
      "MEJORES PUNTUACIONES" con datos reales de Supabase.
- [ ] `/juego/frogger/jugar` renderiza el canvas real: la rana salta exactamente una celda por
      pulsación en las cuatro direcciones, los saltos que la sacarían del tablero se rechazan sin
      matarla, y mantener una flecha pulsada **no** encadena saltos (se filtra `e.repeat`).
- [ ] Los 5 carriles de carretera circulan con tráfico determinista y cíclico; el contacto con
      cualquier vehículo mata al instante.
- [ ] En los 5 carriles de río, la rana se ahoga si el centro de su caja no cae sobre un tronco o
      tortuga, y es arrastrada por la plataforma cuando sí lo hace.
- [ ] Ser arrastrada fuera del área jugable por izquierda o derecha mata.
- [ ] Desde el nivel 3 la fila 2 de tortugas se sumerge en ciclo (con aviso visual antes de matar) y
      desde el nivel 5 también lo hace la fila 5, desfasada — nunca se hunden las dos a la vez.
- [ ] Los nenúfares se ocupan de a uno; aterrizar en el matorral o en un nenúfar ya ocupado mata;
      completar los cinco avanza de nivel, vacía los nenúfares y acelera todos los carriles.
- [ ] La puntuación sigue exactamente la tabla de `01-gameplay.md` (+10 por fila nueva, +50 por
      nenúfar, +10 por segundo restante, +200 por mosca, +1000 × nivel al completar) y **nunca
      baja**.
- [ ] La vida extra a los 20 000 puntos se otorga una sola vez por partida.
- [ ] El reloj se dibuja como barra dentro del lienzo, se reinicia al meter una rana, al morir y al
      subir de nivel, y llegar a 0 cuesta una vida.
- [ ] `lib/games/types.ts` y `components/game-player.tsx` **no se modifican en este spec** — el HUD
      externo muestra Puntuación, Vidas y Nivel usando las tarjetas que ya existen, sin ninguna
      tarjeta nueva.
- [ ] El HUD externo (`player-hud`) muestra Puntuación, Vidas y Nivel — sin tarjeta de Líneas —
      sincronizado en todo momento con el HUD que el propio canvas dibuja.
- [ ] PAUSA congela el juego por completo (tráfico, río, reloj y animaciones detenidos; el teclado
      no responde); REANUDAR retoma sin saltos bruscos de física.
- [ ] El botón "FIN" fuerza el fin de partida con el score acumulado, abriendo el modal.
- [ ] Al llegar a 0 vidas, el motor reporta `status: "gameover"` y se abre el modal de fin de
      partida; el motor **nunca** reporta `status: "won"`.
- [ ] Desde el modal, "GUARDAR PUNTUACIÓN" persiste el score real en Supabase (tabla `scores`,
      `game_id` de `frogger`), respetando el rate-limit de 10 s y las reglas de identidad.
- [ ] "JUGAR DE NUEVO" arranca una partida nueva desde cero (score 0, 3 vidas, nivel 1, nenúfares
      libres, reloj lleno), remontando el motor vía `key={resetToken}`.
- [ ] `/salon` muestra un tab "FROGGER" con podio y tabla de datos reales de Supabase, igual que
      "ASTEROIDES"/"TETRIS"/"ARKANOID"/"SNAKE"; el resto de los tabs (incluido `ranaria`, mock)
      sigue exactamente igual.
- [ ] No existe `public/games/frogger/` — el juego no carga ningún asset.
- [ ] No hay regresiones en ningún otro juego del catálogo (`ranaria`, los cuatro motores reales y
      el resto de los mock).

## Decisions

- **Sí:** ficha nueva y aislada (`id: "frogger"`), `ranaria` queda intacta y simulada. Mismo
  precedente que Rocas/Asteroides, Caída/Tetris, Bloque Buster/Arkanoid y Serpentina/Snake.
- **Sí:** título **"FROGGER"** (nombre real, sin traducir), mismo criterio que
  TETRIS/ARKANOID/SNAKE, y sin riesgo de confundirse con "RANARIA".
- **Sí:** `color: "yellow"`. Es el único color de la paleta **sin ningún motor real** en todo el
  catálogo, diferencia a `frogger` de los otros dos ARCADE reales (`arkanoid` magenta, `snake`
  verde) y de la ficha mock hermana `ranaria` (verde), y es el color temático correcto: las líneas
  de carril del asfalto. Nota para el revisor: `references/game-suggetions-todo.md` registra que
  `yellow` está disputado por `space-invaders` y otros 6 candidatos pendientes — aprobar este spec
  implica que ese conflicto se resuelve a favor de Frogger y que un futuro `space-invaders` deberá
  usar otro color.
- **No:** `color: "cyan"`. Se evaluó para dejar `yellow` libre a `space-invaders`, pero cyan ya lo
  usan dos motores reales (`asteroides`, `tetris`) y además choca visualmente con `.cover-rana`, que
  dibuja sus carriles justamente en cyan — las dos fichas quedarían casi iguales en `/biblioteca`.
- **Sí:** el reloj de partida se dibuja **dentro del lienzo** como una barra, y `GameEngineState`
  queda sin tocar. Es lo que convierte a Frogger de "candidato postergado" a "candidato viable": el
  motivo por el que `game-planner` lo dejó en segundo lugar el 2026-08-08 era precisamente que el
  temporizador no cabía en el contrato.
- **No:** extender `lib/games/types.ts` con un campo `time`/`timer` y agregar una tarjeta nueva al
  HUD externo de `components/game-player.tsx`. Está evaluado y descartado. **Costo si el usuario lo
  prefiere igual:** un campo opcional nuevo en `GameEngineState`, un bloque JSX condicional en
  `game-player.tsx` y una clase `.hud-stat.time` en `app/globals.css` — exactamente el mismo trabajo
  que hizo SPEC 08 para la tarjeta "Líneas", con el mismo riesgo (dos archivos compartidos por las
  10 fichas del catálogo) y un paso de plan aislado para verificar que ningún otro juego la muestra.
  Se descarta porque el reloj de Frogger es información de tensión momento a momento —se lee de
  reojo, sin apartar la vista del tráfico— y funciona mejor pegado a la acción que en una tarjeta
  fuera del marco CRT.
- **Sí:** la rana conserva su `x` continua y **nunca** hace snap a la columna más cercana al
  aterrizar. Es el comportamiento del arcade original y lo que hace que encajar en un nenúfar sea
  una habilidad; el snap convertiría el río en un trámite.
- **No:** alinear la rana a la grilla al aterrizar. Descartado por lo anterior, aunque simplificaría
  la detección de encaje en los nenúfares.
- **Sí:** el salto es **absoluto respecto del mundo**: durante los 110 ms de tween la rana no está
  montada en nada y la plataforma de origen sigue sin ella. Es fiel al original y mantiene la física
  del salto independiente del carril.
- **Sí:** apoyo sobre troncos/tortugas resuelto **por el centro** de la caja de la rana, no por
  solapamiento parcial. Es la regla más simple de implementar, de explicar y de leer en pantalla, y
  evita tanto el "flotar apoyado en un píxel" como el "caerse estando visiblemente encima".
- **Sí:** tráfico **determinista y cíclico** (N entidades por carril repartidas a intervalos iguales
  sobre una tira que envuelve), sin generación procedural ni RNG. Garantiza que ningún carril quede
  sin huecos transitables y que dos partidas del mismo nivel sean comparables — importante para un
  juego cuya tabla `scores` es pública. La única aleatoriedad del juego es la mosca bonus.
- **Sí:** input edge-triggered **filtrando `e.repeat`**, a diferencia de Tetris. Acá el auto-repeat
  del sistema operativo mataría a la rana; mismo criterio que el `shoot` de Asteroides.
- **Sí:** render 100% vectorial, sin sprites ni `public/games/frogger/`. Consistente con
  Asteroides/Tetris/Arkanoid; a diferencia de Snake, acá no hay ningún asset provisto que aproveche.
- **No:** sonido. No hay assets de audio para este juego y este spec no genera ninguno (Arkanoid
  sigue siendo el único juego real con audio).
- **Sí:** el juego es **infinito**, sin `status: "won"`. Los niveles se repiten con multiplicador de
  velocidad creciente hasta un tope de ×2.00 y un reloj con piso de 20 s; por encima de eso el
  carril más rápido dejaría huecos que un salto de 110 ms no puede aprovechar.
- **Sí:** alcance recortado a carretera + río + tortugas sumergibles + mosca bonus. La rana dama,
  los cocodrilos, la serpiente y las nutrias quedan fuera: ninguno cambia la estructura del juego y
  cada uno agrega una máquina de estados propia.
- **Sí (heredado):** motor DOM-free (`engine.ts`) envuelto por un componente `"use client"` que
  posee toda la integración con React/navegador. Mismo split que Asteroides/Tetris/Arkanoid/Snake.
- **Sí (heredado):** overlays de fin de partida/pausa se eliminan del motor; el modal y el botón de
  pausa ya existentes de la plataforma manejan ambos flujos vía `status`.
- **Sí (heredado):** reinicio vía `key={resetToken}` (remount de React), nunca un `reset()`
  imperativo expuesto por el canvas.
- **Sí (heredado):** leaderboard real desde este mismo spec, reutilizando sin cambios el mecanismo
  genérico de SPEC 07, con los mismos controles anti-abuso (`CHECK` de rango, rate-limit de 10 s,
  RLS atando `user_id` a `auth.uid()`) sin ningún control nuevo específico de este juego.

## Risks

| Risk                                                                                                                                                                                                        | Mitigation                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El reloj de partida no cabe en `GameEngineState` y la solución obvia (extenderlo) tocaría dos archivos compartidos por las 10 fichas del catálogo                                                           | Se dibuja dentro del lienzo, mismo patrón que `AsteroidsEngine.drawHUD()`. Un criterio de aceptación explícito verifica que `lib/games/types.ts` y `components/game-player.tsx` quedan sin modificar; el costo de la alternativa está cuantificado en Decisions por si el usuario la prefiere |
| Mezclar salto discreto (celdas) con arrastre continuo (`x` flotante sobre el río) produce los bugs clásicos del género: quedar medio fuera de un nenúfar, o "flotar" sobre el borde de un tronco            | Una sola regla de apoyo/encaje para todo el juego —el **centro** de la caja de la rana— aplicada igual a troncos, tortugas y nenúfares; los pasos 4 y 5 del plan la implementan juntas y el recorrido manual del paso 9 la ejercita en los dos regímenes                                      |
| A ×2.00 de multiplicador el carril más rápido llega a 380 px/s: con `dt` clampeado a 50 ms, un vehículo avanza hasta 19 px por frame y podría "saltarse" a la rana si las cajas fueran chicas (_tunneling_) | Los vehículos miden 40 px o más y la rana 30 px: 19 px de avance por frame no alcanza para atravesar el solapamiento. El tope de ×2.00 está fijado, entre otras razones, para preservar ese margen — subirlo exigiría colisión por barrido, que este spec no implementa                       |
| Una rejilla de 13×13 celdas de 40 px (520×520) no llena el lienzo lógico 800×600 y podría verse descentrada o con bandas muertas                                                                            | La geometría está fijada en el Data model (`OFFSET_X` 140, `OFFSET_Y` 44): las bandas no son huecos, son el espacio donde viven el HUD de texto (arriba) y la barra de reloj (abajo). El paso 3 del plan verifica el encuadre antes de agregar ninguna mecánica                               |
| El tráfico cíclico determinista podría generar, en algún nivel, un carril cuyos huecos no se alineen nunca con los del carril siguiente, volviendo el nivel injugable                                       | Al ser determinista se puede verificar de una sola vez por nivel en vez de esperar a que aparezca un caso malo; velocidades y cantidades por carril están fijadas en `01-gameplay.md` y el paso 9 del plan incluye completar niveles reales, no solo probar mecánicas sueltas                 |
| Con `e.repeat` filtrado, un jugador que pulse muy rápido podría perder una pulsación si dos `keydown` caen en el mismo frame de 16 ms                                                                       | Riesgo aceptado como despreciable: el propio salto dura 110 ms, así que cualquier segunda pulsación dentro del mismo frame habría sido ignorada igual por estar el salto en curso                                                                                                             |
| ARCADE pasa a tener 3 de 5 motores reales y `frogger` se queda con `yellow`, disputado por 7 candidatos pendientes del To Do de `game-planner`                                                              | Señalado explícitamente en Decisions y en `00-concepto.md` para que la aprobación de esta spec sea también la resolución consciente de ese conflicto, no un efecto colateral                                                                                                                  |
| Olvidar la segunda entrada de registro (`components/games/engine-registry.tsx`) después de agregar el slug a `lib/games/registry.ts`                                                                        | `Record<RealGameSlug, …>` lo convierte en error de compilación de TypeScript, no un gap silencioso en runtime — el paso 7 del plan señala ambas ediciones explícitamente                                                                                                                      |
| Un score falso "plausible" desde un cliente modificado (mismo riesgo residual heredado de SPEC 07)                                                                                                          | Aceptado; la revalidación server-side de la partida sigue fuera de alcance hasta que sea un problema real                                                                                                                                                                                     |
