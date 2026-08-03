# SPEC 01 — Pantallas visuales del MVP de Arcade Vault

> **Status:** Implemented
> **Depends on:** Ninguna (primer spec del proyecto)
> **Date:** 2026-08-02
> **Objective:** Implementar la parte visual de las 5 pantallas de Arcade Vault (Biblioteca, Detalle de juego, Reproductor, Acceso y Salón de la Fama) migrando `references/templates/` a rutas reales de Next.js App Router, sin implementar ningún juego jugable real.

## Scope

**In:**

- Ruta `/` — Biblioteca: hero, buscador, chips de categoría, grid de tarjetas de juego con tilt 3D, estado vacío "NO HAY RESULTADOS".
- Ruta `/juego/[id]` — Detalle de juego: portada, tags, descripción, stat strip, botón "JUGAR AHORA", tabla de mejores puntuaciones (mock).
- Ruta `/juego/[id]/jugar` — Reproductor: HUD (jugador, puntuación, vidas, nivel), simulación de partida (puntuación automática vía `setInterval`, subida de nivel), pausa, botón "FIN", modal de fin de partida con formulario de iniciales y guardado de puntuación.
- Ruta `/auth` — Acceso: tabs "Iniciar sesión" / "Crear cuenta", formulario mock (sin validación de backend), botón "Jugar como invitado", botones sociales decorativos (sin funcionalidad real).
- Ruta `/salon` — Salón de la Fama: tabs por juego, podio (top 3), tabla completa de puntuaciones, fila "tu mejor marca" simulada cuando hay sesión iniciada.
- Nav global (desktop + panel móvil) y footer, integrados en `app/layout.tsx`.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) migrados a `lib/data.ts` en TypeScript.
- Persistencia en `localStorage` de sesión de usuario (`av_user`) y puntuaciones guardadas (`av_scores`), igual que el template.
- Reutilización de las clases ya migradas en `app/globals.css`; Tailwind solo para lo que ese CSS no cubra.

**Out of scope (for future specs):**

- Lógica real de cualquier juego (Bloque Buster, Caída, Serpentina, etc.) — el Reproductor solo simula un puntaje automático, no hay juego jugable.
- Autenticación real (backend, validación de credenciales, OAuth de Google/GitHub).
- Guard de rutas / redirecciones basadas en sesión — todas las rutas son públicas en este spec.
- Lectura de puntuaciones reales guardadas (`av_scores`) en el Salón de la Fama — la fila "tu mejor marca" sigue usando el valor simulado del template.
- Persistencia en servidor / base de datos — todo vive en `localStorage` del navegador.
- Tests automatizados (no hay test runner configurado en el proyecto).

## Data model

Estructuras mock en `lib/data.ts` (migradas de `references/templates/data.jsx`):

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS, ej. "cover-bricks"
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string; // ej. "12.4K"
};

export const GAMES: Game[]; // 8 juegos, igual que el template
export const CATS: ("TODOS" | GameCategory)[];
export const PLAYERS: string[];

export type ScoreRow = { rank: number; name: string; score: number; date: string };
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Estado de sesión y persistencia, en `localStorage` (misma forma que el template):

```ts
// clave "av_user"
type StoredUser = { name: string } | null;

// clave "av_scores"
type SavedScore = { game: string; score: number; name: string; at: number };
// av_scores es un array de SavedScore que se acumula con cada partida guardada.
```

Estado de ruta y sesión:

- `route` ya no existe como objeto — cada pantalla es su propia ruta de archivo (`app/page.tsx`, `app/juego/[id]/page.tsx`, etc.), con `id` recibido vía el parámetro dinámico `[id]` del segmento (en Next 16, `params` llega como `Promise<{ id: string }>` y debe resolverse con `await`).
- El estado `user` (sesión) se maneja con un React Context expuesto por `components/user-provider.tsx` (Client Component), que envuelve `{children}` en `app/layout.tsx`. Sincroniza con `localStorage` (`av_user`) al montar y en cada `login`/`logout`. Nav, Reproductor, Auth y Salón de la Fama consumen ese contexto en vez de recibir `user` por props.

## Implementation plan

1. Crear `lib/data.ts` con `GAMES`, `CATS`, `PLAYERS` y `seededScores()` tipados en TypeScript, migrados literalmente de `references/templates/data.jsx`.
2. Crear `components/user-provider.tsx` (Client Component) con un React Context que expone `user`, `login(user)`, `logout()`, sincronizado con `localStorage["av_user"]`. Envolver `{children}` con este provider en `app/layout.tsx`.
3. Crear `components/nav.tsx` (Client Component) migrando `references/templates/nav.jsx`: logo, links de escritorio, contador de créditos, botón de acceso/cuenta, panel móvil con backdrop. Consume el contexto de `user-provider`. Integrarlo en `app/layout.tsx` junto con el footer (`© 2026 ARCADE VAULT...`).
4. Crear `components/game-card.tsx` migrando el tilt 3D de `GameCard` en `biblioteca.jsx`.
5. Implementar `app/page.tsx` (Biblioteca): hero, buscador, chips de categoría y grid de `GameCard`, con filtrado en cliente sobre `GAMES`. Navegación a `/juego/[id]` vía `next/link` o `useRouter`.
6. Implementar `app/juego/[id]/page.tsx` (Detalle): busca el juego por `id` en `GAMES` (404 con `notFound()` si no existe), muestra portada, tags, descripción, stat strip y tabla de mejores puntuaciones (`seededScores`). Botón "JUGAR AHORA" navega a `/juego/[id]/jugar`.
7. Implementar `app/juego/[id]/jugar/page.tsx` (Reproductor): HUD, simulación de partida con `setInterval`, pausa, modal de fin de partida con guardado en `localStorage["av_scores"]`. Usa el nombre del usuario del contexto o "INVITADO".
8. Implementar `app/auth/page.tsx` (Acceso): tabs login/crear cuenta, formulario mock, botón de invitado y botones sociales decorativos. Al enviar, llama `login()` del contexto y navega a `/`.
9. Implementar `app/salon/page.tsx` (Salón de la Fama): tabs por juego, podio, tabla completa y fila "tu mejor marca" simulada cuando hay `user` en contexto.
10. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual de las 5 pantallas en el navegador comparando contra `references/templates/Arcade Vault.html` para verificar paridad visual.

## Acceptance criteria

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] `/` muestra el hero, el buscador y el grid de las 8 tarjetas de juego de `GAMES`.
- [x] Escribir en el buscador de `/` filtra las tarjetas por título en tiempo real.
- [x] Seleccionar una categoría en los chips de `/` filtra las tarjetas por esa categoría.
- [x] Buscar un término sin coincidencias muestra el estado vacío "NO HAY RESULTADOS".
- [x] Hacer clic en una tarjeta o en su botón "JUGAR" navega a `/juego/[id]` con el juego correcto.
- [x] `/juego/[id]` muestra portada, descripción, stat strip y una tabla de 10 puntuaciones mock.
- [x] `/juego/id-inexistente` responde con la página 404 de Next.js.
- [x] El botón "JUGAR AHORA" en `/juego/[id]` navega a `/juego/[id]/jugar`.
- [x] En `/juego/[id]/jugar`, la puntuación del HUD aumenta automáticamente cada ~220ms mientras no está en pausa ni terminó la partida.
- [x] Pulsar "PAUSA" detiene el incremento de puntuación y muestra el overlay "EN PAUSA"; pulsar "REANUDAR" lo reactiva.
- [x] Pulsar "FIN" abre el modal de fin de partida con la puntuación final congelada.
- [x] Guardar la puntuación en el modal la agrega al array `av_scores` en `localStorage` y muestra el toast "PUNTUACIÓN GUARDADA".
- [x] En `/auth`, enviar el formulario de "Iniciar sesión" guarda el usuario en `localStorage["av_user"]`, actualiza el Nav en toda la app y navega a `/`.
- [x] "JUGAR COMO INVITADO" en `/auth` navega a `/` sin crear sesión.
- [x] Con sesión iniciada, el Nav muestra el nombre de usuario en vez del botón "Iniciar Sesión"; cerrar sesión desde el Nav borra `av_user` y vuelve a mostrar el botón.
- [x] `/salon` muestra tabs por cada juego de `GAMES`, un podio con los 3 primeros puestos y una tabla con el resto de puntuaciones mock.
- [x] Con sesión iniciada, `/salon` muestra la fila "tu mejor marca" al final de la tabla; sin sesión, esa fila no aparece.
- [x] El panel de navegación móvil (hamburguesa) abre y cierra correctamente en viewport angosto.
- [x] Todas las clases visuales usadas (`.card`, `.av-nav`, `.leaderboard`, `.podium`, `.modal`, etc.) provienen de `app/globals.css` ya migrado; no hay estilos duplicados en CSS-in-JS.

## Decisions

- **Sí:** implementar las 5 pantallas completas en un solo spec. Son la misma feature de navegación de la app y comparten Nav/estado de sesión.
- **No:** dejar el Reproductor para otro spec. Aunque es la pantalla más "cercana a juego", en este spec solo es HUD + simulación de puntaje, no lógica de juego real.
- **Sí:** rutas de archivo reales de Next.js (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/auth`, `/salon`) en vez de hash-routing. Aprovecha las optimizaciones nativas del App Router (prefetch, `<Link>`, navegación con historial real).
- **No:** mantener el hash-routing (`location.hash`) del template original. Era una solución para un scaffold sin backend de rutas; no aplica en Next.js.
- **Sí:** nombres de segmento en español (`/juego`, `/salon`), consistentes con el resto del copy en español de la app.
- **Sí:** mantener `localStorage` para `av_user` y `av_scores`, igual que el template. Da una experiencia realista sin necesitar backend.
- **Sí:** copiar `GAMES`, `CATS`, `PLAYERS` y `seededScores()` casi literalmente a `lib/data.ts`, tipados en TypeScript.
- **Sí:** mantener la simulación de partida (`setInterval` incrementando puntaje) en el Reproductor. Es la forma en que el template ilustra el HUD; sigue siendo 100% visual/mock, no hay lógica de juego jugable.
- **No:** guard de autenticación en ninguna ruta. Todas son públicas por ahora; el reproductor usa "INVITADO" si no hay sesión, igual que el template. Se implementará login real (y posibles guards) en un spec futuro.
- **Sí:** estado de sesión (`user`) vía un React Context (`components/user-provider.tsx`) montado en `app/layout.tsx`, en vez de que cada página lea `localStorage` por su cuenta. Evita que el Nav quede desincronizado tras iniciar sesión en `/auth`.
- **No:** leer puntuaciones reales de `av_scores` para la fila "tu mejor marca" en el Salón de la Fama. Se mantiene el valor simulado del template para no introducir lógica nueva no solicitada.
- **Sí:** componentes compartidos en `components/` en la raíz del repo (no `app/_components/`).
- **Sí:** usar las clases ya migradas en `app/globals.css` para toda la parte visual del template; Tailwind solo para utilidades que ese CSS no cubra.

## Risks

| Risk | Mitigation |
| --- | --- |
| `localStorage` deshabilitado o lleno (modo privado del navegador) | Envolver lecturas/escrituras en `try/catch` (igual que el template); si falla, la app sigue funcionando sin persistencia de sesión/puntuaciones. |
| `params` en rutas dinámicas es `Promise` en esta versión de Next.js, no un objeto síncrono | Usar siempre `await params` en `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx`; verificar contra `node_modules/next/dist/docs/` antes de escribir el código. |
| Duplicar estilos: escribir CSS nuevo cuando ya existe una clase equivalente en `globals.css` | Revisar `app/globals.css` antes de agregar cualquier clase o utilidad Tailwind nueva. |

## What is **not** in this spec

- Lógica jugable de cualquiera de los 8 juegos del catálogo.
- Autenticación real, validación de credenciales u OAuth.
- Guards de rutas basados en sesión.
- Lectura de puntuaciones reales (`av_scores`) en el Salón de la Fama.
- Persistencia en servidor o base de datos.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
