# game-jam · FROGGER — 04 · Catálogo y ranking

> **Status:** Draft
> **Depends on:** [02-motor](./02-motor.md), [03-arte](./03-arte.md), [05-asteroides-juego-real](../../05-asteroides-juego-real.md), [06-tabla-juegos-supabase](../../06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](../../07-leaderboard-asteroides.md)
> **Date:** 2026-08-08
> **Objective:** Fijar exactamente cómo entra FROGGER al catálogo —la fila de `public.games`, las dos ediciones de registro obligatorias— y cómo se verifica que su leaderboard real funciona en `/salon` y en `/juego/frogger`.

Este archivo es la autoridad sobre **catálogo y ranking**. Las reglas están en
[01-gameplay](./01-gameplay.md), el motor en [02-motor](./02-motor.md), lo visual en
[03-arte](./03-arte.md).

## Identidad de la ficha

| Campo      | Valor           | Por qué                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------- |
| `slug`     | `frogger`       | Libre: no está en `GAMES` (`lib/data.ts`) ni en `REAL_GAME_SLUGS`. Nombre real, como los otros 4. |
| `title`    | `FROGGER`       | Sin traducir, mismo criterio que TETRIS/ARKANOID/SNAKE. No se confunde con "RANARIA".             |
| `cat`      | `ARCADE`        | Categoría del clásico y la del mock hermano.                                                      |
| `color`    | `yellow`        | Único color sin motor real; distinto de `arkanoid` (magenta) y `snake` (verde). Ver `03-arte.md`. |
| `cover`    | `cover-frogger` | Clase nueva; no colisiona con ninguna `.cover-*` de `globals.css`. Definida en `03-arte.md`.      |
| `controls` | `teclado`       | 4 flechas, sin mouse ni táctil.                                                                   |
| `best`     | `32400`         | Placeholder mock, en el orden de magnitud de los otros juegos reales.                             |
| `plays`    | `2.3K`          | Placeholder mock.                                                                                 |

La ficha mock hermana **`ranaria`** (ARCADE, verde, `.cover-rana`, en el array `GAMES` de
`lib/data.ts`) **no se toca**: sigue existiendo, sigue siendo mock y sigue guardando en
`localStorage`. Es el mismo patrón que `rocas`/`asteroides`, `caida`/`tetris`,
`bloque-buster`/`arkanoid` y `serpentina`/`snake`.

## 1 · Fila nueva en `public.games`

Los juegos con motor real viven en la tabla de Supabase, no en el array `GAMES` de `lib/data.ts`
(`lib/supabase/games.ts` lee primero la tabla y cae al array para lo que no esté ahí). Por eso
`frogger` **no** se agrega a `lib/data.ts`.

```sql
insert into public.games (slug, title, short, long, cat, cover, color, controls, best, plays)
values (
  'frogger', 'FROGGER',
  'El clásico Frogger, jugable de verdad — carretera, río y cinco nenúfares.',
  'Cruzá cinco carriles de tráfico y un río de troncos y tortugas para llevar cinco ranas hasta sus nenúfares. Cada nivel acelera el asfalto, hunde más tortugas y te recorta el reloj. Un salto en falso y sos papilla. El quinto juego del Vault con motor real.',
  'ARCADE', 'cover-frogger', 'yellow', 'teclado', 32400, '2.3K'
);
```

Se aplica con `apply_migration` del MCP de Supabase —mostrando el SQL y pidiendo confirmación
antes— y se verifica después con `execute_sql`:

```sql
select slug, title, cat, cover, color, controls from public.games where slug = 'frogger';
```

`public.games` tiene RLS de solo lectura pública y **sin policies de escritura**: esta fila se
administra desde el dashboard o vía MCP con service role, nunca desde la app. No hace falta ninguna
fila en `public.scores`: se crean solas cuando los jugadores guarden puntuación.

> Este bloque SQL es **texto de especificación**. Se ejecuta durante `/spec-impl`, con confirmación
> explícita, no al escribir ni al revisar este paquete.

## 2 · Las dos ediciones de registro

El registro de juegos está partido en dos archivos a propósito (uno es dato plano importable desde
Server Components, el otro es `"use client"`). **Hay que editar los dos.** Olvidar el segundo es un
error de compilación, no una sorpresa en runtime: `Record<RealGameSlug, …>` exige la clave.

**a) `lib/games/registry.ts`** — qué slugs tienen motor real:

```ts
export const REAL_GAME_SLUGS = ["asteroides", "tetris", "arkanoid", "snake", "frogger"] as const;
```

**b) `components/games/engine-registry.tsx`** — con qué componente se juega cada slug. Entrada nueva
dentro de `GAME_ENGINES`, con la ruta del `import()` escrita como **literal** (esta versión de
Next.js no admite template string ni variable en `next/dynamic`):

```ts
frogger: dynamic(() =>
  import("@/components/games/frogger/frogger-canvas").then((m) => m.FroggerCanvas),
),
```

Sin `ssr: false`, igual que los cuatro existentes: el canvas solo toca `window`/`document` dentro de
`useEffect`.

Con estas dos ediciones —más el motor y el componente de [02-motor](./02-motor.md)—
`/juego/frogger/jugar` queda jugable de punta a punta **sin tocar** `components/game-player.tsx`,
`lib/supabase/score-actions.ts`, `components/salon-hall.tsx` ni `app/juego/[id]/page.tsx`.

## 3 · Qué se apaga solo al entrar a la tabla

Al existir la fila en `public.games` y el slug en `REAL_GAME_SLUGS`, la plataforma cambia de
comportamiento sin ninguna edición adicional:

| Antes (si fuera mock)                       | Después                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Puntuaciones simuladas con `seededScores()` | Filas reales de `public.scores`, filtradas por el `game_id` de `frogger` |
| Guardado en `localStorage` (`av_scores`)    | `guardarPuntuacion()` (Server Action) contra Supabase                    |
| Reproductor mock                            | `GameEngineSlot` monta `FroggerCanvas` vía `getGameEngine("frogger")`    |
| Tab de `/salon` con datos generados         | Tab de `/salon` con podio y tabla reales                                 |

Identidad del jugador, sin cambios: sesión de Supabase si la hay; si no, el UUID de invitado de
`localStorage` (`av_guest_id`, `lib/guest-id.ts`). Anti-abuso, sin cambios: `CHECK` de rango, RLS
atando `user_id` a `auth.uid()` (o `guest_id` no nulo para `anon`) y el trigger de rate-limit que
bloquea un segundo insert `origin = 'game_over'` del mismo jugador en el mismo juego dentro de 10 s.
Este spec **no inventa ningún control nuevo**.

## 4 · Cómo se verifica el leaderboard

**En `/juego/frogger` (ficha de detalle, Server Component):**

- [ ] La ficha muestra el copy aprobado, la etiqueta "TECLADO" y el acento amarillo.
- [ ] La sección "MEJORES PUNTUACIONES" lee de Supabase, no de `seededScores()`: con la tabla recién
      creada debe verse **vacía**, no con 12 nombres inventados. Ver una tabla llena antes de jugar
      la primera partida es la señal de que el slug no está resolviendo contra la fila real.
- [ ] Tras guardar la primera puntuación, esa fila aparece con el nombre de la sesión (o el alias de
      invitado) y la fecha correcta.

**En `/juego/frogger/jugar` (reproductor):**

- [ ] Al terminar la partida (0 vidas o botón "FIN"), el modal ofrece "GUARDAR PUNTUACIÓN".
- [ ] Guardar persiste el score exacto que muestra el HUD, con `origin = 'game_over'`.
- [ ] Un segundo guardado dentro de los 10 s es rechazado por el trigger de rate-limit, con el
      mensaje genérico ya existente — no con un error crudo de Postgres.
- [ ] "JUGAR DE NUEVO" reinicia por remount (`key={resetToken}`) y una partida nueva puede guardarse
      normalmente pasados los 10 s.

**En `/salon` (Client Component):**

- [ ] Aparece un tab "FROGGER" junto a ASTEROIDES, TETRIS, ARKANOID y SNAKE, con podio y tabla de
      datos reales.
- [ ] El tab de `ranaria` (mock) sigue mostrando exactamente lo mismo que antes, con sus
      puntuaciones simuladas.
- [ ] Ningún otro tab cambia de contenido ni de orden por la incorporación de este juego.

**Verificación cruzada en la base:**

```sql
select g.slug, count(s.id) as puntuaciones, max(s.score) as mejor
from public.games g
left join public.scores s on s.game_id = g.id
where g.slug = 'frogger'
group by g.slug;
```

## 5 · Documentación que hay que actualizar al implementar

Estos dos archivos son memoria del proyecto y quedan desactualizados en el momento en que
`frogger` tenga motor. No los toca este paquete de jam (todo acá está en `Draft`), pero sí el
`/spec-impl` que lo implemente:

- **`references/implemented-games.md`** — fila nueva:
  `| \`frogger\` | FROGGER | ARCADE | El clásico Frogger, jugable de verdad — carretera, río y cinco nenúfares. | yellow |`
- **`CLAUDE.md`** — la descripción dice "9 juegos en el catálogo: 4 con motor real"; pasa a 10
  juegos y 5 motores reales (`asteroides`, `tetris`, `arkanoid`, `snake`, `frogger`).

Además, `references/game-suggetions-todo.md` tiene a `frogger` en **Pendientes**: moverlo a "En
spec" y luego a "Implementados" es tarea de `game-planner`, el único agente que escribe ese archivo.
Ni `game-jam` ni `/spec-impl` lo tocan.
