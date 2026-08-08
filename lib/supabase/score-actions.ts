// ===== score-actions.ts — Server Actions de guardado del leaderboard de Asteroides =====
//
// Separado de lib/supabase/scores.ts (lecturas) porque este archivo lleva
// `"use server"` a nivel de módulo: Next.js exige eso para poder importar
// Server Actions desde un Client Component (components/game-player.tsx), y
// un archivo con esa directiva solo puede exportar funciones async — las
// lecturas de scores.ts reciben un SupabaseClient (no serializable) como
// parámetro y no podrían vivir aquí sin romper esa regla.
"use server";

import { createClient } from "@/lib/supabase/server";
import {
  ASTEROIDES_SLUG,
  displayNameFromUser,
  resolveGameId,
  type ScoreInsertRow,
} from "@/lib/supabase/scores-shared";

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

// Server Action — guardado interactivo (fin de partida). Con sesión activa,
// ignora playerName/guestId del input y usa el user_id + display_name de la
// cuenta. Sin sesión, exige guestId y usa playerName tal cual lo escribió el
// invitado.
export async function guardarPuntuacionAsteroides(input: {
  score: number;
  playerName: string;
  guestId: string | null;
}): Promise<SaveScoreResult> {
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
