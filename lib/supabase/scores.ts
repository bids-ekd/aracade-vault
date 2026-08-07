// ===== scores.ts — leaderboard real de Asteroides (Supabase) =====
//
// Cubre únicamente "asteroides" (ver SPEC 07). El resto del catálogo sigue
// usando `seededScores()` mock en localStorage, sin tocar este archivo.
//
// `guardarPuntuacionAsteroides` y `migrarPuntuacionesLocales` son Server
// Actions (directiva `"use server"` inline en cada función, no a nivel de
// archivo): así conviven en el mismo módulo con las funciones de lectura de
// abajo, que NO son Server Actions — reciben el cliente de Supabase ya
// creado (browser en /salon, server en la ficha de detalle) como primer
// parámetro, y ese objeto no es serializable a través del límite
// cliente/servidor que usan las Server Actions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

export type LeaderboardRow = { rank: number; playerName: string; score: number; createdAt: string };

const ASTEROIDES_SLUG = "asteroides";

// Shape explícito de una fila a insertar en `scores`. Se anota a mano en vez
// de dejar que TS infiera el tipo desde un objeto armado con ternarios: sin
// esto, cada rama produce un literal distinto para `user_id`/`guest_id`
// (`string` vs `null`) y el union resultante no matchea el overload de
// `.insert()` generado por supabase-js.
type ScoreInsertRow = {
  game_id: string;
  user_id: string | null;
  guest_id: string | null;
  player_name: string;
  score: number;
  origin: "game_over" | "migration";
  created_at?: string;
};

// `games.id` (uuid, FK real de `scores.game_id`) nunca se expone hoy en el
// resto de la app — ahí un "Game" se identifica por su `slug` (ej.
// "asteroides"), igual que el `gameId` que reciben las funciones de este
// archivo. Se resuelve el uuid real por slug en cada llamada.
async function resolveGameId(supabase: SupabaseClient, slug: string): Promise<string> {
  const { data, error } = await supabase.from("games").select("id").eq("slug", slug).single();
  if (error || !data) {
    throw new Error(`No se encontró el juego "${slug}" en Supabase`);
  }
  return data.id as string;
}

// Nombre a mostrar para un usuario con sesión: su `display_name`, o el email
// como respaldo. Misma resolución que components/user-provider.tsx.
function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  return (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "JUGADOR";
}

// Server Action — guardado interactivo (fin de partida). Con sesión activa,
// ignora playerName/guestId del input y usa el user_id + display_name de la
// cuenta. Sin sesión, exige guestId y usa playerName tal cual lo escribió el
// invitado.
export async function guardarPuntuacionAsteroides(input: {
  score: number;
  playerName: string;
  guestId: string | null;
}): Promise<SaveScoreResult> {
  "use server";

  const supabase = await createClient();

  let gameId: string;
  try {
    gameId = await resolveGameId(supabase, ASTEROIDES_SLUG);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !input.guestId) {
    return { ok: false, error: "Falta guestId para guardar la puntuación como invitado." };
  }

  const row: ScoreInsertRow = {
    game_id: gameId,
    user_id: user ? user.id : null,
    guest_id: user ? null : input.guestId,
    player_name: user ? displayNameFromUser(user) : input.playerName,
    score: input.score,
    origin: "game_over",
  };

  const { error } = await supabase.from("scores").insert(row);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// Server Action — migración única del histórico de av_scores (ya filtrado a
// game === "asteroides"). Misma resolución de identidad que arriba; inserta
// todo en un solo batch con origin: "migration" (exento del rate-limit).
export async function migrarPuntuacionesLocales(
  entries: { score: number; name: string; at: number }[],
  guestId: string | null,
): Promise<{ migrated: number }> {
  "use server";

  if (entries.length === 0) return { migrated: 0 };

  const supabase = await createClient();

  let gameId: string;
  try {
    gameId = await resolveGameId(supabase, ASTEROIDES_SLUG);
  } catch {
    return { migrated: 0 };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !guestId) return { migrated: 0 };

  const rows: ScoreInsertRow[] = entries.map((entry) => ({
    game_id: gameId,
    user_id: user ? user.id : null,
    guest_id: user ? null : guestId,
    player_name: user ? displayNameFromUser(user) : entry.name,
    score: entry.score,
    origin: "migration",
    created_at: new Date(entry.at).toISOString(),
  }));

  const { error } = await supabase.from("scores").insert(rows);
  if (error) {
    return { migrated: 0 };
  }
  return { migrated: rows.length };
}

// Fila de `scores` colapsada a "mejor score por jugador", ordenada
// descendente. Comparten esta lectura getMejoresPuntuaciones (recorta a
// `limit`) y getMiMejorPuntuacion (busca la posición de un jugador puntual)
// para no duplicar el criterio de ranking entre ambas.
type BestScoreEntry = { identity: string; playerName: string; score: number; createdAt: string };

async function getMejoresPorJugador(
  supabase: SupabaseClient,
  resolvedGameId: string,
): Promise<BestScoreEntry[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at, user_id, guest_id")
    .eq("game_id", resolvedGameId)
    .order("score", { ascending: false });

  if (error || !data) return [];

  const seen = new Set<string>();
  const best: BestScoreEntry[] = [];
  for (const row of data) {
    const identity = row.user_id ?? row.guest_id;
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    best.push({
      identity,
      playerName: row.player_name,
      score: row.score,
      createdAt: row.created_at,
    });
  }
  return best;
}

// Top N jugadores distintos por su mejor score (no partidas sueltas). Recibe
// el cliente de Supabase (browser en /salon, server en la ficha de detalle)
// como primer parámetro.
export async function getMejoresPuntuaciones(
  supabase: SupabaseClient,
  gameId: string,
  limit = 12,
): Promise<LeaderboardRow[]> {
  let resolvedGameId: string;
  try {
    resolvedGameId = await resolveGameId(supabase, gameId);
  } catch {
    return [];
  }

  const best = await getMejoresPorJugador(supabase, resolvedGameId);
  return best.slice(0, limit).map((row, i) => ({
    rank: i + 1,
    playerName: row.playerName,
    score: row.score,
    createdAt: row.createdAt,
  }));
}

// Mejor score + posición del jugador actual (sesión o guestId) en un juego
// dado. null si nunca guardó.
export async function getMiMejorPuntuacion(
  supabase: SupabaseClient,
  gameId: string,
  guestId: string | null,
): Promise<{ rank: number; score: number } | null> {
  let resolvedGameId: string;
  try {
    resolvedGameId = await resolveGameId(supabase, gameId);
  } catch {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myIdentity = user ? user.id : guestId;
  if (!myIdentity) return null;

  const best = await getMejoresPorJugador(supabase, resolvedGameId);
  const idx = best.findIndex((row) => row.identity === myIdentity);
  if (idx === -1) return null;

  return { rank: idx + 1, score: best[idx].score };
}
