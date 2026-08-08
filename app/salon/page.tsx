import { SalonHall } from "@/components/salon-hall";
import { getAllGames } from "@/lib/supabase/games";

// Server Component: trae el catálogo completo (mock + "asteroides" desde
// Supabase, igual que /biblioteca) y se lo pasa a SalonHall, que es donde
// vive toda la interactividad (tabs, sesión, leaderboard real).
export default async function SalonPage() {
  const games = await getAllGames();

  return <SalonHall games={games} />;
}
