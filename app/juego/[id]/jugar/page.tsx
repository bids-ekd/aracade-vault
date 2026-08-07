import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { getGameBySlug } from "@/lib/supabase/games";

export default async function GamePlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameBySlug(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
