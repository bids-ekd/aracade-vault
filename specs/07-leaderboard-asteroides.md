# SPEC 07 — Leaderboard real de Asteroides

> **Status:** Draft
> **Depends on:** [06-tabla-juegos-supabase](./06-tabla-juegos-supabase.md), [04-supabase-auth](./04-supabase-auth.md)
> **Date:** 2026-08-07
> **Objective:** Reemplazar el leaderboard mock de `asteroides` — en `/salon` y en la ficha de detalle `/juego/asteroides` — por puntuaciones reales persistidas en una tabla `scores` de Supabase, con identidad estable por jugador (cuenta o invitado), controles anti-abuso (rango de score, rate-limit, RLS) y migración automática del histórico ya guardado en `localStorage`, dejando el resto del catálogo (8 juegos) con su leaderboard mock intacto.

## Scope

**In:**

- Tabla nueva `scores` en Supabase: `game_id` (FK a `games.id`), `user_id` (FK a `auth.users.id`, nullable), `guest_id` (uuid, nullable), `player_name`, `score` (acotado por `CHECK`), `origin` (`'game_over'` | `'migration'`), `created_at`. Constraint que exige exactamente uno entre `user_id`/`guest_id` (nunca ambos, nunca ninguno).
- RLS en `scores`: lectura pública (`anon` + `authenticated`); escritura para `authenticated` solo con `user_id = auth.uid()` y `guest_id` nulo; escritura para `anon` solo con `guest_id` no nulo y `user_id` nulo.
- Trigger de rate-limit: bloquea un segundo insert con `origin = 'game_over'` del mismo jugador (`user_id`/`guest_id`) en el mismo juego dentro de los 10 segundos previos. Los inserts con `origin = 'migration'` quedan exentos (para permitir la carga masiva del histórico).
- `lib/guest-id.ts` (nuevo): helper de cliente que obtiene o crea un `guest_id` (UUID) persistido en `localStorage` (`av_guest_id`) — identidad estable de un invitado en ese navegador.
- `lib/supabase/scores.ts` (nuevo):
  - Server Action de guardado (reemplaza el `saveScore` en `localStorage` para `asteroides`): resuelve identidad (sesión real o `guest_id`), valida rango/rate-limit vía la base y hace el insert (`origin: "game_over"`).
  - Server Action de migración: inserta en bloque las entradas históricas de `av_scores` con `game: "asteroides"` (`origin: "migration"`, `created_at` = timestamp original de cada entrada).
  - Lectura de mejores puntuaciones: top N **jugadores distintos por su mejor score** (no partidas sueltas) para un juego dado.
  - Lectura de "mi mejor marca": mejor score y posición del jugador actual (autenticado o invitado) en un juego dado.
- `components/game-player.tsx`: para `asteroides` (`controls === "teclado"`), el modal de fin de partida guarda en Supabase en vez de `localStorage`. Con sesión iniciada, el campo de nombre deja de ser editable (usa el `display_name` de la cuenta). Como invitado, el nombre sigue siendo editable en cada partida, asociado por detrás a su `guest_id` fijo.
- Migración automática y silenciosa (sin acción del jugador) del histórico de `av_scores` con `game: "asteroides"` hacia Supabase, una sola vez por navegador (flag propio en `localStorage` para no repetir).
- `app/salon/page.tsx`: el tab "ASTEROIDES" pasa a mostrar datos reales de Supabase — podio, tabla de mejores marcas (una fila por jugador) y la fila "TU MEJOR MARCA", ahora también para invitados (antes exclusiva de usuarios con sesión). El resto de los tabs (8 juegos) sigue exactamente igual, con `seededScores()` mock, sin ningún cambio.
- `app/juego/[id]/page.tsx`: la sección lateral "MEJORES PUNTUACIONES" pasa a leer datos reales de Supabase únicamente para `asteroides`; el resto del catálogo sigue con `seededScores()` mock.

**Out of scope (para specs futuros):**

- Cualquier cambio a los otros 8 juegos del catálogo — siguen 100% mock, con `av_scores` en `localStorage` sin ningún cambio.
- Ranking global cruzando juegos — el leaderboard sigue siendo exclusivamente por juego, solo para `asteroides`.
- Anti-cheat real (revalidar la partida del lado del servidor) — solo quedan los controles descritos (rango de score, rate-limit, RLS); un cliente modificado igual podría reportar un score falso "plausible".
- Vincular los scores de un invitado (`guest_id`) a una cuenta si luego se registra — no hay traspaso de identidad invitado→usuario en este spec.
- Editar o borrar un score ya guardado, tanto por el jugador como por un administrador.
- Cualquier UI/panel admin para moderar la tabla `scores` — se administra a mano desde el dashboard de Supabase si hiciera falta.

## Data model

```sql
-- Tabla nueva en Supabase
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  user_id uuid references auth.users(id),          -- solo si el jugador tenía sesión
  guest_id uuid,                                     -- solo si jugó como invitado
  player_name text not null,                         -- display_name de cuenta, o nombre tecleado por el invitado
  score integer not null check (score >= 0 and score <= 2000000),
  origin text not null default 'game_over' check (origin in ('game_over', 'migration')),
  created_at timestamptz not null default now(),
  constraint scores_identity_xor check (
    (user_id is not null and guest_id is null) or
    (user_id is null and guest_id is not null)
  )
);

create index scores_game_best_idx on public.scores (game_id, score desc);
create index scores_identity_idx on public.scores (game_id, coalesce(user_id, guest_id));

alter table public.scores enable row level security;

-- Lectura pública
create policy "scores are publicly readable"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Un usuario autenticado solo puede insertar a su propio nombre
create policy "authenticated users insert their own scores"
  on public.scores for insert
  to authenticated
  with check (user_id = auth.uid() and guest_id is null);

-- Un invitado solo puede insertar bajo su guest_id (nunca con user_id)
create policy "guests insert scores under their guest_id"
  on public.scores for insert
  to anon
  with check (user_id is null and guest_id is not null);

-- Rate-limit: máx. 1 score con origin='game_over' cada 10s por jugador+juego.
-- Los inserts de origin='migration' (carga del histórico) quedan exentos.
create or replace function public.enforce_score_rate_limit()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.origin = 'game_over' and exists (
    select 1 from public.scores s
    where s.game_id = new.game_id
      and coalesce(s.user_id, s.guest_id) = coalesce(new.user_id, new.guest_id)
      and s.created_at > now() - interval '10 seconds'
  ) then
    raise exception 'rate_limited: espera unos segundos antes de guardar otra puntuación';
  end if;
  return new;
end;
$$;

create trigger scores_rate_limit
  before insert on public.scores
  for each row
  execute function public.enforce_score_rate_limit();
```

```ts
// lib/guest-id.ts — cliente
export function getOrCreateGuestId(): string;
// Lee "av_guest_id" de localStorage; si no existe, genera crypto.randomUUID(),
// lo persiste y lo devuelve. Solo se usa en cliente.
```

```ts
// lib/supabase/scores.ts
export type SaveScoreResult = { ok: true } | { ok: false; error: string };

// Server Action — guardado interactivo (fin de partida). Con sesión activa,
// ignora playerName/guestId y usa el user_id + display_name de la cuenta.
// Sin sesión, exige guestId y usa playerName tal cual lo escribió el invitado.
export async function guardarPuntuacionAsteroides(input: {
  score: number;
  playerName: string;
  guestId: string | null;
}): Promise<SaveScoreResult>;

// Server Action — migración única del histórico de av_scores (ya filtrado a
// game === "asteroides"). Misma resolución de identidad que arriba; inserta
// todo en un solo batch con origin: "migration".
export async function migrarPuntuacionesLocales(
  entries: { score: number; name: string; at: number }[],
  guestId: string | null,
): Promise<{ migrated: number }>;

export type LeaderboardRow = { rank: number; playerName: string; score: number; createdAt: string };

// Top N jugadores distintos por su mejor score (no partidas sueltas). Recibe
// el cliente de Supabase (browser en /salon, server en la ficha de detalle)
// como primer parámetro.
export async function getMejoresPuntuaciones(
  gameId: string,
  limit?: number,
): Promise<LeaderboardRow[]>;

// Mejor score + posición del jugador actual (sesión o guestId). null si nunca guardó.
export async function getMiMejorPuntuacion(
  gameId: string,
  guestId: string | null,
): Promise<{ rank: number; score: number } | null>;
```

Flag de migración en el navegador: `localStorage["av_scores_migrated_asteroides"] = "1"` una vez migrado, para no repetir el batch en cargas futuras.

## Implementation plan

1. Crear la migración de Supabase con la tabla `scores`, RLS (lectura pública, escritura condicionada por identidad) y el trigger de rate-limit (SQL de la sección anterior). El sistema sigue funcionando igual que antes — nada la consume todavía. Verificar desde el dashboard/SQL editor: insert con `user_id` propio funciona, con `user_id` ajeno falla, insert `anon` con `guest_id` funciona, un segundo insert `origin='game_over'` dentro de 10s falla, un score fuera de rango falla.
2. Crear `lib/guest-id.ts` y `lib/supabase/scores.ts` (Server Actions `guardarPuntuacionAsteroides`/`migrarPuntuacionesLocales` + funciones de lectura `getMejoresPuntuaciones`/`getMiMejorPuntuacion`, estas últimas reciben el cliente de Supabase —browser o server, según quien las llame— como parámetro). Archivos aislados, aún no conectados a ninguna pantalla.
3. Conectar `components/game-player.tsx` para `asteroides`: al guardar puntuación, se llama `guardarPuntuacionAsteroides` en vez de `saveScore` (`localStorage`); se resuelve `guestId` vía `getOrCreateGuestId()` cuando no hay sesión; el campo de nombre deja de ser editable cuando hay sesión (se guarda con el `display_name` de la cuenta). El resto del catálogo sigue guardando en `localStorage` sin cambios. En este punto jugar `asteroides` y guardar puntuación ya persiste en Supabase de punta a punta.
4. Implementar la migración automática y silenciosa: al montar la pantalla del jugador (o un punto equivalente), si hay entradas de `av_scores` con `game: "asteroides"` y no está seteado el flag `av_scores_migrated_asteroides` en `localStorage`, se llama `migrarPuntuacionesLocales(...)` con esas entradas y la identidad actual (sesión o `guestId`), y se marca el flag al terminar. El histórico queda reflejado en Supabase la primera vez que el navegador carga la app tras este spec.
5. Reescribir el tab "ASTEROIDES" de `app/salon/page.tsx`: al seleccionarlo, se consultan `getMejoresPuntuaciones` (top 12 jugadores distintos por su mejor score) y `getMiMejorPuntuacion` (sesión o `guestId`) contra Supabase desde el cliente, armando podio + tabla + fila "TU MEJOR MARCA" (ahora también para invitados). El resto de los tabs sigue usando `seededScores()` mock, sin cambios.
6. Conectar `app/juego/[id]/page.tsx`: para `asteroides`, la sección "MEJORES PUNTUACIONES" pasa a llamar `getMejoresPuntuaciones` desde el servidor en vez de `seededScores()`; el resto del catálogo sigue igual.
7. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual completo — jugar `asteroides` como invitado y como usuario autenticado, guardar puntuación, verificar que aparece en `/salon` (tab ASTEROIDES) y en `/juego/asteroides`; confirmar que el rate-limit bloquea un segundo guardado inmediato; confirmar que la migración del histórico de `av_scores` sucede una sola vez y esos valores aparecen en el ranking; confirmar que el resto del catálogo (8 juegos) sigue exactamente igual en `/salon` y en sus fichas de detalle.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La tabla `scores` existe en Supabase con RLS habilitado, policy de lectura pública, policies de escritura separadas para `authenticated`/`anon`, y el trigger de rate-limit activo.
- [ ] Un insert con `user_id` distinto al del usuario autenticado (`auth.uid()`) falla por RLS.
- [ ] Un insert como `anon` sin `guest_id` (o con `user_id`) falla por RLS.
- [ ] Un insert con `score` fuera del rango `0–2.000.000` falla por el `CHECK`.
- [ ] Guardar dos puntuaciones (`origin='game_over'`) del mismo jugador en el mismo juego dentro de 10 segundos: la segunda es rechazada por el trigger de rate-limit.
- [ ] Jugar `asteroides` como invitado, terminar la partida y guardar la puntuación la persiste en Supabase asociada a un `guest_id` estable en `localStorage` (no editable ahí, pero el nombre sí).
- [ ] Jugar `asteroides` con sesión iniciada, terminar la partida y guardar la puntuación la persiste en Supabase asociada al `user_id` de la cuenta, con el campo de nombre no editable (usa el `display_name` de la cuenta).
- [ ] `/salon`, tab "ASTEROIDES", muestra el podio y la tabla con datos reales de Supabase — una fila por jugador, su mejor score.
- [ ] `/salon`, tab "ASTEROIDES", muestra la fila "TU MEJOR MARCA" tanto para un usuario autenticado como para un invitado que ya guardó al menos una puntuación.
- [ ] `/salon`, el resto de los tabs (8 juegos) sigue mostrando exactamente los mismos datos mock (`seededScores()`) que antes de este spec.
- [ ] `/juego/asteroides` (detalle), la sección "MEJORES PUNTUACIONES" muestra datos reales de Supabase.
- [ ] `/juego/<resto-del-catálogo>` (detalle) sigue mostrando `seededScores()` mock, sin cambios.
- [ ] Al cargar la app con entradas previas de `av_scores` (`game: "asteroides"`) en `localStorage`, esas puntuaciones aparecen en Supabase (`origin: "migration"`) sin intervención del jugador, y no se vuelven a migrar en cargas posteriores.
- [ ] El resto del catálogo (8 juegos) sigue guardando sus puntuaciones en `localStorage` (`av_scores`) exactamente igual que antes de este spec, sin ningún cambio de comportamiento.

## Decisions

- **Sí:** leaderboard real acotado solo a `asteroides`, no a los 9 juegos del catálogo. Decisión explícita del usuario — descarta mi recomendación inicial de cubrir los 9 con `game_slug` de texto libre.
- **No:** leaderboard real para todo el catálogo con FK débil (`game_slug`). Se consideró en la fase de preguntas pero el usuario acotó a solo `asteroides`, lo que permite un FK estricto a `games.id`.
- **Sí:** ranking exclusivamente por juego, sin ranking global cruzando juegos. Decisión explícita del usuario, coherente con cómo funciona `/salon` hoy.
- **Sí:** la ficha de detalle (`/juego/asteroides`) también se conecta a scores reales, no solo `/salon`. Decisión explícita del usuario.
- **Sí:** identidad estable por jugador — `user_id` real para cuentas, `guest_id` (UUID en `localStorage`) para invitados — en vez de nombre libre sin ningún identificador. Decisión explícita del usuario para evitar que dos jugadores distintos se mezclen en el ranking por coincidencia de nombre.
- **Sí:** con sesión iniciada, el nombre en el modal de fin de partida deja de ser editable y usa el `display_name` de la cuenta. Evita que la misma persona aparezca con nombres distintos entre partidas, manteniendo consistente su identidad en el ranking.
- **Sí:** anti-abuso "blindado" con 4 controles — Server Action como único camino documentado de guardado, `CHECK` de rango (`0`–`2.000.000`), rate-limit de 10s vía trigger de base de datos, y RLS que ata `user_id` a `auth.uid()` (no se puede insertar a nombre de otro usuario). Decisión explícita del usuario, tras descartar mi propuesta inicial de aceptar el riesgo sin controles.
- **No:** aceptar el riesgo de scores falsos sin ningún control adicional. Descartado — el usuario pidió blindarlo.
- **No:** anti-cheat real (revalidar la partida server-side). Sigue fuera de alcance — los 4 controles listados arriba mitigan abuso obvio, no lo eliminan del todo (queda documentado como riesgo residual).
- **Sí:** migración del histórico de `av_scores` (`asteroides`) a Supabase, automática y silenciosa, una sola vez por navegador. Decisión explícita del usuario (recomendación aceptada) — es una migración técnica, no una decisión que deba tomar el jugador.
- **No:** migración manual vía botón explícito. Descartada a favor de la automática.
- **Sí:** los inserts de migración (`origin: "migration"`) quedan exentos del trigger de rate-limit, para poder cargar varias entradas históricas de una sola vez sin chocar con el límite de 10s pensado para el guardado interactivo.
- **Sí:** la fila "TU MEJOR MARCA" en `/salon` se extiende también a invitados (antes exclusiva de usuarios con sesión), ya que ahora tienen una identidad estable vía `guest_id`. Decisión explícita del usuario.
- **Sí:** el ranking muestra una fila por jugador (su mejor score), no partidas sueltas. Decisión explícita del usuario — comportamiento típico de "salón de la fama", evita que un jugador ocupe varias posiciones del podio con partidas repetidas.
- **No:** mostrar cada partida jugada como una fila independiente en el ranking. Descartado a favor de "mejor marca por jugador".
- **No:** vincular los scores de un invitado (`guest_id`) a una cuenta si luego se registra. Fuera de alcance de este spec — sus scores de invitado quedan atados al `guest_id`, sin traspaso.

## Risks

| Risk                                                                                                                                                                                                                                                                                  | Mitigation                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un cliente modificado (DevTools/API directa) aún puede reportar un score falso "plausible" dentro del rango permitido — los 4 controles no son anti-cheat real                                                                                                                        | Riesgo aceptado y documentado explícitamente en este spec; revalidar la partida server-side queda para un spec futuro si se vuelve un problema real                                                                      |
| Un dispositivo/navegador compartido por varias personas hace que todas compartan el mismo `guest_id`, mezclando sus puntuaciones bajo una sola identidad de invitado                                                                                                                  | Riesgo aceptado — mismo comportamiento que ya existía con `av_scores` en `localStorage` (sin distinción de jugador); documentado como limitación conocida del modo invitado                                              |
| Si el invitado borra `localStorage` (o cambia de navegador/dispositivo), pierde su `guest_id` y aparece como un jugador nuevo, sin su historial ni su fila "TU MEJOR MARCA" previa                                                                                                    | Riesgo aceptado — comportamiento esperado de una identidad basada en `localStorage`; no hay forma de recuperarla sin autenticarse                                                                                        |
| La migración automática atribuye el histórico de `av_scores` a quien esté activo (sesión o `guest_id`) en el navegador la primera vez que carga la app tras el deploy — si varias personas usaron ese navegador antes, el historial completo queda mal atribuido a una sola identidad | Riesgo aceptado y documentado — es una limitación inherente a que `av_scores` nunca distinguió jugadores; se migra tal cual, sin intentar reconstruir autoría real                                                       |
| La función `enforce_score_rate_limit` corre con `security definer`, lo que le da permisos elevados dentro de la función — un bug ahí podría abrir una vía de bypass de RLS más allá de su propósito (solo comparar timestamps)                                                        | Función acotada estrictamente a leer `scores` y comparar `created_at`; no hace ningún insert/update/delete ni expone datos adicionales; se revisa en el paso 1 del plan antes de conectar cualquier pantalla             |
| Un lote grande de migración (muchas entradas históricas de golpe) podría ser lento o parcialmente fallar a mitad de camino, dejando algunas puntuaciones sin migrar sin quedar claro cuáles                                                                                           | El batch de migración corre dentro de una única Server Action/transacción; si falla, no se marca el flag `av_scores_migrated_asteroides`, por lo que se reintenta completo en la próxima carga en vez de quedar a medias |
