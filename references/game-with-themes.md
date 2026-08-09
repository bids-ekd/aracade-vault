# Juegos con skins — Arcade Vault (skin-designer)

Memoria persistente del agente `skin-designer`. Un juego a la vez: cada corrida trabaja el slug que
el usuario indique y actualiza solo su fila. Se auto-corrige en cada corrida contra
`REAL_GAME_SLUGS`. No borres filas ni decisiones: actualízalas.

## Estado por juego

| Juego      | clasico/dark | clasico/light | neon/dark | neon/light | retro/dark | retro/light | Última revisión |
| ---------- | ------------ | ------------- | --------- | ---------- | ---------- | ----------- | --------------- |
| snake      | ✅           | ✅            | ✅        | ✅         | ✅         | ✅          | 2026-08-09      |
| tetris     | ❌           | ❌            | ❌        | ❌         | ❌         | ❌          | —               |
| asteroides | ✅           | ✅            | ✅        | ✅         | ✅         | ✅          | 2026-08-09      |
| arkanoid   | ✅           | ✅            | ✅        | ✅         | ✅         | ✅          | 2026-08-09      |

## Paletas

Hex canónicos de cada skin y modo — fuente de verdad de `lib/games/skins.ts`. Se llenan la primera
vez que un juego fija cada skin; los siguientes juegos las reutilizan **tal cual**, no las
reinterpretan: la identidad de una skin es de la plataforma, no de un juego.

Invariante de `ramp` (7 entradas en las tres skins): las **3 primeras** no colisionan con
`primary`/`accent`/`danger`, porque Asteroides las usa para los tamaños de asteroide
(`ramp[size - 1]`). Tetris (7 piezas) y Arkanoid (filas) pueden indexar la rampa entera.

Contraste medido con la fórmula WCAG 2.1 contra el `bg` de cada entrada. `ink` y `accent` se usan
como texto del HUD interno del canvas, así que ambos cumplen ≥ 4.5:1; `primary`, `danger` y todas
las entradas de `ramp` cumplen ≥ 3:1.

**snake** (2026-08-09) reutilizó las tres skins tal cual, sin retocar un solo hex, y midió además
dos cosas que no estaban registradas: `inkDim` cumple ≥ 6.12:1 contra su `bg` en las 6
combinaciones (por eso puede usarse como texto secundario del HUD interno, no solo como detalle), y
`ramp[0]` cumple ≥ 5.01:1 en las 6.

### clasico

Fijada por **asteroides** (2026-08-09). Reusa los tokens de `:root` / `:root[data-theme="light"]`
de `app/globals.css`: es el look actual de Arcade Vault, baseline de coste cero.

- dark: bg `#0a0a0f`, grid `#15151f`, ink `#e6e9ff` (16.43:1), inkDim `#8a8fb5`, primary `#e6e9ff`
  (16.43:1), accent `#00f5ff` (14.58:1), danger `#ff006e` (5.15:1), glow `8`,
  ramp `#ffcf3a` `#00ff88` `#c77dff` `#f5ff00` `#4d7cff` `#ff9e00` `#c7d0e0` (5.31–18.05:1)
- light: bg `#f2f3fa`, grid `#d6dae8`, ink `#12142a` (16.37:1), inkDim `#464b6b`, primary `#1b1f3b`
  (14.53:1), accent `#00697a` (5.75:1), danger `#b8004f` (6.02:1), glow `0`,
  ramp `#8a6100` `#0a7a45` `#6a3fb5` `#7a7000` `#2a4fb5` `#a35200` `#5a6474` (4.58–6.58:1)

### neon

Fijada por **asteroides** (2026-08-09). Saturación máxima, fondo casi negro con tinte violeta y el
único `glow` alto del set: la legibilidad viene del halo.

- dark: bg `#0a0014`, grid `#1b0b33`, ink `#f4e9ff` (17.54:1), inkDim `#b98fe6`, primary `#00f0ff`
  (14.57:1), accent `#ff00e5` (6.24:1), danger `#ff2d55` (5.63:1), glow `18`,
  ramp `#c77dff` `#39ff14` `#ffe600` `#9d7bff` `#ff8a00` `#00f0ff` `#ff00e5` (6.24–16.20:1)
- light: bg `#f7f2ff`, grid `#ded0f5`, ink `#1a0a2e` (16.95:1), inkDim `#5a3a80`, primary `#00768a`
  (4.83:1), accent `#c400b0` (4.81:1), danger `#d1003c` (5.06:1), glow `0`,
  ramp `#7a1fd6` `#2e7d00` `#8f5f00` `#5b3fd6` `#a34a00` `#00768a` `#c400b0` (4.81–6.38:1)

### retro

Fijada por **asteroides** (2026-08-09). CRT de fósforo ámbar con acento verde P1, paleta corta a
propósito (6 colores, con entradas repetidas en la rampa) y `glow` casi nulo: la identidad la da el
trazo grueso.

- dark: bg `#140c00`, grid `#2b1a00`, ink `#ffcf70` (13.31:1), inkDim `#c08a2e`, primary `#ffb000`
  (10.59:1), accent `#4dff7d` (14.70:1), danger `#ff5a1f` (6.22:1), glow `2`,
  ramp `#c98a1e` `#e0a83c` `#a37a1c` `#ffb000` `#4dff7d` `#ff5a1f` `#ffcf70` (4.95–14.70:1)
- light: bg `#f5ecd8` (papel), grid `#ddcfae`, ink `#2b1d05` (13.96:1), inkDim `#6b5426`, primary
  `#8a4b00` (5.79:1), accent `#1d6b2f` (5.59:1), danger `#a32000` (6.47:1), glow `0`,
  ramp `#7a5a10` `#3f6b1d` `#8a4b00` `#6b4a00` `#1d6b2f` `#a32000` `#4a3a12` (5.36–9.38:1)

## Pendientes

- [x] **snake** — 3 skins × 2 modos completas; el atlas `fruits.png` se resolvió sin retinte (ver
      Decisiones) — 2026-08-09
- [ ] **tetris** — clasico/neon/retro, dark y light — aún no trabajado; 20 literales, la tabla
      `COLORS` por pieza se convierte en `ramp` y el HUD interno duplica `#00f5ff`/`#00ff88`/`#f5ff00`
      — 2026-08-09
- [x] **asteroides** — 3 skins × 2 modos completas — 2026-08-09
- [x] **arkanoid** — 3 skins × 2 modos completas; `BlockColor` refactorizado a `BlockTone` (índice
      sobre `ramp`) y las 5 definiciones de `LEVELS` renumeradas — 2026-08-09
- [ ] **plataforma** — la invariante de `ramp` documentada en `lib/games/skins.ts` ("las 3 primeras
      entradas no colisionan con `primary`/`accent`/`danger`") está **violada en retro/light**:
      `ramp[2]` es `#8a4b00`, exactamente `primary`. No se tocó la paleta en esta corrida porque
      asteroides ya la consume (el asteroide de tamaño 3 quedaría del color de la nave) y las paletas
      son de plataforma, no de un juego. Arkanoid lo esquiva por render (aro de `bg` en la pelota).
      Decidir si se corrige el hex o se relaja la invariante antes de skinear tetris, que indexa la
      rampa entera — 2026-08-09

## Decisiones

- **plataforma** — La infraestructura de skins (Fase 0) se creó en esta corrida: `lib/games/skins.ts`,
  `skin: GameSkin` en `GameCanvasProps`, el bloque `:root[data-theme="light"]` de `app/globals.css`,
  el script inline anti-flash en `app/layout.tsx`, `components/theme-provider.tsx` (`av_theme` +
  `av_skin`) y el toggle en `components/nav.tsx`. — 2026-08-09
- **plataforma** — `GameCanvasProps.skin` es obligatoria y el reproductor la pasa a los 4 motores,
  pero snake/tetris/arkanoid simplemente no la desestructuran: siguen con sus literales (equivale a
  un `clasico/dark` fijo) y ampliar el contrato no rompió su compilación. — 2026-08-09
- **plataforma** — El selector de skin del reproductor filtra por `SKINNED_GAME_SLUGS`
  (`lib/games/skins.ts`), hoy solo `["asteroides"]`: mostrarlo en un juego cuyo motor todavía ignora
  la paleta sería un control que no hace nada. Cada corrida suma su slug a esa lista. — 2026-08-09
- **plataforma** — El toggle de tema renderiza los dos iconos siempre y es el CSS
  (`:root[data-theme="…"]`) el que muestra uno; y el `<select>` de skin se monta después de hidratar
  (`useSyncExternalStore` con snapshot de servidor `false`). Ambas cosas evitan desajustes de
  hidratación con el valor de `localStorage`, que el servidor no puede conocer. El canvas **no**
  espera a eso: recibe la skin correcta desde el primer render de cliente, así que no hay parpadeo
  de paleta dentro del juego. — 2026-08-09
- **asteroides** — La llama del propulsor y las partículas de explosión se mapean ambas a `danger`
  ("fuego"), no a `accent`: `accent` ya es el powerup 3x y tenerlos separados evita que un asteroide
  reventando parezca un powerup. — 2026-08-09
- **asteroides** — Los asteroides se rellenan con `grid` antes de trazar el contorno. En el original
  eran polígonos huecos; en modo claro un polígono hueco hace que las balas y la nave que pasan por
  detrás se pierdan contra el fondo. El relleno es tenue en las 6 combinaciones y no cambia ninguna
  colisión. — 2026-08-09
- **asteroides** — El tamaño de asteroide indexa `ramp[size - 1]` en vez de tener un color propio:
  la rampa es el único conjunto indexado del juego y así los tres tamaños se distinguen a simple
  vista, además de dejar la rampa lista para Tetris/Arkanoid. — 2026-08-09
- **asteroides** — Las opacidades que en el original venían embebidas en literales `rgba(...)` (llama
  al 0.85, desvanecido de partículas) se aplican ahora con `ctx.globalAlpha`, para que el color salga
  entero de la paleta y el `grep` de literales quede en cero. — 2026-08-09
- **asteroides** — En modo claro (`glow === 0`) el trazo se engruesa ×1.7 y la bala gana 0.8 px de
  radio: `shadowBlur` es invisible sobre fondo claro, así que la legibilidad se compensa con grosor,
  no con brillo. — 2026-08-09
- **asteroides** — El HUD interno del canvas se dibuja siempre con `shadowBlur = 0`, incluso en
  `neon` (glow 18): el halo emborrona texto de 15 px y el contraste ya está garantizado por la
  paleta. — 2026-08-09
- **asteroides** — El cambio de skin va por `setSkin()` sobre el mismo motor, nunca por
  `key={skin}`: remontar el canvas es el mecanismo de reinicio de `components/game-player.tsx`, así
  que cambiar de skin a media partida no cuesta la partida. Si el juego está en pausa el canvas
  repinta a mano, porque el loop no corre. — 2026-08-09
- **snake** — `public/games/snake/fruits.png` **no se retiñe**: ni atlas por skin ni `ctx.filter`.
  Las 22 frutas son arte a todo color cuya identidad ES el color (un plátano que no es amarillo deja
  de leerse como plátano; en `retro` toda la fruta quedaría del mismo ámbar y las 22 se volverían
  indistinguibles entre sí). Un atlas por skin, además, exigiría producir 3 PNG nuevos que no se
  derivan del material de `references/sources-assets/`. El tratamiento fijo elegido: el sprite se
  dibuja idéntico en las 6 combinaciones y **la paleta se adueña de lo que lo rodea** — el motor
  pinta debajo un "plato" (relleno `grid` + aro `ramp[0]`) y el canvas le agrega un halo
  `shadowColor = ramp[0]` con radio `skin.glow`. Se eligió `ramp[0]` y no `accent` porque la
  invariante de rampa garantiza que no colisiona con `primary`/`accent`/`danger`, es decir con la
  serpiente. — 2026-08-09
- **snake** — El plato no es solo decorativo: resuelve el caso malo del modo claro, donde una fruta
  pálida (ajo, champiñón, coliflor) se perdía contra `#f2f3fa`/`#f5ecd8`. Como el sprite no puede
  cambiar, el contraste se aporta por detrás. — 2026-08-09
- **snake** — Cabeza `accent` y cuerpo `primary`, **más dos ojos calados en `bg`**. El color solo no
  alcanzaba: medido, `accent` vs `primary` es casi isoluminante en 3 de las 6 combinaciones
  (neon/light 1.00:1, retro/light 1.04:1, clasico/dark 1.13:1), así que distinguir la cabeza por
  tono fallaría ahí y con cualquier daltonismo. Los ojos hacen que la diferencia sea de forma. Dato
  a tener en cuenta por Tetris/Arkanoid: `accent` y `primary` NO son un par fiable para separar dos
  entidades que deban distinguirse sí o sí. — 2026-08-09
- **snake** — El borde del tablero se dibuja con `danger`. En Snake el límite mata (no hay
  wrap-around, a diferencia de Asteroides) y en la versión sin skin era invisible: el marco explicita
  la regla. Es solo pintura, la colisión la sigue resolviendo `update()` contra `gridW`/`gridH`. —
  2026-08-09
- **snake** — El HUD interno pasó a dos niveles: etiquetas ("Score:", "Nivel:") en `inkDim` y cifras
  en `ink`. `inkDim` da ≥ 6.12:1 contra `bg` en las 6 combinaciones, así que sigue siendo texto
  legible y no solo "detalle sutil". — 2026-08-09
- **snake** — La fruta la dibuja el canvas, pero su skin viaja por un `skinRef` en vez de entrar como
  dependencia del efecto del loop: ponerla en las deps cancelaría y reagendaría el
  `requestAnimationFrame` en cada cambio de paleta. El motor ya la recibe por `setSkin()`. —
  2026-08-09
- **arkanoid** — `type BlockColor` (union de nombres CSS: `"red" | "cyan" | …`, que el original usaba
  tal cual como `fillStyle`) pasó a `type BlockTone = 0|1|2|3|4|5|6`, índice sobre `ramp`. El union
  tenía exactamente 7 nombres y la rampa tiene 7 entradas, así que el mapeo es 1:1
  (`red→0 yellow→1 cyan→2 magenta→3 hotpink→4 green→5 gray→6`) y las 5 definiciones de `LEVELS`
  conservan la distribución del original intacta: solo cambian nombres por índices. Un bloque ya no
  sabe de qué color es, solo de qué slot de la paleta. — 2026-08-09
- **arkanoid** — La pelota lleva un aro de `bg` de 2 px alrededor del relleno `primary`. Es
  obligatorio, no decorativo: en `neon` y `retro` hay entradas de la rampa **idénticas** a `primary`
  (retro/dark `ramp[3]`, retro/light `ramp[2]`, neon `ramp[5]`), así que sin el aro la pelota
  desaparecería al cruzar un bloque de ese tono. El aro la separa en las 6 combinaciones sin tocar
  las paletas de plataforma, que asteroides ya consume. — 2026-08-09
- **arkanoid** — El paddle es `accent` y la pelota `primary`, no al revés: así `clasico` reproduce
  exactamente el look de hoy (paddle cian `#00f5ff`, pelota casi blanca) y la skin baseline sigue
  siendo de coste cero. Los iconos de vida del HUD también van en `accent` — lo que te queda en
  stock son paddles. — 2026-08-09
- **arkanoid** — Los bloques se dibujan **sin glow** aunque la skin declare uno: son hasta 60
  rectángulos por frame y en `neon` (glow 18) el halo los funde en una mancha, además de costar un
  `shadowBlur` por bloque. El brillo se reserva para lo que se mueve: pelota, paddle y explosión. —
  2026-08-09
- **arkanoid** — Cada bloque se rellena con 1 px de sangría, para que quede una junta de `bg` entre
  bloques contiguos del mismo tono; sin ella una fila entera se lee como una barra sólida y no se
  distingue cuántos bloques quedan. — 2026-08-09
- **arkanoid** — Se usan los dos campos que el original no tenía: `grid` dibuja la celosía 10×6 del
  muro (visible también donde ya no queda bloque, así el campo se lee como grilla con el nivel casi
  limpio) más las 3 paredes de rebote, y `danger` la línea de muerte del borde inferior — la única
  arista que no rebota, por donde se pierde la vida. `inkDim` queda sin usar: mide 6.12–8.12:1 en las
  6 combinaciones (sirve como texto), pero el HUD del original no tiene jerarquía secundaria que lo
  justifique. — 2026-08-09
- **arkanoid** — La celosía de `grid` mide ~1.1–1.3:1 contra `bg` en las 6 combinaciones y eso es
  correcto: `grid` es detalle decorativo, no una entidad de juego, y el criterio de ≥ 3:1 no le
  aplica. Subirla rompería el "detalle sutil" que pide el contrato. — 2026-08-09
