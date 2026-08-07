// ===== scores.ts — lecturas del leaderboard real de Asteroides (Supabase) =====
//
// Cubre únicamente "asteroides" (ver SPEC 07). El resto del catálogo sigue
// usando `seededScores()` mock en localStorage, sin tocar este archivo.
//
// Estas funciones NO son Server Actions: reciben el cliente de Supabase ya
// creado (browser en /salon, server en la ficha de detalle) como primer
// parámetro, y ese objeto no es serializable a través del límite
// cliente/servidor que usan las Server Actions — por eso el guardado
// (`guardarPuntuacionAsteroides`/`migrarPuntuacionesLocales`) vive aparte,
// en lib/supabase/score-actions.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMejoresPorJugador, resolveGameId } from "@/lib/supabase/scores-shared";

export type LeaderboardRow = { rank: number; playerName: string; score: number; createdAt: string };

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
