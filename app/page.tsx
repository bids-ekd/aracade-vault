import { Home } from "@/components/home";
import { getAllGames } from "@/lib/supabase/games";

export default async function HomePage() {
  const games = await getAllGames();
  return <Home games={games} />;
}
