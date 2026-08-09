# CLAUDE.md

Este archivo ofrece guía a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

@AGENTS.md

## Descripción del proyecto

Arcade Vault es una plataforma para jugar online y competir por la mayor cantidad de puntos. Hay
9 juegos en el catálogo: **4 con motor real** (`asteroides`, `tetris`, `arkanoid`, `snake`) y el
resto como fichas mock (portadas, textos y leaderboard generado). Los juegos reales corren en
`<canvas>` dentro de la plataforma y persisten puntuaciones en Supabase; los mock guardan en
`localStorage`. Puedes consultar cuantos se han implementado realmente en /references/implemented-games.md

Todo el producto se construyó con **Spec Driven Design**: cada funcionalidad tiene su spec en
`specs/NN-*.md` y esas specs son la fuente de verdad de por qué el código es como es. Las 10 specs
existentes están en estado `Implemented`.

## Skills y flujo de trabajo

### Agentes

- **`game-planner`** (`.claude/agents/game-planner.md`) — decide **qué** juego agregar a
  continuación. Evalúa candidatos (promover una ficha mock o un juego nuevo) contra el contrato del
  motor, el HUD, el modelo de input y los huecos de catálogo; mantiene el To Do de sugerencias en
  `references/game-suggetions-todo.md` y termina recomendando `/spec-juego <slug>`. No escribe
  código ni specs.
- **`game-jam`** (`.claude/agents/game-jam.md`) — convierte un **tema** en un paquete de
  especificación completo para un juego nuevo, sin ida y vuelta. Evalúa tres candidatos de arcade
  clásico reinterpretados al tema con la misma rúbrica de `game-planner`, elige uno y escribe cinco
  archivos (`00-concepto.md`, `01-gameplay.md`, `02-motor.md`, `03-arte.md`, `04-catalogo.md`) en
  `specs/game-jam/<slug>/`, todos en estado `Draft`. `02-motor.md` sigue el mismo formato que una
  spec de `/spec-juego` y es la que se promueve a `specs/NN-<slug>.md` una vez aprobada. Vía
  paralela a `game-planner`, no lo reemplaza: úsalo cuando haya un tema de partida, no cuando la
  pregunta sea "qué juego sigue" en general.

Flujo completo para un juego nuevo: `game-planner` → `/spec-juego` → `/spec-impl`.
Flujo temático (game jam): `game-jam <tema>` → revisar `specs/game-jam/<slug>/` → promover
`02-motor.md` a `specs/NN-<slug>.md` → `/spec-impl`.

Skills instaladas en `.claude/skills/` y `.agents/skills/`:

- **`/spec`** — diseña una spec nueva (`specs/NN-slug.md`, estado `Draft`). No escribe código.
- **`/spec-impl NN-slug`** — implementa una spec aprobada; crea la rama `spec-NN-slug`
  automáticamente (`AutoCreateBranch: true` en `specs/.spec-config.yml`).
- **`/spec-juego`** — hermana especializada de `/spec` para **agregar un juego nuevo con motor
  real y leaderboard**. Usa siempre esta, no `/spec`, cuando la funcionalidad sea un juego: aplica
  el checklist de portabilidad (globals del DOM, reloj, modelo de input, HUD, overlays, assets,
  restart, `dt`) contra el código original en `references/started-games/`. Es la ruta probada para
  los últimos tres juegos (Tetris, Arkanoid, Snake).
- **`/frontend-design`** — úsala siempre para diseñar interfaces de usuario.

`/spec` y `/spec-impl` vienen de https://github.com/Klerith/fernando-skills
(`npx skills@latest add Klerith/fernando-skills`, versiones fijadas en `skills-lock.json`).
`/spec-juego` es propia de este repo.

### Hook automático

`.claude/settings.json` registra un hook `PostToolUse` sobre `Write|Edit`
(`.claude/hooks/format-and-lint.sh`) que corre Prettier `--write` y ESLint `--fix` sobre cada
archivo tocado, y sale con código 2 devolviendo los errores no autofixeables como contexto. No
hace falta formatear a mano; sí hace falta atender lo que reporte.

### MCP

`.mcp.json` conecta el servidor MCP de **Supabase** (proyecto `cjnlekpsbkrsufqaaehz`). Las
migraciones se aplican con `apply_migration` (mostrando el SQL y pidiendo confirmación antes) y se
verifican con `execute_sql`. No hay CLI de Supabase ni migraciones versionadas en el repo.

## Stack tecnológico

- Next.js 16.2.12 (App Router, directorio `app/`)
- React 19.2.4 (con React Compiler activo — ver nota sobre `static-components` más abajo)
- TypeScript (modo strict, alias de rutas `@/*` → raíz del repo)
- Tailwind CSS v4 vía `@tailwindcss/postcss`, con `@theme inline` en `app/globals.css` (sin
  `tailwind.config.*`). El grueso del estilo es CSS a mano en `globals.css` (~1650 líneas): tema
  neón/arcade, grid en perspectiva, scanlines y **generadores de portada en CSS puro**
  (`.cover-*`).
- Supabase (`@supabase/ssr` + `@supabase/supabase-js`) — auth y persistencia de puntuaciones
- Resend — envío del formulario de contacto
- ESLint 9 flat config (`eslint.config.mjs`) con `core-web-vitals` + `typescript`; `references/**`
  está ignorado
- Prettier 3.9.6 (`printWidth: 100`)

**No hay test runner configurado.** La verificación de cada spec es `npm run lint` +
`npm run build` sin errores, más un recorrido manual de las pantallas afectadas.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run start    # ejecuta el build
npm run lint     # ESLint
npm run format   # Prettier sobre todo el repo
```

## Estructura

```
app/                      rutas (App Router)
  page.tsx                home / landing
  biblioteca/             catálogo con filtros y búsqueda
  juego/[id]/             ficha de detalle + leaderboard
  juego/[id]/jugar/       reproductor del juego
  salon/                  salón de la fama (leaderboards por juego)
  acerca-de/              about + formulario de contacto (Resend)
  auth/                   login/registro, recuperación, /auth/confirm
  globals.css             tema completo + portadas CSS
components/
  games/<slug>/           un motor por juego: engine.ts + <slug>-canvas.tsx
  games/engine-registry.tsx  slug → componente cliente (next/dynamic)
  game-player.tsx         reproductor: HUD externo, pausa, modal de fin, guardado
  home.tsx, nav.tsx, salon-hall.tsx, biblioteca-grid.tsx, game-card.tsx
  user-provider.tsx       contexto de sesión en cliente
lib/
  data.ts                 catálogo mock + seededScores() para juegos sin motor
  games/registry.ts       qué slugs tienen motor real
  games/types.ts          contrato GameEngineState / GameCanvasProps
  guest-id.ts             UUID estable de invitado en localStorage
  supabase/               client, server, proxy, games, scores, score-actions, scores-shared
proxy.ts                  refresco de sesión de Supabase en cada request
specs/                    01..10, todas Implemented
references/               material de origen, NO es parte de la app (lint lo ignora)
  started-games/          juegos originales en JS vanilla, fuente de los ports
  sources-assets/         sprites y assets crudos
  implemented-games.md    catálogo de juegos con motor real (fuente para game-planner)
  game-suggetions-todo.md To Do de sugerencias de juego, mantenido por game-planner
```

## Arquitectura

### Catálogo: Supabase + mock

`lib/supabase/games.ts` (`getAllGames`, `getGameBySlug`) lee primero la tabla `public.games` de
Supabase y cae al array `GAMES` de `lib/data.ts` para lo que no esté ahí. Los juegos con motor real
viven en la tabla; los mock siguen en el array. En toda la app un juego se identifica por su
**slug** (`game.id`), no por el uuid de la tabla.

### El registro de juegos está partido en dos — a propósito

- `lib/games/registry.ts` — `REAL_GAME_SLUGS` decide **qué** slugs tienen motor real. Es dato plano
  sin `"use client"`, porque lo importan también Server Components.
- `components/games/engine-registry.tsx` — `GAME_ENGINES` decide **con qué componente** se juega
  cada slug, con `next/dynamic` (un chunk por motor, para que jugar un mock no descargue los 4
  motores). Es `"use client"` y por eso no puede vivir en el mismo archivo.

Olvidar la segunda entrada al agregar un juego es un **error de compilación**
(`Record<RealGameSlug, …>` exige la clave), no una sorpresa en runtime.

### Contrato de un motor

`lib/games/types.ts`:

- `GameEngineState` — `score` obligatorio; `lives`/`level`/`lines`/`status` opcionales. El HUD
  externo de la plataforma **oculta la tarjeta** de cada campo que llegue `undefined`, así que cada
  juego declara solo lo que le aplica.
- `GameCanvasProps` — `{ paused, onStateChange, onGameOver }`.

Reglas que todo motor cumple (nacieron del checklist de `/spec-juego`):

- `engine.ts` no toca `document`, `window`, `localStorage` ni `new Audio()`; recibe el contexto en
  `draw(ctx)` y el input en `update(dt, input)`.
- Sin efectos al importar: solo arranca en `reset()`.
- `dt` en segundos, clampeado a 50 ms; `lastTime` se resetea al reanudar para que la pausa no
  produzca un frame gigante de catch-up.
- Nada de overlays de game over / pausa dentro del motor: eso lo maneja el modal de la plataforma,
  vía `status` en `GameEngineState`.
- El reinicio no vive en el motor: la plataforma remonta el canvas con `key={resetToken}`.
- Los edge-triggered (disparo, hard drop) los detecta el componente canvas, no el motor.
- Assets bajo `public/games/<slug>/`, cargados de forma asíncrona antes de arrancar el loop.

### Leaderboard real

Tablas en Supabase, ambas con RLS:

- `games` — solo lectura pública. Sin policies de escritura: se administra a mano desde el
  dashboard (o vía MCP con service role).
- `scores` — lectura pública; escritura de `authenticated` solo con `user_id = auth.uid()`, y de
  `anon` solo con `guest_id` no nulo. Trigger de rate-limit: bloquea un segundo insert
  `origin = 'game_over'` del mismo jugador en el mismo juego dentro de 10 s (los de
  `origin = 'migration'` están exentos).

El código está partido por restricciones de Next.js, no por gusto:

- `lib/supabase/scores.ts` — **lecturas**. Reciben el `SupabaseClient` ya creado como parámetro
  (browser en `/salon`, server en la ficha), así que no pueden ser Server Actions.
- `lib/supabase/score-actions.ts` — **escrituras**, con `"use server"` a nivel de módulo
  (`guardarPuntuacion`, `migrarPuntuacionesLocales`). Un archivo con esa directiva solo puede
  exportar funciones async.
- `lib/supabase/scores-shared.ts` — helpers que ambos comparten (`resolveGameId`,
  `displayNameFromUser`, `getMejoresPorJugador`).

Identidad del jugador: sesión de Supabase si la hay; si no, un UUID de invitado en `localStorage`
(`av_guest_id`, ver `lib/guest-id.ts`). No hay traspaso de invitado a cuenta.

Los juegos sin motor real siguen con `seededScores()` de `lib/data.ts` y `localStorage`
(`av_scores`).

### Auth

Email + contraseña con Supabase. `proxy.ts` en la raíz refresca la sesión en cada request
(`lib/supabase/proxy.ts`); `app/auth/confirm/route.ts` resuelve tanto la confirmación de registro
(`type=email`) como la recuperación (`type=recovery`). Las Server Actions de
`app/auth/actions.ts` devuelven `{ ok: false, error }` con mensajes genéricos, sin filtrar detalle
del error de Supabase.

## Cómo agregar un juego nuevo con motor real

1. `/spec-juego <slug>` — produce `specs/NN-<slug>.md` en `Draft`. No escribe código.
2. Aprobar la spec, luego `/spec-impl NN-<slug>`.
3. La implementación siempre toca, como mínimo: `components/games/<slug>/engine.ts` +
   `<slug>-canvas.tsx`, el slug en `REAL_GAME_SLUGS`, la entrada `dynamic()` en `GAME_ENGINES`, la
   clase `.cover-<slug>` en `globals.css`, y un `insert into public.games (...)` aplicado con el MCP
   de Supabase.

## Crítico: este no es el Next.js que conoces

Este proyecto fija una versión de Next.js con cambios incompatibles respecto a versiones anteriores
con las que puedas haber entrenado. Antes de escribir o modificar código relacionado con Next.js
(routing, data fetching, configuración, metadata, server/client components, etc.), lee la guía
correspondiente en `node_modules/next/dist/docs/` (`01-app/`, `02-pages/`, `03-architecture/`,
`04-community/`) y respeta los avisos de deprecación. No asumas que las APIs anteriores siguen
aplicando.

Diferencias que ya nos mordieron y están resueltas en el código:

- **`proxy.ts` en la raíz, no `middleware.ts`** — es la convención de archivo de esta versión (ver
  `01-app/03-api-reference/03-file-conventions/proxy.md`).
- **`params` es una `Promise`** en páginas dinámicas: `const { id } = await params`.
- **La ruta de `import()` en `next/dynamic` debe ser un literal** — no admite template string ni
  variable, por eso `GAME_ENGINES` es un objeto escrito a mano y no se genera desde
  `REAL_GAME_SLUGS`.
- **React Compiler / `react-hooks/static-components`** marca como error usar directamente el
  resultado de una llamada a función como tag JSX. Por eso existe `GameEngineSlot`: el componente
  llega como _prop_, no como resultado de una llamada dentro del mismo render.

## Convenciones

- **Todo en español**: comentarios, nombres de funciones de dominio (`guardarPuntuacion`,
  `getMejoresPuntuaciones`), copy de la UI y mensajes de error. Las specs y las skills están
  mezcladas es/en; responde en el idioma del prompt.
- Los archivos de `lib/` y los registros llevan un **comentario de cabecera `// ===== archivo — qué
hace =====`** que explica _por qué_ está partido así. Si tocas uno de esos archivos, mantén
  actualizado ese comentario — son la memoria de las restricciones de Next.js que motivaron cada
  separación.
- `references/` es material de origen de solo lectura: no lo edites, no lo importes desde la app, y
  está fuera de ESLint y del hook de formato. Única excepción: `game-suggetions-todo.md`, que
  `game-planner` sí actualiza — es su memoria persistente, no material de origen.
- Variables de entorno en `.env.example`: `RESEND_API_KEY`, `RESEND_TO_EMAIL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
