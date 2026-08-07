# SPEC 06 — Tabla de juegos en Supabase (`games`)

> **Status:** Approved.
> **Depends on:** [04-supabase-auth](./04-supabase-auth.md)
> **Date:** 2026-08-07
> **Objective:** Crear la tabla `games` en Supabase (solo lectura pública vía RLS) para alojar los juegos del catálogo con motor real — hoy únicamente `asteroides` —, y hacer que biblioteca, detalle y jugador la lean combinada con el resto del catálogo mock que sigue en `lib/data.ts`, sin cambios visuales ni funcionales para quien juega.

## Scope

**In:**

- Tabla nueva `games` en Supabase: `id` (uuid, PK, `gen_random_uuid()`), `slug` (text, único, ej. `"asteroides"`), `title`, `short`, `long`, `cat`, `cover`, `color`, `controls` (text), `best` (integer), `plays` (text, ej. `"3.1K"`), `created_at` (timestamptz, default `now()`). RLS activo con una única policy: lectura pública (`select` para `anon` y `authenticated`, `using (true)`). Sin policies de escritura — nadie puede insertar/editar/borrar desde la app.
- Fila inicial de `asteroides` cargada en la tabla (mismos valores que hoy tiene en el mock de `lib/data.ts`), a mano desde el dashboard o vía la migración con datos semilla.
- `lib/supabase/games.ts` (nuevo): helpers de lectura (`getGameBySlug`, `getAllGames`) que combinan la(s) fila(s) de Supabase con el resto del catálogo mock de `lib/data.ts` (todo lo que no sea `asteroides`), devolviendo siempre el mismo tipo `Game` ya existente.
- Se quita la entrada `asteroides` del array `GAMES` en `lib/data.ts` — el resto del catálogo (8 juegos) queda intacto, sin ningún cambio.
- `app/biblioteca/page.tsx` pasa a ser un Server Component async que obtiene el catálogo combinado vía `getAllGames()` y se lo pasa a un nuevo componente cliente (`components/biblioteca-grid.tsx`) que conserva exactamente el filtro por categoría y la búsqueda por texto actuales.
- `app/juego/[id]/page.tsx` (detalle) y `app/juego/[id]/jugar/page.tsx` (jugador) reemplazan `GAMES.find(...)` por `getGameBySlug(id)`; si no existe, `notFound()` igual que hoy.
- Resultado visual y funcional idéntico al actual para las 9 fichas del catálogo — este spec es un cambio de fuente de datos "por debajo", no de UI.

**Out of scope (para specs futuros):**

- Leaderboard / persistencia de puntuaciones reales en Supabase (tabla `scores`, reemplazo de `av_scores` en `localStorage`) — spec aparte, que dependerá de esta tabla `games` vía FK.
- `best`/`plays` calculados en vivo a partir de scores reales — en este spec quedan como columnas fijas/manuales, igual que en el mock actual.
- Migrar el resto del catálogo (los 8 juegos simulados) a Supabase — siguen en `lib/data.ts` sin cambios.
- Cualquier flujo en la app (UI, formulario, panel admin) para crear/editar/borrar juegos — la tabla se administra a mano desde el dashboard de Supabase.
- Cambiar el motor, mecánicas o comportamiento del juego `asteroides` — solo cambia de dónde se lee su ficha de catálogo (`title`, `short`, `long`, etc.), no su lógica de juego.
- Cache/revalidación avanzada de la consulta a Supabase (ISR, tags, etc.) — se usa el comportamiento por defecto de fetch en Server Components de este Next.js.

## Data model

```sql
-- Tabla nueva en Supabase
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,          -- "asteroides" — coincide con el id usado hoy en la app
  title text not null,
  short text not null,
  long text not null,
  cat text not null,                  -- "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover text not null,                -- clase CSS, ej. "cover-asteroides"
  color text not null,                -- "cyan" | "magenta" | "green" | "yellow"
  controls text not null,             -- "teclado" | "teclado-tactil"
  best integer not null,              -- valor fijo/manual (no calculado)
  plays text not null,                -- ej. "3.1K", valor fijo/manual
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- Única policy: lectura pública, sin restricciones. No hay policies de insert/update/delete
-- (nadie puede escribir desde la app; se administra con la service role desde el dashboard).
create policy "games are publicly readable"
  on public.games for select
  to anon, authenticated
  using (true);

-- Fila semilla
insert into public.games (slug, title, short, long, cat, cover, color, controls, best, plays)
values (
  'asteroides', 'ASTEROIDES',
  'El clásico Asteroids, jugable de verdad.',
  'Pilota una nave triangular en el vacío del espacio, dispara y rota para partir asteroides en fragmentos cada vez más pequeños. El primer juego del Vault que corre con un motor real — sin simulación, cada partida es distinta.',
  'SHOOTER', 'cover-asteroides', 'cyan', 'teclado', 63700, '3.1K'
);
```

```ts
// lib/supabase/games.ts
import type { Game } from "@/lib/data";

// Lee una fila de `games` en Supabase y la mapea a la forma `Game` ya existente
// (slug de Supabase → id de Game).
async function getGameBySlug(slug: string): Promise<Game | undefined>;
// Busca primero en Supabase (`games` por slug); si no hay match, cae al mock
// `GAMES` de lib/data.ts (que ya no incluye "asteroides").

async function getAllGames(): Promise<Game[]>;
// Trae todas las filas de `games` en Supabase (mapeadas a Game) + el mock `GAMES`
// completo (sin "asteroides", que ya no está ahí). Concatenados, sin reordenar
// el mock — las filas de Supabase se insertan en la posición donde estaba
// "asteroides" hoy, para no alterar el orden visual de la biblioteca.
```

```ts
// lib/data.ts — sin cambios de forma, solo se quita la entrada "asteroides" de GAMES.
// El tipo Game y GameControls quedan exactamente igual que hoy.
```

```tsx
// components/biblioteca-grid.tsx (nuevo, "use client")
type BibliotecaGridProps = { games: Game[] };
export function BibliotecaGrid(props: BibliotecaGridProps): JSX.Element;
// Mismo filtro por categoría (CATS) y búsqueda por texto que hoy tiene
// app/biblioteca/page.tsx, recibiendo la lista ya combinada por prop
// en vez de importar GAMES directamente.
```

## Implementation plan

1. Crear la migración de Supabase con la tabla `games`, RLS habilitado, la policy de lectura pública y la fila semilla de `asteroides` (SQL de la sección anterior, aplicada vía `apply_migration`). El sistema sigue funcionando exactamente igual que antes — nada la consume todavía; se verifica desde el dashboard/SQL editor que la fila existe y que un rol `anon` puede leerla pero no insertar/editar.
2. Quitar la entrada `asteroides` del array `GAMES` en `lib/data.ts` (el resto del catálogo queda intacto). Crear `lib/supabase/games.ts` con `getGameBySlug` y `getAllGames`, usando el cliente server (`lib/supabase/server.ts`). Archivo aislado, aún no conectado a ninguna pantalla.
3. Convertir `app/biblioteca/page.tsx` en Server Component async: llama `getAllGames()` y renderiza el nuevo `components/biblioteca-grid.tsx` (client component) pasándole `games` por prop, con el mismo filtro/búsqueda que hoy. `/biblioteca` ya muestra las 9 fichas igual que antes, con "ASTEROIDES" viniendo de Supabase.
4. Actualizar `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx`: reemplazar `GAMES.find(...)` por `await getGameBySlug(id)`, manteniendo `notFound()` si no hay match. `/juego/asteroides` y `/juego/asteroides/jugar` siguen funcionando igual, ahora leyendo su ficha desde Supabase; el resto del catálogo sigue leyendo del mock sin cambios.
5. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual de `/biblioteca` (9 fichas, filtros, búsqueda), `/juego/asteroides` (detalle) y `/juego/asteroides/jugar` (partida completa) comparando que se vean y funcionen igual que antes de este spec; confirmar en el dashboard de Supabase que `games` tiene RLS activo, una sola policy de lectura pública, y que intentar un insert/update desde el rol `anon` falla.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La tabla `games` existe en Supabase con RLS habilitado, una sola policy de lectura pública (`anon` y `authenticated`) y ninguna policy de escritura.
- [ ] La tabla `games` tiene exactamente una fila (`asteroides`) con los mismos valores que tenía en el mock antes de este spec.
- [ ] Un intento de `insert`/`update`/`delete` sobre `games` con el rol `anon` (sin service role) falla por RLS.
- [ ] `/biblioteca` muestra las mismas 9 fichas que antes de este spec, en el mismo orden, con el mismo contenido visual (incluida "ASTEROIDES").
- [ ] El filtro por categoría y la búsqueda por texto en `/biblioteca` funcionan igual que antes, incluyendo sobre la ficha "ASTEROIDES".
- [ ] `/juego/asteroides` (detalle) muestra el mismo copy, portada y etiqueta "TECLADO" que antes, ahora leído desde Supabase.
- [ ] `/juego/asteroides/jugar` sigue siendo jugable de punta a punta (motor real, HUD, power-up, pausa, fin de partida, guardar puntuación en `localStorage`), sin regresiones respecto al spec 05.
- [ ] El detalle y el jugador del resto del catálogo (ej. `/juego/rocas`, `/juego/rocas/jugar`) siguen funcionando exactamente igual que antes, leyendo del mock de `lib/data.ts`.
- [ ] Navegar a una ruta `/juego/<id-inexistente>` sigue devolviendo 404 (`notFound()`), tanto para slugs que ya no existen en el mock como para slugs inexistentes en Supabase.

## Decisions

- **Sí:** dos specs separados — este, para la tabla `games`, y el leaderboard con scores reales queda para un spec aparte que dependerá de esta tabla vía FK. Decisión explícita del usuario (recomendación aceptada) — evita mezclar dos migraciones de datos distintas (catálogo vs. puntuaciones) en un solo spec.
- **Sí:** la tabla `games` arranca con una sola fila (`asteroides`), no con los 9 juegos del catálogo. Decisión explícita del usuario — solo tiene sentido migrar a Supabase los juegos con motor real; el resto sigue simulado y no necesita persistencia real todavía.
- **Sí:** biblioteca/detalle/jugador combinan ambas fuentes (Supabase para `asteroides`, mock para el resto) en vez de dejar la tabla creada sin conectar. Decisión explícita del usuario — confirma que `asteroides` ya sale de una fuente real, coherente con ser "el primer juego del Vault que corre con un motor real" (spec 05).
- **No:** dejar la tabla `games` creada pero sin consumir desde la UI. Se descartó la opción (a) planteada en la fase de preguntas a favor de (b).
- **Sí:** `best`/`plays` quedan como columnas fijas/manuales en esta tabla, igual que en el mock actual. Decisión explícita del usuario — todavía no existe una tabla de scores reales de la cual calcularlos; eso se resuelve en el spec del leaderboard.
- **Sí:** `id` de la tabla es un `uuid` autogenerado, con `slug` (texto) como columna separada para el matching con el `id` que ya usa la app (`"asteroides"`). Decisión explícita del usuario — separa la clave primaria interna del identificador legible/estable que usa el resto del código y las URLs.
- **No:** usar el propio `slug`/texto como clave primaria. Se consideró en la fase de preguntas pero el usuario prefirió `uuid` + `slug` aparte.
- **Sí:** RLS con una única policy de solo lectura pública; ninguna policy de escritura — la tabla se administra a mano desde el dashboard de Supabase (service role bypassa RLS). Decisión explícita del usuario — no hay ningún flujo en la app todavía para crear/editar juegos.
- **Sí:** `lib/data.ts` pierde la entrada `asteroides` en vez de mantenerla duplicada (una vez en Supabase, otra en el mock). Evita una fuente de verdad ambigua — `getGameBySlug`/`getAllGames` son el único punto que decide de dónde sale cada juego.
- **Sí:** helper de combinación de fuentes (`lib/supabase/games.ts`) centralizado, en vez de resolver Supabase-vs-mock por separado en cada página. Un solo lugar decide la fuente; `biblioteca`, detalle y jugador consumen la misma función.
- **No:** cache/revalidación explícita (ISR, `revalidateTag`, etc.) sobre la consulta a `games`. Fuera de alcance — se usa el comportamiento por defecto de fetch de este Next.js; se evalúa si hace falta cuando exista más de un juego real.

## Risks

| Risk                                                                                                                                                                                                         | Mitigation                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diferencia de forma entre una fila de Supabase (`slug`, columnas sueltas) y el tipo `Game` del mock (`id`, mismos campos) puede romper el mapeo si un nombre de columna no coincide exactamente              | `getGameBySlug`/`getAllGames` centralizan el mapeo fila→`Game` en un solo lugar (`lib/supabase/games.ts`); se verifica en el paso 5 del plan comparando visualmente `/juego/asteroides` contra su estado antes del spec |
| Migrar `asteroides` a Supabase y combinar fuentes podría alterar el orden en que aparece en `/biblioteca` si `getAllGames()` simplemente concatena Supabase al final en vez de respetar la posición original | El plan (paso 2) especifica insertar las filas de Supabase en la posición donde estaba `asteroides` en el mock, no al final                                                                                             |
| Si la policy de RLS queda mal escrita (ej. `using (true)` también en insert/update por error), la tabla quedaría escribible desde el cliente anónimo, exponiendo el catálogo a manipulación pública          | Verificación explícita en el paso 5 del plan: confirmar que un insert/update con rol `anon` falla; solo debe existir la policy de `select`                                                                              |
| Fetch a Supabase en Server Components (`getGameBySlug`/`getAllGames`) puede fallar por red/latencia, dejando `/biblioteca` o `/juego/asteroides` sin cargar donde antes era síncrono desde el mock           | Riesgo aceptado para este spec (mismo criterio que specs anteriores con Supabase); no se agrega manejo de error/reintento especial más allá del comportamiento por defecto de Next.js ante un fetch fallido             |
| Confusión futura si alguien vuelve a agregar `asteroides` al mock de `lib/data.ts` (ej. copiando otro juego como plantilla), generando una entrada duplicada/conflictiva con la fila de Supabase             | Mitigado por tener un solo punto de lectura (`lib/supabase/games.ts`); queda documentado en este spec que `asteroides` vive exclusivamente en Supabase de ahora en más                                                  |
