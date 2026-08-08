// ===== guest-id.ts — identidad estable de invitado en este navegador =====
//
// Los jugadores sin sesión ("invitados") necesitan un identificador estable
// para que sus puntuaciones se agrupen bajo un mismo jugador en el
// leaderboard, en vez de perderse o mezclarse con las de otros. Este UUID
// vive solo en el navegador (localStorage) — no hay traspaso a una cuenta
// si el invitado se registra luego (fuera de alcance, ver SPEC 07).

const GUEST_ID_STORAGE_KEY = "av_guest_id";

// Lee "av_guest_id" de localStorage; si no existe, genera un UUID nuevo, lo
// persiste y lo devuelve. Solo se usa en cliente (componentes "use client").
export function getOrCreateGuestId(): string {
  const existing = localStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (existing) return existing;

  const guestId = crypto.randomUUID();
  localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
  return guestId;
}
