# SPEC 04 — Autenticación real con Supabase

> **Status:** Implemented
> **Depends on:** [03-about-contacto-resend](./03-about-contacto-resend.md)
> **Date:** 2026-08-06
> **Objective:** Configurar el cliente de Supabase (browser, server y proxy) y reemplazar la autenticación mock de `UserProvider` (`localStorage`) por Supabase Auth real con email y contraseña, incluyendo confirmación de email y recuperación de contraseña.

## Scope

**In:**

- Configuración del cliente de Supabase: paquetes `@supabase/supabase-js` + `@supabase/ssr`; `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server) y `lib/supabase/proxy.ts` (helper `updateSession`) + `proxy.ts` en la raíz (convención de este Next.js — reemplaza `middleware.ts`) para refrescar la sesión en cada request.
- Variables de entorno de cliente `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example`.
- Registro de cuenta (usuario/display name + email + contraseña) vía Server Action, usando `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`.
- Confirmación de email obligatoria antes de poder iniciar sesión (queda activada). `app/auth/confirm/route.ts` resuelve tanto el link de confirmación (`verifyOtp` con `type=email`) como el de recuperación (`type=recovery`).
- Inicio de sesión con email + contraseña vía Server Action; el tab "INICIAR SESIÓN" de `/auth` cambia su campo "Usuario" por "Correo electrónico".
- Cierre de sesión: el botón ya existente en el Nav pasa a llamar `supabase.auth.signOut()` (client-side) en vez de borrar `localStorage`.
- Recuperación de contraseña:
  - `/auth/recuperar` — formulario que pide el email y llama a `resetPasswordForEmail`.
  - `/auth/nueva-contrasena` — página para definir la nueva contraseña tras el click en el correo (`updateUser({ password })`); protegida, exige sesión de recuperación activa (si no hay sesión, redirige a `/auth/recuperar`).
  - Link "¿Olvidaste tu contraseña?" agregado al tab de login en `/auth`.
- SMTP personalizado con Resend en el dashboard de Supabase (Authentication → Emails → SMTP Settings), reutilizando `RESEND_API_KEY`, para los correos de confirmación y recuperación. Es configuración de dashboard, documentada en el spec, no código.
- Plantillas de email de Supabase (confirmación y recuperación) ajustadas para apuntar a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...&next=...`.
- Site URL / Redirect URLs configurados en el dashboard de Supabase (Authentication → URL Configuration) para que los links de los correos apunten al dominio correcto.
- Reescritura de `components/user-provider.tsx`: `user` pasa a ser `{ name: string; email: string } | null` derivado de la sesión real de Supabase (`onAuthStateChange` sobre el cliente browser); se elimina `login()` manual; `logout()` llama a `supabase.auth.signOut()`.
- Modo invitado: se mantiene igual — "JUGAR COMO INVITADO" sigue navegando directo a `/biblioteca` sin crear sesión.
- Ajustes mínimos en `app/salon/page.tsx` y `components/game-player.tsx` para seguir compilando contra la nueva forma de `user` (`user.name` sigue existiendo), sin cambios de lógica de puntuación.
- `.env.example` actualizado con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Alta de `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.

**Out of scope (for future specs):**

- OAuth (Google/GitHub): los botones siguen visibles pero sin funcionalidad, igual que hoy.
- Realtime y Edge Functions: uso futuro mencionado explícitamente por el usuario, no entra en este spec.
- Persistencia de puntuaciones/leaderboard en Supabase (tabla `scores`, etc.): sigue en `localStorage` mock.
- Migración del catálogo de juegos (`lib/data.ts`) a una tabla de Supabase.
- Perfiles de usuario extendidos (avatar, bio, etc.) más allá del `display_name`.
- Roles/autorización (admin, etc.): no existe ese concepto todavía en la app.
- Row Level Security (RLS): no aplica en este spec porque no se crean tablas propias, solo se usa `auth.users` (gestionado internamente por Supabase).
- Rate limiting / CAPTCHA propios más allá de los límites por defecto de Supabase Auth.
- Eliminar cuenta o cambiar email.
- Plantilla/notificación "tu contraseña cambió" (`password_changed` de Supabase): no se activa en este spec.

## Data model

```ts
// components/user-provider.tsx
export type AuthUser = { name: string; email: string } | null;

type UserContextValue = {
  user: AuthUser;
  loading: boolean; // true hasta resolver la sesión inicial de Supabase
  logout: () => Promise<void>;
};
```

```ts
// app/auth/actions.ts — Server Actions
type AuthActionResult = { ok: true } | { ok: false; error: string };

async function iniciarSesion(email: string, password: string): Promise<AuthActionResult>;
async function crearCuenta(
  displayName: string,
  email: string,
  password: string,
): Promise<AuthActionResult>;
async function enviarCorreoRecuperacion(email: string): Promise<AuthActionResult>;
async function actualizarContrasena(password: string): Promise<AuthActionResult>;
```

```ts
// lib/supabase/client.ts — cliente browser
function createClient(): SupabaseClient; // createBrowserClient(url, publishableKey)

// lib/supabase/server.ts — cliente server (Server Components, Server Actions, Route Handlers)
async function createClient(): Promise<SupabaseClient>; // createServerClient(...) usando cookies() de next/headers

// lib/supabase/proxy.ts
async function updateSession(request: NextRequest): Promise<NextResponse>;

// proxy.ts (raíz del repo — convención de este Next.js, reemplaza middleware.ts)
export async function proxy(request: NextRequest): Promise<NextResponse>;
export const config: { matcher: string[] };
```

```ts
// app/auth/confirm/route.ts — GET
// Lee token_hash, type (EmailOtpType) y next de la query string.
// Llama supabase.auth.verifyOtp({ type, token_hash }) con el cliente server.
// Éxito → redirect(next); error → redirect("/auth?error=...")
// Sirve tanto para el link de confirmación de registro (type=email) como para el de recuperación (type=recovery).
```

Variables de entorno (públicas, con prefijo `NEXT_PUBLIC_`, documentadas en `.env.example` sin valores reales):

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: key pública usada por el cliente browser y server.

Convención: todas las Server Actions devuelven `AuthActionResult`, mismo patrón que `ContactActionResult` de spec 03 — no exponen detalles internos del error de Supabase, solo un mensaje genérico apto para mostrar en la UI.

## Implementation plan

1. Instalar `@supabase/supabase-js` y `@supabase/ssr`; agregar a `.env.example` las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sin valores reales) y completarlas con los valores reales del proyecto en `.env.local`.
2. Crear `lib/supabase/client.ts` (cliente browser) y `lib/supabase/server.ts` (cliente server), sin conectarlos todavía a ninguna pantalla — el sistema sigue funcionando igual que antes.
3. Crear `lib/supabase/proxy.ts` con `updateSession()` y `proxy.ts` en la raíz del repo que lo invoca en cada request (con `matcher` excluyendo assets estáticos). La sesión de Supabase ya se refresca en cada navegación, aunque nada la use todavía.
4. Reescribir `components/user-provider.tsx`: `AuthUser`, suscripción a `supabase.auth.onAuthStateChange` sobre el cliente browser, `logout()` llamando a `supabase.auth.signOut()`. Ajustar los consumidores existentes (`nav.tsx`, `salon/page.tsx`, `game-player.tsx`) para que compilen contra la nueva forma de `user`, sin tocar su lógica de puntuación/UI. El sistema queda funcional con sesión siempre `null` (nada crea sesiones todavía).
5. Crear `app/auth/actions.ts` con `iniciarSesion` y `crearCuenta`. Conectar `/auth`: el tab de login pide email + contraseña, el tab de registro pide usuario (display name) + email + contraseña; éxito → redirect a `/biblioteca`; error → mensaje inline con el formulario reactivado (mismo patrón que el contacto de spec 03).
6. Crear `app/auth/confirm/route.ts` (maneja `type=email` y `type=recovery` vía `verifyOtp`). Configurar en el dashboard de Supabase: SMTP personalizado con Resend, Site URL, Redirect URLs, y las plantillas de email de confirmación y recuperación apuntando a `/auth/confirm`. En este punto registro + confirmación + login funcionan de punta a punta.
7. Agregar `enviarCorreoRecuperacion` y `actualizarContrasena` a `app/auth/actions.ts`. Crear `app/auth/recuperar/page.tsx` (formulario de email) y `app/auth/nueva-contrasena/page.tsx` (formulario de nueva contraseña, protegido — sin sesión de recuperación activa redirige a `/auth/recuperar`). Agregar el link "¿Olvidaste tu contraseña?" al tab de login de `/auth`.
8. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual completo — registro → correo de confirmación vía Resend → confirmar → login → logout → recuperar contraseña → correo de recuperación → definir nueva contraseña → login con la nueva contraseña; confirmar que el modo invitado sigue funcionando sin sesión.

## Acceptance criteria

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] Registrarse con usuario (display name) + email + contraseña crea un usuario real en Supabase Auth y no permite iniciar sesión hasta confirmar el email.
- [x] El correo de confirmación llega vía Resend (SMTP personalizado); al hacer click en el link, la cuenta queda confirmada y el usuario termina con sesión iniciada en `/biblioteca`.
- [x] Iniciar sesión con email + contraseña de una cuenta ya confirmada crea la sesión y redirige a `/biblioteca`.
- [x] Iniciar sesión con una cuenta sin confirmar, o con credenciales incorrectas, muestra un mensaje de error inline sin crear sesión y sin romper el formulario.
- [x] El Nav muestra "Iniciar Sesión" cuando no hay sesión, y el nombre (display name) del usuario cuando sí la hay.
- [x] Cerrar sesión desde el Nav limpia la sesión de Supabase y el Nav vuelve a mostrar "Iniciar Sesión".
- [x] "JUGAR COMO INVITADO" en `/auth` sigue navegando directo a `/biblioteca` sin crear ninguna sesión.
- [x] `/auth/recuperar` envía el correo de recuperación vía Resend cuando el email ingresado corresponde a una cuenta existente.
- [x] El link del correo de recuperación lleva a `/auth/nueva-contrasena` con una sesión de recuperación activa.
- [x] Definir la nueva contraseña en `/auth/nueva-contrasena` permite iniciar sesión después con la nueva contraseña, y la vieja contraseña deja de funcionar.
- [x] Acceder directamente a `/auth/nueva-contrasena` sin haber pasado por el link de recuperación redirige a `/auth/recuperar`.
- [x] Recargar la página (F5) en cualquier ruta estando logueado mantiene la sesión iniciada.
- [x] `/salon` y el Reproductor (`/juego/[id]/jugar`) siguen funcionando sin errores, mostrando el nombre del usuario autenticado donde corresponde, sin cambios en la lógica de puntuación.
- [x] `.env.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales.

## Decisions

- **Sí:** alcance acotado a "base + Auth con email/contraseña", dejando fuera OAuth, realtime, edge functions, persistencia de puntuaciones y catálogo de juegos. Sigue el patrón incremental de los specs anteriores; el usuario confirmó explícitamente que realtime/edge functions y OAuth son para specs futuros.
- **No:** OAuth Google/GitHub en este spec. Los botones siguen visibles pero inertes, como hoy.
- **Sí:** `proxy.ts` en vez de `middleware.ts`. Esta versión de Next.js (16.2.12) renombró la convención — `middleware.ts` está deprecado, según `node_modules/next/dist/docs`.
- **Sí:** paquetes `@supabase/supabase-js` + `@supabase/ssr`, siguiendo la guía oficial de Supabase para Next.js App Router (verificado vía `search_docs`).
- **Sí:** dos clientes (`lib/supabase/client.ts` browser, `lib/supabase/server.ts` server) + `lib/supabase/proxy.ts`/`proxy.ts` para refresco de sesión. Patrón recomendado por Supabase para SSR con cookies.
- **Sí:** confirmación de email obligatoria (queda activada por defecto). Decisión explícita del usuario.
- **Sí:** el login pide email en vez de "Usuario". Supabase Auth autentica con email; el "Usuario" ingresado al registrarse pasa a ser un display name guardado en `user_metadata`.
- **No:** tabla `profiles` aparte para resolver username→email en el login. Más complejidad sin necesidad real; descartada a favor de pedir email directamente.
- **Sí:** recuperación de contraseña incluida en este spec (`/auth/recuperar` + `/auth/nueva-contrasena`). Decisión explícita del usuario.
- **Sí:** SMTP personalizado con Resend para los correos de Supabase Auth, en vez del mailer por defecto (rate limit muy bajo, insuficiente para probar el flujo real). Reutiliza `RESEND_API_KEY` ya configurada.
- **Sí:** `app/auth/confirm/route.ts` único, reutilizado para `type=email` y `type=recovery` (mismo mecanismo `verifyOtp`, distinto `next`).
- **Sí:** `UserProvider` rediseñado — `user: {name, email} | null` derivado de `onAuthStateChange`, se elimina `login()` manual, `logout()` llama a `supabase.auth.signOut()`. Decisión explícita del usuario.
- **Sí:** el modo invitado se mantiene igual, sin sesión. Decisión explícita del usuario.
- **No:** persistencia de puntuaciones en Supabase en este spec. `game-player.tsx`/`salon` siguen usando `localStorage` mock; solo se ajusta la forma de `user` para que compile.
- **No:** RLS ni tablas propias en este spec — solo se usa `auth.users`, gestionado internamente por Supabase.

## Risks

| Risk                                                                                                                                                                                                                  | Mitigation                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Confundir `middleware.ts` con `proxy.ts`: los ejemplos oficiales de Supabase usan `middleware.ts`, pero en este Next.js (16.2.12) esa convención está deprecada y renombrada a `proxy.ts` (función exportada `proxy`) | Documentado explícitamente en este spec (Data model, paso 3 del plan); si no se sigue, el archivo simplemente no se ejecuta y la sesión nunca se refresca                                  |
| Escáneres de correo corporativo pueden "gastar" el link de un solo uso de confirmación/recuperación antes de que el usuario haga click real, mostrando un error                                                       | Riesgo aceptado por ahora (comportamiento por defecto de Supabase Auth); se puede mitigar en un spec futuro con una página intermedia de confirmación manual si se vuelve un problema real |
| Rate limits de Supabase (recuperación de contraseña: 1 cada 60s; límite combinado de emails por hora) pueden bloquear pruebas repetidas durante desarrollo                                                            | El SMTP personalizado con Resend (ya decidido) levanta el límite de envío del mailer por defecto; hay que tenerlo en cuenta igual al probar el flujo varias veces seguidas                 |
| Las Server Actions (`iniciarSesion`, `crearCuenta`, `enviarCorreoRecuperacion`, `actualizarContrasena`) son endpoints públicos invocables sin pasar por la UI                                                         | Supabase Auth ya aplica sus propios rate limits y validaciones server-side; no se agrega protección extra en este spec, mismo criterio aceptado en spec 03 para el formulario de contacto  |
| Flash inicial "sin sesión" mientras `UserProvider` resuelve la sesión de Supabase de forma asíncrona en el cliente (antes era síncrono vía `localStorage`)                                                            | Campo `loading` en el contexto; se acepta un parpadeo breve como parte del alcance — SSR completo del estado de auth queda fuera de este spec                                              |
| Desincronización de cookies entre server y browser si `proxy.ts` no propaga bien la `NextResponse`                                                                                                                    | Seguir al pie de la letra el patrón oficial de Supabase verificado contra su documentación (paso 3 del plan)                                                                               |

## Implementation notes

Durante la verificación de los criterios de aceptación (paso 8) se encontraron y corrigieron dos bugs de sincronización cliente/servidor no cubiertos explícitamente por el plan original:

- **Nav no se actualizaba tras el login:** `iniciarSesion` corre en el servidor (cliente de `lib/supabase/server.ts`) y establece la sesión vía cookies, pero `UserProvider` depende del cliente _browser_ y de `onAuthStateChange`, que solo dispara al reinicializarse o por acciones hechas con esa misma instancia. Una navegación soft (`router.push`) no reinicializaba el cliente browser, así que el Nav quedaba mostrando "Iniciar Sesión" hasta un F5. Fix: `app/auth/page.tsx` usa `window.location.href` (navegación completa) tras un login exitoso en vez de `router.push`. El registro no lo necesita porque no deja sesión activa (falta confirmar el email), y `nueva-contrasena-form.tsx` tampoco porque la sesión de recuperación ya se estableció antes vía un redirect completo desde `/auth/confirm`.
- **El Reproductor mostraba "INVITADO" con sesión iniciada:** `components/game-player.tsx` inicializaba el nombre con `useState(user ? user.name : "INVITADO")`, que captura un valor fijo en el primer render. Como `user` resuelve de forma asíncrona, en una carga directa de la página el valor quedaba congelado en "INVITADO" para siempre, aunque el Nav sí mostrara la sesión correctamente. Fix: el nombre se deriva en cada render (`nameOverride ?? (user ? user.name : "INVITADO")`) en vez de fijarse una sola vez, preservando el override manual del jugador en el prompt de guardar puntuación.

## What is **not** in this spec

- OAuth (Google/GitHub): los botones siguen visibles pero sin funcionalidad.
- Realtime y Edge Functions de Supabase.
- Persistencia de puntuaciones/leaderboard en Supabase (sigue en `localStorage` mock).
- Migración del catálogo de juegos (`lib/data.ts`) a una tabla de Supabase.
- Perfiles de usuario extendidos (avatar, bio, etc.) más allá del `display_name`.
- Roles/autorización (admin, etc.).
- Row Level Security (RLS) y tablas propias — este spec solo usa `auth.users`.
- Rate limiting / CAPTCHA propios más allá de los límites por defecto de Supabase Auth.
- Eliminar cuenta o cambiar email.
- Plantilla/notificación "tu contraseña cambió" de Supabase.

Cada uno de estos, si se implementa, va en su propio spec.
