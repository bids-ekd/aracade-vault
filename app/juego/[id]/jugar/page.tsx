import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { getGameBySlug } from "@/lib/supabase/games";

export default async function GamePlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameBySlug(id);
  if (!game) notFound();

  // `key={game.id}` fuerza a React a desmontar y remontar GamePlayer al
  // navegar entre dos juegos (misma ruta dinámica, así que sin esto React
  // reutilizaría la instancia): sin el remount, `migrationAttempted` de la
  // migración automática quedaría en `true` para siempre y bloquearía la
  // migración del segundo juego, además de arrastrar score/vidas/`over`
  // entre partidas de juegos distintos.
  return <GamePlayer key={game.id} game={game} />;
}
