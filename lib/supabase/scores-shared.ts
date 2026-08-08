// ===== scores-shared.ts — helpers internos compartidos por scores.ts y score-actions.ts =====
//
// No exporta Server Actions ni tiene ninguna directiva de Next.js: es
// código plano que ambos módulos importan. Vive separado de scores.ts
// (lecturas) y score-actions.ts (escrituras, Server Actions) porque Next.js
// exige que un archivo con Server Actions ("use server" a nivel de archivo)
// solo exporte funciones async — y las funciones de lectura, que reciben un
// SupabaseClient no serializable como parámetro, no pueden vivir ahí sin
// romper el límite cliente/servidor. Ver el comentario de cabecera de
// scores.ts para el detalle completo.

import type { SupabaseClient } from "@supabase/supabase-js";

// Shape explícito de una fila a insertar en `scores`. Se anota a mano en vez
// de dejar que TS infiera el tipo desde un objeto armado con ternarios: sin
// esto, cada rama produce un literal distinto para `user_id`/`guest_id`
// (`string` vs `null`) y el union resultante no matchea el overload de
// `.insert()` generado por supabase-js.
export type ScoreInsertRow = {
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
export async function resolveGameId(supabase: SupabaseClient, slug: string): Promise<string> {
  const { data, error } = await supabase.from("games").select("id").eq("slug", slug).single();
  if (error || !data) {
    throw new Error(`No se encontró el juego "${slug}" en Supabase`);
  }
  return data.id as string;
}

// Nombre a mostrar para un usuario con sesión: su `display_name`, o el email
// como respaldo. Misma resolución que components/user-provider.tsx.
export function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  return (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "JUGADOR";
}

// Fila de `scores` colapsada a "mejor score por jugador", ordenada
// descendente. Comparten esta lectura getMejoresPuntuaciones (recorta a
// `limit`) y getMiMejorPuntuacion (busca la posición de un jugador puntual)
// para no duplicar el criterio de ranking entre ambas.
export type BestScoreEntry = {
  identity: string;
  playerName: string;
  score: number;
  createdAt: string;
};

export async function getMejoresPorJugador(
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
