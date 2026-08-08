// ===== registry.ts — qué juegos tienen motor real =====
//
// Dato plano, sin "use client" ni imports de Supabase: lo importan tanto
// Server Components (app/juego/[id]/page.tsx) como Client Components
// (components/salon-hall.tsx, components/games/engine-registry.ts). Un
// módulo "use client" no puede invocarse desde un Server Component, así que
// el registro se parte en dos: este archivo decide QUÉ juegos son reales,
// components/games/engine-registry.ts decide CON QUÉ COMPONENTE se juegan.
//
// Agregar un juego nuevo con motor real: sumar su slug acá Y su entrada en
// components/games/engine-registry.ts. Olvidar la segunda es un error de
// compilación (Record<RealGameSlug, …> exige la clave), no una sorpresa en
// runtime.
export const REAL_GAME_SLUGS = ["asteroides", "tetris"] as const;

export type RealGameSlug = (typeof REAL_GAME_SLUGS)[number];

export function hasRealEngine(slug: string): slug is RealGameSlug {
  return (REAL_GAME_SLUGS as readonly string[]).includes(slug);
}
