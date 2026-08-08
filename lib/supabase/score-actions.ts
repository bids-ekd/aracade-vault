// ===== score-actions.ts — Server Actions de guardado del leaderboard real =====
//
// Separado de lib/supabase/scores.ts (lecturas) porque este archivo lleva
// `"use server"` a nivel de módulo: Next.js exige eso para poder importar
// Server Actions desde un Client Component (components/game-player.tsx), y
// un archivo con esa directiva solo puede exportar funciones async — las
// lecturas de scores.ts reciben un SupabaseClient (no serializable) como
// parámetro y no podrían vivir aquí sin romper esa regla.
"use server";

import { hasRealEngine } from "@/lib/games/registry";
import { createClient } from "@/lib/supabase/server";
import {
  displayNameFromUser,
  resolveGameId,
  type ScoreInsertRow,
} from "@/lib/supabase/scores-shared";

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

// Server Action — guardado interactivo (fin de partida) para cualquier juego
// con motor real (ver lib/games/registry.ts). Con sesión activa, ignora
// playerName/guestId del input y usa el user_id + display_name de la cuenta.
// Sin sesión, exige guestId y usa playerName tal cual lo escribió el
// invitado.
export async function guardarPuntuacion(input: {
  gameSlug: string;
  score: number;
  playerName: string;
  guestId: string | null;
}): Promise<SaveScoreResult> {
  // El slug lo provee el cliente: se valida contra el registro de juegos
  // reales antes de tocar la base, para que no se pueda postear al board de
  // un juego arbitrario (uno mock, o uno inexistente).
  if (!hasRealEngine(input.gameSlug)) {
    return { ok: false, error: `"${input.gameSlug}" no tiene leaderboard real.` };
  }

  const supabase = await createClient();

  let gameId: string;
  try {
    gameId = await resolveGameId(supabase, input.gameSlug);
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

// Server Action — migración única del histórico de av_scores de un juego
// dado (ya filtrado por el llamador a ese `gameSlug`). Misma resolución de
// identidad que arriba; inserta todo en un solo batch con origin:
// "migration" (exento del rate-limit).
export async function migrarPuntuacionesLocales(
  gameSlug: string,
  entries: { score: number; name: string; at: number }[],
  guestId: string | null,
): Promise<{ migrated: number }> {
  if (entries.length === 0) return { migrated: 0 };
  if (!hasRealEngine(gameSlug)) return { migrated: 0 };

  const supabase = await createClient();

  let gameId: string;
  try {
    gameId = await resolveGameId(supabase, gameSlug);
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
