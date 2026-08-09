# To Do — Sugerencias de juego (game-planner)

Memoria persistente del agente `game-planner`. Un ítem por juego sugerido, movido de sección según
avanza. No borres ítems: los descartes son el valor de este archivo.

## Pendientes

- [ ] **Space Invaders** (`space-invaders`) — juego nuevo (mock hermano: `invasores`) — **RECOMENDADO
      2026-08-08**: cabe entero en `score`/`lives`/`level` sin tocar la plataforma, teclado puro
      (←/→ + Space edge-triggered), se dibuja con primitivas de canvas, estrena el color `yellow`
      (libre entre los reales) y no repite mecánica con Asteroides (cañón fijo + formación
      descendente vs. inercia y rotación 360°) — 2026-08-08
- [ ] **Frogger** (`frogger`) — juego nuevo (mock hermano: `ranaria`) — segunda opción: score
      monótono y teclado puro, pero el temporizador por vida no cabe en `GameEngineState` y ARCADE
      ya es la categoría más representada (arkanoid + snake) — 2026-08-08
- [ ] **Pac-Man** (`pacman`) — juego nuevo (mock hermano: `gloton`) — encaje perfecto de HUD
      (score/lives/level) y de leaderboard, pero es el port más caro del catálogo: datos de
      laberinto, 4 IAs de fantasma con personalidad, ciclos scatter/chase, túnel y modo píldora.
      Diferir hasta tener presupuesto de spec grande — 2026-08-08
- [ ] **Puzzle Bobble** (`puzzle-bobble`) — juego nuevo (sin mock hermano) — PUZZLE · magenta ·
      complejidad alta — único candidato que llenaría el hueco de PUZZLE sin repetir el
      apilar-piezas de Tetris, pero exige grilla hexagonal, detección de clusters y huérfanos, y
      apuntado con mouse: coste alto para el beneficio. Re-evaluado en el lote de 20 candidatos de
      abajo, misma conclusión — 2026-08-08

### Lote paralelo — 20 candidatos, 5 agentes concurrentes (2026-08-08)

Evaluación en bloque: 5 instancias de `game-planner` en paralelo, una por género, 4 candidatos cada
una. Top por género marcado ⭐; top global del lote: **2048** (menor costo/beneficio de los 20).
**Conflicto de color a resolver**: `yellow` es el único libre entre los 4 motores reales y lo piden
7 candidatos de este lote más `space-invaders` (ya pendiente arriba) — solo uno puede quedárselo.

**SHOOTER/espacial:**

- [ ] **Centipede** ⭐ (`centipede`) — juego nuevo — SHOOTER · green · complejidad media — campo
      destructible (hongos + segmentos), único del lote que no toca `lib/games/types.ts` ni duplica
      mecánica de un real — 2026-08-08
- [ ] **Missile Command** (`missile-command`) — juego nuevo — SHOOTER · yellow · complejidad
      baja-media — el motor más barato del lote, pero exige mouse en 2 ejes + click, input nuevo
      para la plataforma — 2026-08-08
- [ ] **Galaga** (`galaga`) — juego nuevo — SHOOTER · magenta · complejidad alta — se solapa con
      Space Invaders (cañón horizontal + formación descendente), ya pendiente arriba: hacer uno u
      otro, no ambos — 2026-08-08
- [ ] **Defender** (`defender`) — juego nuevo — SHOOTER · cyan · complejidad alta — exige dos
      sistemas de coordenadas (mundo/pantalla) con scroll y wrap horizontal, el más caro del lote —
      2026-08-08

**Laberinto/persecución:**

- [ ] **Q\*bert** ⭐ (`qbert`) — juego nuevo — ARCADE · magenta · complejidad media (con alcance
      recortado a bolas rojas + Coily) — salto discreto entre cubos, mejor encaje de HUD del lote;
      riesgo en la proyección isométrica y el "salto al vacío" — 2026-08-08
- [ ] **Dig Dug** (`dig-dug`) — juego nuevo — ARCADE · yellow · complejidad alta — terreno
      excavable mutable sobre el que hacen pathfinding los enemigos, más rocas que caen en cadena —
      2026-08-08
- [ ] **Lode Runner** (`lode-runner`) — juego nuevo — PUZZLE · green · complejidad alta — dos
      máquinas de estado simultáneas (ciclo de vida del agujero cavado + comportamiento del
      guardia) y niveles autorados a mano, sin generación procedural — 2026-08-08
- [ ] **Bomberman** (`bomberman`) — juego nuevo — ARCADE · cyan · complejidad media — solo viable
      en modo campaña 1P (el versus local rompe el criterio de leaderboard, igual que
      `duelo-pixel`); el reloj de nivel del original no cabe en `GameEngineState` — 2026-08-08

**Puzzle:**

- [ ] **2048** ⭐ (`2048`) — juego nuevo — PUZZLE · yellow · complejidad baja — cero assets, `dt`
      solo anima el tween, `score` estrictamente monótono; mejor ratio valor/costo de los 20
      candidatos del lote — 2026-08-08
- [ ] **Match-3 / Gemas** (`gemas`) — juego nuevo — PUZZLE · magenta o cyan · complejidad media —
      el temporizador clásico de 60s no cabe en el contrato (obliga a modo "por movimientos" o "por
      objetivo"); zona gris con el criterio de no duplicar la caída por gravedad de Tetris —
      2026-08-08
- [ ] **Pipe Mania / Tuberías** (`tuberias`) — juego nuevo — PUZZLE · green · complejidad media —
      recorrido de fluido por 6 tipos de tubo con reglas de colocación; el candidato menos
      reconocible del lote para el usuario — 2026-08-08

**Versus/deportivo:**

- [ ] **Combate de Tanques** ⭐ (`combate-tanques`) — juego nuevo — VERSUS · green · complejidad
      media-alta — único candidato versus con camino honesto a score monótono (modo campaña contra
      oleadas de tanques CPU); llenaría VERSUS, hoy sin motor real — 2026-08-08
- [ ] **Air Hockey** (`air-hockey`) — juego nuevo — VERSUS · magenta · complejidad baja-media —
      riesgo de *tunneling* del disco a alta velocidad con `dt` clampeado a 50ms; se solapa con la
      física de pelota+paddle de Arkanoid — 2026-08-08
- [ ] **Atletismo / Track & Field** (`atletismo`) — juego nuevo — VERSUS · cyan · complejidad
      media-alta — mejor encaje de leaderboard del bloque versus (score = metros/puntos, monótono),
      pero su identidad "versus" es débil: rankea contra el marcador, no contra un rival en vivo —
      2026-08-08
- [ ] **Boxeo Neón** (`boxeo-neon`) — juego nuevo — VERSUS · yellow · complejidad alta — peor
      ratio costo/beneficio del bloque versus; el reloj de round no cabe en `GameEngineState` y
      necesita sprites que no existen en `references/sources-assets/` — 2026-08-08

  Nota transversal a los 4 candidatos versus: `GameCanvasProps.onGameOver` reporta un solo número y
  `lib/supabase/scores.ts` rankea una identidad de jugador — ninguno tiene concepto de "jugador 2"
  nativo. Todos requieren declarar en la spec un modo principal 1P-contra-CPU como el que puntúa.

**Plataformas/acción:**

- [ ] **Saltarín** ⭐ (`saltarin`) — juego nuevo — ARCADE · yellow · complejidad media-baja — torre
      ascendente infinita; `score = maxAlturaAlcanzada` es monótono y de rango amplio, el mejor
      comportamiento de leaderboard del lote de plataformas — 2026-08-08
- [ ] **Barriles / Donkey Kong** (`barriles`) — juego nuevo — ARCADE · yellow · complejidad alta —
      el más icónico y el único que llena `score`+`lives`+`level`+`status:"won"` sin extender el
      contrato, pero sin fuente de referencia y con una máquina de estados grande
      (caminar/escalar/saltar) — 2026-08-08
- [ ] **Propulsor** (`propulsor`) — juego nuevo — ARCADE · cyan · complejidad baja — motor mínimo
      de una tecla, pero se solapa mecánicamente con `saltarin` (mismo bucle de esquivar en un eje
      con auto-scroll) — 2026-08-08
- [ ] **Topos** (`topos`) — juego nuevo — ARCADE · green · complejidad baja — input de mouse, no
      teclado; conversión de coordenadas tiene que vivir en el componente canvas, no en `engine.ts`
      — 2026-08-08

## En spec

## Implementados

- [x] **Asteroids** (`asteroides`) — SPEC 05 · SHOOTER · cyan — 2026-08-08
- [x] **Tetris** (`tetris`) — SPEC 08 · PUZZLE · cyan — 2026-08-08
- [x] **Arkanoid** (`arkanoid`) — SPEC 09 · ARCADE · magenta — 2026-08-08
- [x] **Snake** (`snake`) — SPEC 10 · ARCADE · green — 2026-08-08

## Descartados

- [x] ~~**Pong / Duelo Pixel** (`duelo-pixel`, `pong`)~~ — rompe el criterio de leaderboard: un 1v1
      local no produce un score numérico monótono de un solo jugador que la tabla `scores` pueda
      rankear (el "score" es un marcador a 11, no una progresión). Único candidato VERSUS del
      catálogo, y por eso esa categoría se queda sin motor real por diseño — 2026-08-08
- [x] ~~**Columns / Dr. Mario** (`columns`)~~ — duplica la mecánica de apilar-piezas-que-caen de
      Tetris (criterio 7), aunque el matching por color sea distinto — 2026-08-08
- [x] ~~**Breakout / Bloque Buster** (`bloque-buster`)~~ — duplica la mecánica rompe-bloques de
      Arkanoid, ya implementado (criterio 7) — 2026-08-08
