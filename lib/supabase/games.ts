// ===== games.ts — helpers de lectura combinada Supabase + mock =====

import { GAMES, type Game, type GameCategory, type GameControls } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Forma de una fila de la tabla `public.games` en Supabase.
type GameRow = {
  slug: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "green" | "yellow";
  controls: GameControls;
  best: number;
  plays: string;
};

// Mapea una fila de Supabase (slug + columnas sueltas) al tipo `Game` ya
// existente en el mock (id = slug).
function mapRowToGame(row: GameRow): Game {
  return {
    id: row.slug,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat,
    cover: row.cover,
    color: row.color,
    best: row.best,
    plays: row.plays,
    controls: row.controls,
  };
}

// Busca primero en Supabase (`games` por slug); si no hay match, cae al
// mock `GAMES` de lib/data.ts (que ya no incluye "asteroides").
export async function getGameBySlug(slug: string): Promise<Game | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("slug, title, short, long, cat, cover, color, controls, best, plays")
    .eq("slug", slug)
    .maybeSingle();

  if (data) {
    return mapRowToGame(data as GameRow);
  }

  return GAMES.find((game) => game.id === slug);
}

// Trae todas las filas de `games` en Supabase (mapeadas a Game) + el mock
// `GAMES` completo. Los juegos reales van primero: son el valor central de
// la plataforma (motor jugable, leaderboard real), así que encabezan
// /biblioteca, entran en la preview de la home y son el tab por defecto de
// /salon. Se ordena por `created_at` y luego por `slug` como desempate:
// un seed que inserta varias filas en un mismo batch les da a todas el
// mismo `created_at` (timestamp de transacción), así que sin el desempate
// el orden entre ellas quedaría indeterminado.
export async function getAllGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("slug, title, short, long, cat, cover, color, controls, best, plays")
    .order("created_at", { ascending: true })
    .order("slug", { ascending: true });

  const supabaseGames = (data ?? []).map((row) => mapRowToGame(row as GameRow));

  return [...supabaseGames, ...GAMES];
}
