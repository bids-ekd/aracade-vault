# SPEC 03 — Acerca de + envío de correo de contacto

> **Status:** Approved
> **Depends on:** [02-home-landing](./02-home-landing.md)
> **Date:** 2026-08-05
> **Objective:** Implementar la ruta `/acerca-de` replicando exactamente `references/templates/home-about/about.jsx` (hero, highlights, divisor y formulario de contacto), donde el formulario envía un correo real vía Resend a través de una Server Action.

## Scope

**In:**

- Ruta `/acerca-de`: hero ("ACERCA DE ARCADE VAULT" + misión + 3 highlights), divisor animado y sección de contacto — réplica exacta de `references/templates/home-about/about.jsx` (mismo copy, mismas 3 secciones, mismo scroll-reveal vía `IntersectionObserver`).
- Server Action (`app/acerca-de/actions.ts`) que envía el correo del formulario de contacto usando el paquete `resend`.
- Remitente `onboarding@resend.dev` (sandbox de Resend, sin dominio propio verificado).
- Destinatario configurado únicamente por variable de entorno `RESEND_TO_EMAIL`, sin valor por defecto hardcodeado en el código.
- `Reply-To` del correo enviado = email ingresado por el visitante en el formulario.
- Validación server-side básica dentro de la Server Action (campos no vacíos + formato de email), además de la validación cliente ya existente en el template (shake de 400ms).
- Manejo de error de envío: si la Server Action falla, el formulario permanece visible con los datos cargados, se muestra un mensaje de error inline y el botón vuelve a estar habilitado para reintentar.
- `.env.example` en la raíz documentando `RESEND_API_KEY` y `RESEND_TO_EMAIL` (sin valores reales).
- `components/nav.tsx`: nuevo link "Acerca de" → `/acerca-de` (desktop y panel móvil), con `isActive` actualizado para reflejar la nueva ruta.
- Migración del bloque de CSS `ABOUT PAGE` de `references/templates/home-about/styles.css` a `app/globals.css`, igual que se hizo con el bloque `HOME PAGE` en spec 02.
- Alta de la dependencia `resend` en `package.json`.

**Out of scope (for future specs):**

- Protección anti-spam (honeypot, captcha, rate limiting) en el formulario de contacto.
- Verificación de un dominio propio en Resend — mientras tanto, el sandbox `onboarding@resend.dev` solo puede entregar al correo verificado de la cuenta Resend, aunque `RESEND_TO_EMAIL` apunte a otro.
- Persistencia de los mensajes de contacto (no se guardan en `localStorage` ni en ninguna base de datos): si el correo se envía con éxito pero nadie lo lee, el mensaje se pierde.
- Panel de administración para ver o gestionar mensajes recibidos.
- Cualquier contenido o sección no presente en `about.jsx` (redes sociales, mapa, equipo, etc.).

## Data model

```ts
// Estado del formulario de contacto (cliente), igual que about.jsx
type ContactForm = { name: string; email: string; msg: string };

// app/acerca-de/actions.ts — Server Action
type ContactActionResult = { ok: true } | { ok: false; error: string };

async function enviarMensajeContacto(form: ContactForm): Promise<ContactActionResult>
```

Variables de entorno (solo servidor, sin prefijo `NEXT_PUBLIC_`, documentadas en `.env.example` sin valores reales):

- `RESEND_API_KEY`: API key de Resend usada por la Server Action.
- `RESEND_TO_EMAIL`: dirección que recibe los mensajes del formulario. Sin valor por defecto en código — si falta, la Server Action devuelve `{ ok: false, error: "..." }` sin intentar enviar.

Convención: `ContactActionResult` es lo único que la Server Action retorna al cliente (no expone detalles internos del error de Resend, solo un mensaje genérico apto para mostrar en la UI).

## Implementation plan

1. Instalar la dependencia `resend` (`npm install resend`) y crear `.env.example` en la raíz documentando `RESEND_API_KEY` y `RESEND_TO_EMAIL` (sin valores reales).
2. Migrar el bloque de CSS `ABOUT PAGE` de `references/templates/home-about/styles.css` a `app/globals.css` (clases `.about`, `.about-hero`, `.about-title`, `.highlight-row`, `.highlight`, `.hl-icon`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`, `.contact-grid`, `.contact-intro`, `.contact-form`, `.terminal-success`, `.term-bar`, `.term-body`, etc.), reutilizando la clase `.field` ya existente en `globals.css` sin duplicarla.
3. Crear `app/acerca-de/actions.ts` con la Server Action `enviarMensajeContacto`: valida campos no vacíos y formato de email; si faltan `RESEND_API_KEY` o `RESEND_TO_EMAIL` devuelve `{ ok: false, error: "..." }` sin llamar a Resend; si están presentes, envía el correo con `from: "onboarding@resend.dev"`, `to: process.env.RESEND_TO_EMAIL`, `reply_to: form.email`, y devuelve `{ ok: true }` o `{ ok: false, error: "..." }` según la respuesta de Resend.
4. Crear `app/acerca-de/page.tsx` (Client Component) migrando `about.jsx`: hook `useReveal` local (mismo patrón que Home), componente local `HighlightIcon`, hero con los 3 highlights, divisor animado y formulario de contacto controlado con `useState`. El sistema queda navegable en `/acerca-de` con la validación de campos vacíos (shake) ya funcionando, aunque el envío real de correo aún no está conectado.
5. Conectar el `onSubmit` del formulario a `enviarMensajeContacto`: estado "enviando" mientras se resuelve, vista de éxito (`terminal-success`, igual que el template) cuando `{ ok: true }`, y mensaje de error inline + formulario reactivado para reintentar cuando `{ ok: false }`.
6. Actualizar `components/nav.tsx`: agregar el link "Acerca de" → `/acerca-de` en desktop y panel móvil, y extender `isActive` para reconocer la nueva ruta.
7. Revisión final: `npm run lint` y `npm run build` sin errores; recorrido manual de `/acerca-de` comparando contra `references/templates/home-about/arcade-vault-standalone.html` para paridad visual; prueba real configurando `RESEND_API_KEY`/`RESEND_TO_EMAIL` de prueba y verificando que el correo llega.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/acerca-de` muestra el hero "ACERCA DE ARCADE VAULT" con el texto de misión y los 3 highlights (HECHO CON ❤️, JUEGOS EN HTML, PROYECTO EN CONSTANTE CRECIMIENTO).
- [ ] El divisor animado y la sección de contacto aparecen con la animación de scroll-reveal al hacer scroll hasta ellos.
- [ ] Enviar el formulario de contacto con algún campo vacío dispara el shake de 400ms y no llama a la Server Action.
- [ ] Enviar el formulario con los 3 campos completos y `RESEND_API_KEY`/`RESEND_TO_EMAIL` configuradas envía un correo real a `RESEND_TO_EMAIL` vía Resend, con `reply_to` igual al email ingresado en el formulario.
- [ ] Tras un envío exitoso, el formulario se reemplaza por la vista `terminal-success` con el nombre del visitante en mayúsculas, igual que el template.
- [ ] El botón "ENVIAR OTRO MENSAJE" en la vista de éxito vacía el formulario y permite enviar un nuevo mensaje.
- [ ] Si `RESEND_API_KEY` o `RESEND_TO_EMAIL` faltan, o Resend responde con error, el formulario muestra un mensaje de error inline y el botón de envío vuelve a estar habilitado.
- [ ] El Nav (desktop y panel móvil) muestra el link "Acerca de" después de "Salón de la Fama".
- [ ] Estando en `/acerca-de`, el link "Acerca de" del Nav aparece activo.
- [ ] `.env.example` existe en la raíz y documenta `RESEND_API_KEY` y `RESEND_TO_EMAIL` sin valores reales.

## Decisions

- **Sí:** ruta `/acerca-de` en español, consistente con `/biblioteca` y `/salon`.
- **No:** `/about` en inglés. Pese al precedente de `/auth`, se prioriza mantener la mayoría de rutas navegables en español.
- **Sí:** agregar el link "Acerca de" al Nav en este spec, ahora que la página existe. Spec 02 lo había dejado fuera explícitamente para no llevar a un 404.
- **Sí:** réplica 1:1 del contenido de `about.jsx`, sin agregar ni quitar secciones ni copy.
- **Sí:** Server Action en vez de Route Handler para el envío del correo. Menos código, se integra directo con el formulario controlado existente sin necesitar un endpoint HTTP aparte.
- **No:** Route Handler (`app/api/contacto`). Se descarta por ahora; se puede migrar a uno en el futuro si algo externo necesita invocar el mismo envío.
- **Sí:** remitente sandbox `onboarding@resend.dev`. No requiere verificar un dominio propio todavía; se acepta la limitación de que solo entrega al correo verificado de la cuenta Resend hasta que se verifique un dominio.
- **Sí:** `RESEND_TO_EMAIL` sin valor por defecto hardcodeado en el código. Evita comprometer una dirección real en el repositorio; cada entorno de despliegue la configura por su cuenta.
- **Sí:** `reply_to` = email del visitante. Permite responder directo desde el cliente de correo del equipo.
- **Sí:** mensaje de error inline + reintento en vez de reusar el shake existente para errores de envío. El shake ya comunica "falta un campo"; un error de red/API es una situación distinta y merece su propio mensaje.
- **Sí:** validación server-side básica (no vacío + formato de email) dentro de la Server Action, además de la validación cliente. Una Server Action es un endpoint público invocable sin pasar por la UI, así que no puede confiar solo en la validación del cliente.
- **No:** protección anti-spam (honeypot, captcha, rate limiting). Fuera de alcance por ahora; se evalúa en un spec futuro si se vuelve necesario.
- **No:** persistencia de los mensajes de contacto. Se envían por correo y no se guardan en ningún lado.

## Risks

| Risk | Mitigation |
| --- | --- |
| El sandbox `onboarding@resend.dev` solo entrega al correo verificado de la cuenta Resend, no a cualquier `RESEND_TO_EMAIL` | Documentado en `.env.example`; para producción real hay que verificar un dominio propio en Resend (fuera de alcance de este spec). |
| `RESEND_API_KEY` expuesta accidentalmente (ej. commiteada) | `.env*` ya está en `.gitignore`; `.env.example` no lleva valores reales, solo los nombres de las variables. |
| Resend caído, con rate limit, o `RESEND_API_KEY` inválida | Manejo de error inline en el formulario con reintento manual del usuario (ver Acceptance criteria). |
| La Server Action es un endpoint público sin autenticación: cualquiera que pueda hacer el POST puede disparar envíos, sin límite | Riesgo aceptado por decisión explícita (anti-spam fuera de alcance en este spec); se puede mitigar en un spec futuro con rate limiting o captcha si se vuelve un problema real. |

## What is **not** in this spec

- Protección anti-spam (honeypot, captcha, rate limiting).
- Verificación de un dominio propio en Resend.
- Persistencia de los mensajes de contacto.
- Panel de administración para ver o gestionar mensajes recibidos.
- Cualquier contenido o sección no presente en `about.jsx`.

Cada uno de estos, si se implementa, va en su propio spec.
