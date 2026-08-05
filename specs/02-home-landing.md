# SPEC 02 — Home (landing) de Arcade Vault

> **Status:** Approved
> **Depends on:** [01-pantallas-mvp-visual](./01-pantallas-mvp-visual.md)
> **Date:** 2026-08-02
> **Objective:** Migrar la pantalla "Inicio" de `references/templates/home-about/home.jsx` (sin la parte "about") a `/`, moviendo la Biblioteca actual a `/biblioteca` y actualizando el Nav y todos los enlaces internos para reflejar la nueva estructura de rutas.

## Scope

**In:**

- Ruta `/` — Home (landing): hero con silueta pixel flotante, sección "¿Por qué Arcade Vault?" (4 feature cards), sección "Juegos disponibles ahora" (preview de 6 juegos reales de `GAMES` usando el `GameCard` existente), sección de stats, sección "Actividad en vivo" (ticker de puntuaciones + top jugadores, datos mock), sección "Precios" (plan único gratuito + FAQ, datos mock), CTA final.
- Ruta `/biblioteca` — mismo contenido que hoy vive en `/` (hero corto, buscador, chips de categoría, grid de `GameCard`), sin cambios de lógica, solo de ubicación.
- `components/nav.tsx`: nuevo link "Inicio" → `/`; el link "Biblioteca" pasa a apuntar a `/biblioteca`; `isActive` actualizado para reflejar ambas rutas.
- Actualización de todos los enlaces internos que hoy asumen que `/` es la Biblioteca, para que apunten a `/biblioteca`: botón "JUGAR COMO INVITADO" y redirect post-login en `app/auth/page.tsx`, botón "volver" en `app/juego/[id]/page.tsx`, botón de fin de partida en `components/game-player.tsx`, botón "volver" en `app/salon/page.tsx`.
- Migración del bloque de CSS `HOME PAGE` de `references/templates/home-about/styles.css` a `app/globals.css` (sin el bloque `ABOUT PAGE` que le sigue).
- Animación de scroll-reveal (`IntersectionObserver` vía hook `useReveal`) para las secciones del home, igual que el template.

**Out of scope (for future specs):**

- Página "Acerca de" (`about.jsx`) y su link en el Nav — se implementan en un spec futuro.
- Datos reales para "Actividad en vivo" (ticker de puntuaciones, top jugadores del día) y para el conteo de juegos en Stats (queda fijo en "12+" tal como el template) — siguen siendo mock, igual que se decidió para el Salón de la Fama en spec 01.
- Cualquier lógica de precios/pagos real — la sección "Precios" es puramente visual (plan único gratuito, sin backend de facturación).
- Cambios al Reproductor, Detalle de juego, Auth o Salón más allá de actualizar el destino de sus enlaces a `/`.

## Data model

Esta spec no introduce estructuras de datos nuevas:

- La sección "Juegos disponibles ahora" reutiliza `GAMES` de `lib/data.ts` (ya existente, migrado en spec 01).
- Los datos del ticker de "Actividad en vivo" (7 filas), el top 5 de jugadores y las 3 preguntas del FAQ de "Precios" son arrays literales mock, igual que en el template — se definen inline dentro de `app/page.tsx`, sin exportarse ni persistirse, así que no constituyen un modelo de datos propiamente dicho.

## Implementation plan

1. Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero corto, buscador, chips, grid de `GameCard`), sin cambios de lógica.
2. Actualizar `components/nav.tsx`: agregar link "Inicio" → `/`; cambiar el link "Biblioteca" (desktop y panel móvil) para apuntar a `/biblioteca`; ajustar `isActive` para que `"biblioteca"` reaccione a `/biblioteca` (+ `/juego`) y agregar `"home"` reaccionando solo a `/`.
3. Actualizar los enlaces internos que hoy apuntan a `/` asumiendo que es la Biblioteca, para que apunten a `/biblioteca`: `app/auth/page.tsx` (botón "JUGAR COMO INVITADO" y `router.push` post-login), `app/juego/[id]/page.tsx` (botón "volver"), `components/game-player.tsx` (botón de fin de partida), `app/salon/page.tsx` (botón "volver"). En este punto la app queda funcional con `/` y `/biblioteca` mostrando el mismo contenido (Biblioteca duplicada temporalmente).
4. Migrar el bloque de CSS `HOME PAGE` de `references/templates/home-about/styles.css` a `app/globals.css` (clases `.home`, `.home-hero`, `.home-title`, `.home-silos`, `.home-section`, `.feature-grid`, `.feature-card`, `.mini-rail` *(no se usa, se omite si sobra)*, `.home-stats`, `.home-final`, `.reveal`, etc.), sin el bloque `ABOUT PAGE` siguiente.
5. Reescribir `app/page.tsx` como Home: hook `useReveal` (IntersectionObserver), componente local `FloatingSilhouettes` (SVGs decorativos), componente local `FeatureIcon`, y el componente `Home` con las 6 secciones (hero, why, juegos disponibles ahora usando `GameCard` sobre `GAMES.slice(0, 6)`, stats, actividad en vivo, precios) más el CTA final — migrados literalmente de `home.jsx`, adaptando `navigate(...)` a `<Link>`/`useRouter` de Next.js y las rutas correctas (`/biblioteca`, `/auth`, `/salon`).
6. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual de `/` y `/biblioteca` en el navegador comparando contra `references/templates/home-about/arcade-vault-standalone.html` para verificar paridad visual, incluyendo el scroll-reveal y el panel móvil del Nav con el nuevo link "Inicio".

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/` muestra el nuevo Home: hero con título "EL ARCADE CLÁSICO ESTÁ DE VUELTA", siluetas pixel flotantes y CTAs "EXPLORAR JUEGOS" / "CREAR CUENTA".
- [ ] El botón "EXPLORAR JUEGOS" del hero y el CTA final "INSERTAR MONEDA" navegan a `/biblioteca`.
- [ ] El botón "CREAR CUENTA" del hero navega a `/auth`.
- [ ] La sección "¿Por qué Arcade Vault?" muestra las 4 feature cards (Juegos clásicos, 100% gratis, Ladder boards, Siempre creciendo).
- [ ] La sección "Juegos disponibles ahora" muestra 6 `GameCard` con datos reales de `GAMES`, y el botón "VER TODOS LOS JUEGOS →" navega a `/biblioteca`.
- [ ] La sección de stats muestra los 3 bloques ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING").
- [ ] La sección "Actividad en vivo" muestra el ticker de puntuaciones recientes y el top 5 de jugadores; el botón "VER SALÓN →" navega a `/salon`.
- [ ] La sección "Precios" muestra el plan único gratuito con su lista de beneficios y las 3 preguntas del FAQ; el botón "EMPEZAR GRATIS →" navega a `/auth`.
- [ ] Las secciones del home (excepto el hero) aparecen con la animación de scroll-reveal al hacer scroll hasta ellas.
- [ ] `/biblioteca` muestra exactamente el mismo contenido y comportamiento que antes tenía `/` (hero corto, buscador funcional, chips de categoría funcionales, grid de `GameCard`, estado vacío "NO HAY RESULTADOS").
- [ ] El Nav (desktop y panel móvil) muestra los links "Inicio", "Biblioteca" y "Salón de la Fama" en ese orden, sin "Acerca de".
- [ ] Estando en `/`, el link "Inicio" del Nav aparece activo; estando en `/biblioteca` o `/juego/[id]`, el link "Biblioteca" aparece activo.
- [ ] El logo del Nav sigue navegando a `/`.
- [ ] En `/auth`, tanto "JUGAR COMO INVITADO" como un login/registro exitoso navegan a `/biblioteca` (ya no a `/`).
- [ ] El botón "volver" en `/juego/[id]` navega a `/biblioteca`.
- [ ] El botón de fin de partida (volver) en el Reproductor (`/juego/[id]/jugar`) navega a `/biblioteca`.
- [ ] El botón "volver" en `/salon` navega a `/biblioteca`.
- [ ] No hay ninguna ruta, botón o link que siga apuntando a `/` esperando encontrar la Biblioteca (solo el logo y el link "Inicio" apuntan a `/`, con la semántica de Home).

## Decisions

- **Sí:** mover la Biblioteca de `/` a `/biblioteca` e implementar el Home real en `/`. Es la estructura que el propio template asume (Nav con "Inicio" y "Biblioteca" como pantallas separadas) y lo esperable en un sitio con landing page.
- **No:** dejar el Home en una ruta secundaria (ej. `/inicio`) y mantener la Biblioteca en `/`. Habría dejado `/` apuntando al catálogo de juegos en vez de al landing, algo poco convencional y contrario a la intención del template.
- **Sí:** agregar solo el link "Inicio" al Nav en este spec, omitiendo "Acerca de". La página about no se implementa acá; agregar el link antes que la página llevaría a un 404.
- **Sí:** reutilizar el `GameCard` existente (con tilt 3D) para la sección "Juegos disponibles ahora", en vez de crear un `MiniCard` nuevo como en el template. Menos código nuevo y consistencia visual con la Biblioteca, a costa de que las tarjetas queden más grandes que en el diseño original de esa franja.
- **Sí:** copiar los mocks del template tal cual para "Actividad en vivo", "Precios" y el conteo fijo "12+" en Stats. Mismo criterio que spec 01 con el Salón de la Fama: 100% visual, sin introducir lógica nueva no solicitada, aunque el número quede desalineado con los 8 juegos reales de `lib/data.ts`.
- **Sí:** actualizar todos los enlaces internos que hoy apuntan a `/` (auth, detalle de juego, reproductor, salón) para que apunten a `/biblioteca`. Su intención semántica siempre fue "volver al catálogo de juegos", no "ir al landing".
- **Sí:** mantener `FloatingSilhouettes`, `FeatureIcon` y el hook `useReveal` como declaraciones locales dentro de `app/page.tsx`, igual que en el template, en vez de extraerlos a `components/`. No se reutilizan en ninguna otra pantalla.
- **Sí:** migrar el bloque CSS `HOME PAGE` de `references/templates/home-about/styles.css` a `app/globals.css`, reutilizando las clases ya definidas ahí en vez de escribir Tailwind nuevo para el home.
- **No:** migrar el bloque CSS `ABOUT PAGE` que sigue en el mismo archivo. Queda fuera de este spec junto con `about.jsx`.

## Risks

| Risk | Mitigation |
| --- | --- |
| Quedan enlaces o `router.push` apuntando a `/` con la vieja semántica de "Biblioteca", causando que el usuario caiga en el landing en vez del catálogo | Grep exhaustivo de `href="/"` y `push("/")` en `app`/`components` antes de cerrar el spec (ya identificados: nav, auth, detalle de juego, reproductor, salón); verificar que todos apunten a `/biblioteca` salvo el logo y el link "Inicio". |
| Durante el paso intermedio (Biblioteca duplicada en `/` y `/biblioteca`) alguien navega o testea contra `/` esperando ya el Home nuevo | Es un estado transitorio dentro de un mismo spec/commit, no un release intermedio; no requiere mitigación adicional más allá de completar los pasos en orden. |
| Colisión de nombres de clases CSS entre el bloque `HOME PAGE` migrado y clases ya existentes en `app/globals.css` | Revisar `app/globals.css` antes de pegar el bloque nuevo para confirmar que no haya clases duplicadas con otro significado; el bloque `HOME PAGE` del template usa prefijos propios (`.home-*`, `.feature-*`, `.stat-*`) que no chocan con los ya migrados. |
| El conteo fijo "12+ JUEGOS" en Stats queda desactualizado a medida que se agreguen juegos reales a `lib/data.ts` | Riesgo aceptado por decisión explícita (ver sección Decisions); se puede resolver en un spec futuro si se vuelve confuso. |
| `GameCard` fue diseñado para el grid de la Biblioteca (tamaño, spacing) y podría no verse bien dentro de `.mini-rail`/`.feature-grid` del layout del home | Ajustar únicamente el contenedor/grid CSS de la sección "Juegos disponibles ahora" si hace falta (sin tocar `GameCard` en sí) durante la revisión visual manual del paso 6. |
