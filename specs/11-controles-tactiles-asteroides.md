# SPEC 11 — Controles táctiles y responsive del reproductor (piloto: Asteroides)

> **Status:** Approved
> **Depends on:** [01-pantallas-mvp-visual](./01-pantallas-mvp-visual.md), [05-asteroides-juego-real](./05-asteroides-juego-real.md)
> **Date:** 2026-08-09
> **Objective:** Agregar un panel de controles táctiles reusable (`TouchControls`), ubicado completamente fuera de la pantalla del juego (layout tipo GameBoy), y las reglas de viewport necesarias para que Asteroides —como juego piloto— sea completamente jugable en un dispositivo con pantalla táctil, en cualquier orientación, dejando el patrón listo para que los otros 3 motores reales lo adopten en specs futuros.

## Scope

**In:**

- Componente nuevo y reusable `components/games/touch-controls.tsx`: panel DOM configurable (lista de botones con `id`/ícono/acción/posición opcional), pointer events (`pointerdown`/`pointerup`/`pointercancel`) mapeados a callbacks `onPress(action)`/`onRelease(action)`. No dibuja nada en el `<canvas>`, no lo toca el motor.
- Integración en `components/games/asteroids/asteroids-canvas.tsx`: detecta un dispositivo táctil vía `matchMedia("(pointer: coarse)")`, y si aplica renderiza `TouchControls` con 4 botones (rotar-izquierda, rotar-derecha, empuje, disparo) cableados a los mismos `heldRef`/`shootQueuedRef` que ya alimenta el teclado — el `AsteroidsInput` que recibe `engine.ts` no cambia.
- Panel de controles **totalmente fuera de `.crt`** (layout tipo GameBoy real: la "pantalla" arriba, el "cuerpo con botones" abajo, piezas separadas — no una sub-sección superpuesta ni una franja dentro del mismo bezel). Cluster izquierdo en forma de cruz/D-pad (empuje arriba, rotar-izquierda/rotar-derecha a los costados); botón de disparo grande y redondo a la derecha. Estilo pixel/neón consistente con `.btn`. El wiring (`heldRef`/`shootQueuedRef`) sigue viviendo en `asteroids-canvas.tsx` (adentro de `.game-arena`); llega al panel externo vía `createPortal` a un nodo que `game-player.tsx` publica por Context (`components/games/touch-panel-portal.tsx`) — sin tocar `GameCanvasProps`. _(Decisión revisada dos veces durante la implementación — ver Decisions)._
- `touch-action: none` en el área de juego (`.game-arena`) mientras se juega desde un dispositivo táctil, para evitar scroll/pinch-zoom accidental; cada botón del panel también lo trae por su cuenta.
- Ajustes de CSS responsive en `app/globals.css` **acotados a la pantalla de juego** (`.av-player`, `.player-hud`, `.crt`/`.crt-screen`, panel de controles, modal de fin de partida) para viewports táctiles chicos, jugando en cualquier orientación.
- Verificación manual en un dispositivo o emulador táctil real de que Asteroides es jugable de punta a punta por touch: empujar, rotar, disparar, pausa, fin, guardar puntuación, jugar de nuevo — en portrait y en landscape.

**Out of scope (para specs futuros):**

- Controles táctiles para Tetris, Arkanoid, Snake — siguen con teclado (Arkanoid además mouse) exactamente igual que hoy. Reusarán `TouchControls` en specs futuros, uno por motor.
- Auditoría o ajustes responsive del resto de la plataforma (nav, biblioteca, home, ficha, salón) — ya tienen media queries propias, no se tocan salvo que algo se vea roto al revisar la pantalla de juego.
- Gestos tipo swipe — se descartó a favor de botones on-screen.
- Optimizar el layout específicamente para portrait (más allá de que sea jugable) — el lienzo lógico 800×600 (4:3) se ve más chico en portrait que en landscape, pero ninguna spec pide rediseñar el HUD/CRT/panel para aprovechar mejor ese caso. Se reconsidera si se vuelve un pedido real.
- Vibración/haptic feedback al tocar los botones.
- Multi-touch avanzado o gestos de más de un dedo.
- Cambios al contrato compartido `GameEngineState`/`GameCanvasProps` (`lib/games/types.ts`) — el touch se resuelve entero en `asteroids-canvas.tsx` + `touch-controls.tsx`.
- Cualquier cambio a `components/games/asteroids/engine.ts` — el motor sigue sin saber que el touch existe.
- Soporte de gamepad físico (Bluetooth/USB) — esto es específicamente pantalla táctil.

## Data model

**1. Registro de qué motores ya tienen touch** (`lib/games/touch.ts`, mismo patrón que `SKINNED_GAME_SLUGS`):

```ts
import type { RealGameSlug } from "@/lib/games/registry";

export const TOUCH_ENABLED_GAME_SLUGS: readonly RealGameSlug[] = ["asteroides"];
```

`game-player.tsx` lo usa para decidir si monta el nodo del panel de controles y aplica `touch-action: none` — nada de esto se activa para Tetris/Arkanoid/Snake todavía.

**2. Hook compartido de detección táctil** (`components/games/use-touch-device.ts`):

```ts
// true si matchMedia("(pointer: coarse)") matchea; false en SSR y en desktop/mouse.
export function useTouchDevice(): boolean;
```

**3. Panel de controles, reusable** (`components/games/touch-controls.tsx`):

```ts
export type TouchButtonConfig = {
  id: string; // libre, p. ej. "rotate-left" | "thrust" | "shoot"
  label: string; // glifo corto mostrado en el botón, p. ej. "◄" / "▲" / "●"
  ariaLabel: string;
  side: "left" | "right"; // qué mitad del panel ocupa
  position?: "up" | "down" | "left" | "right" | "center"; // ubicación dentro de un cluster tipo D-pad (CSS grid); opcional, solo la usan los clusters que arman una cruz de direcciones
};

export type TouchControlsProps = {
  buttons: TouchButtonConfig[];
  onPress: (id: string) => void;
  onRelease: (id: string) => void;
};

export function TouchControls(props: TouchControlsProps): JSX.Element;
```

Sin lógica de juego: no sabe qué significa `"thrust"`, solo dispara `onPress`/`onRelease` con el `id` del botón tocado. `position` es puramente de layout (a qué celda del grid del D-pad va cada botón), no de comportamiento.

**4. Wiring en Asteroides** (`components/games/asteroids/asteroids-canvas.tsx`, `engine.ts` sin cambios):

```ts
const ASTEROIDS_TOUCH_BUTTONS: TouchButtonConfig[] = [
  { id: "thrust", label: "▲", ariaLabel: "Empuje", side: "left", position: "up" },
  { id: "rotate-left", label: "◄", ariaLabel: "Rotar izquierda", side: "left", position: "left" },
  { id: "rotate-right", label: "►", ariaLabel: "Rotar derecha", side: "left", position: "right" },
  { id: "shoot", label: "●", ariaLabel: "Disparo", side: "right" },
];
```

`onPress`/`onRelease` escriben sobre los mismos `heldRef`/`shootQueuedRef` que ya alimenta el teclado (`rotate-left`→`heldRef.left`, `rotate-right`→`heldRef.right`, `thrust`→`heldRef.thrust`, `shoot`→ encola `shootQueuedRef` en `onPress`, ignora `onRelease`). `AsteroidsInput` (el tipo que ya existe en `engine.ts`) no cambia.

Conventions:

- `id` de cada botón es un string libre por juego, no un enum compartido — cada motor futuro define los suyos al integrar `TouchControls`.
- `TouchControls` es un panel DOM en flujo normal (no overlay `position: absolute` sobre el canvas); nunca superpuesto al canvas.

**5. Portal del panel de controles** (`components/games/touch-panel-portal.tsx`):

```ts
export const TouchPanelPortalProvider: Provider<HTMLDivElement | null>;
export function useTouchPanelPortal(): HTMLDivElement | null;
```

Resuelve la distancia entre "dónde vive el wiring" (adentro de `.game-arena`, bien adentro de `.crt` — p. ej. `asteroids-canvas.tsx`) y "dónde debe verse el panel" (totalmente fuera de `.crt`, layout tipo GameBoy). `game-player.tsx` monta el nodo DOM externo (`.game-console-controls`) y lo publica por `TouchPanelPortalProvider`; el motor lee ese nodo con `useTouchPanelPortal()` y le hace `createPortal(<TouchControls .../>, nodo)`. Ninguno de los dos lados toca `GameCanvasProps`/`lib/games/types.ts` — es un mecanismo de Context + Portal, no un cambio de contrato.

## Implementation plan

1. **Hook de detección táctil.** Crear `components/games/use-touch-device.ts`: `useTouchDevice()` con `matchMedia("(pointer: coarse)")`, `false` en el snapshot de servidor (mismo patrón `useSyncExternalStore` que ya usa `game-player.tsx` para `hydrated`, evita desajuste de hidratación). Archivo aislado, sin ningún consumidor todavía.
2. **Registro de motores con touch.** Crear `lib/games/touch.ts` con `TOUCH_ENABLED_GAME_SLUGS: readonly RealGameSlug[] = ["asteroides"]`. Aislado, sin consumidor todavía.
3. **Panel reusable.** Crear `components/games/touch-controls.tsx` (`TouchControls`, `TouchButtonConfig`) + su CSS en `app/globals.css` (`.touch-controls`, `.touch-btn`, cluster izquierdo en grid tipo D-pad, estilo pixel/neón consistente con `.btn`). Componente puro, sin lógica de juego, sin consumidor todavía.
4. **Portal del panel.** Crear `components/games/touch-panel-portal.tsx` (`TouchPanelPortalProvider`, `useTouchPanelPortal`). Resuelve la distancia entre el wiring (adentro de `.game-arena`) y dónde debe verse el panel (fuera de `.crt`) sin tocar `GameCanvasProps`. Aislado, sin consumidor todavía.
5. **Wiring en Asteroides + panel externo.** En `asteroids-canvas.tsx`: `useTouchDevice()` + `useTouchPanelPortal()` para hacerle `createPortal()` a `<TouchControls>` (4 botones `rotate-left`/`rotate-right`/`thrust`/`shoot`) sobre el nodo que expone el portal, cableados a los mismos `heldRef`/`shootQueuedRef` que ya alimenta el teclado. `engine.ts` no se toca. En `game-player.tsx`: `TouchPanelPortalProvider` envolviendo `<GameEngineSlot>`, y el nodo `.game-console-controls` — **totalmente fuera de `.crt`**, layout tipo GameBoy — montado solo cuando `touchEnabled && isTouch`. **Desde este paso, Asteroides ya es jugable de punta a punta por touch**, en cualquier orientación (zoom/scroll todavía no está resuelto).
6. **Bloqueo de zoom/scroll + pulido responsive.** `touch-action: none` en `.game-arena` cuando el motor activo está en `TOUCH_ENABLED_GAME_SLUGS` y el dispositivo es táctil; ajustes de CSS responsive acotados a `.av-player`/`.player-hud`/`.crt`/`.crt-screen`/panel de controles/modal de fin de partida para viewports táctiles chicos, jugando en cualquier orientación (incluye `.hud-actions { flex-wrap: wrap }`, para que PAUSA/FIN/SALIR no queden cortados en portrait angosto).
7. **Revisión final.** `npm run lint` y `npm run build` sin errores; recorrido manual en un dispositivo o emulador táctil real: jugar Asteroides completo solo por touch (empuje, rotar, disparo, pausa, fin, guardar puntuación, jugar de nuevo) en portrait y en landscape, verificar que el panel se vea como una pieza separada debajo de la pantalla (no superpuesto, no dentro del bezel del CRT) y que no hay scroll/zoom accidental durante la partida; confirmar en paralelo que en desktop (mouse/teclado) la pantalla de Asteroides se ve exactamente igual que antes (sin panel) y que Tetris/Arkanoid/Snake y el resto del catálogo no tienen ningún cambio.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] En un dispositivo/emulador táctil, `/juego/asteroides/jugar` muestra un panel de controles **fuera de `.crt`** (pieza separada debajo de la pantalla, layout tipo GameBoy — no superpuesto al canvas, no dentro del bezel del CRT), con el cluster de empuje/rotación en cruz a la izquierda y el botón de disparo a la derecha.
- [ ] Tocar y mantener el botón de empuje mueve la nave hacia adelante mientras se sostiene; soltarlo detiene el empuje, igual que soltar `↑` en teclado.
- [ ] Tocar rotar-izquierda/rotar-derecha gira la nave mientras se sostiene el botón; soltarlo detiene la rotación, igual que las flechas en teclado.
- [ ] Tocar el botón de disparo dispara una vez por toque (edge-triggered), igual que `Space` en teclado — mantenerlo presionado no dispara en ráfaga continua.
- [ ] Asteroides es jugable por touch tanto en **portrait** como en **landscape** — sin ningún bloqueo ni aviso de rotación forzada.
- [ ] Mientras se juega Asteroides desde un dispositivo táctil, ni el `<canvas>` ni el panel de controles disparan scroll o pinch-zoom accidental de la página.
- [ ] En desktop (mouse/teclado, sin `pointer: coarse`), `/juego/asteroides/jugar` se ve y funciona exactamente igual que antes de este spec: sin panel de botones.
- [ ] `/juego/tetris/jugar`, `/juego/arkanoid/jugar`, `/juego/snake/jugar` y el resto del catálogo (mock) no muestran panel de touch, y no tienen ningún cambio de comportamiento respecto a antes de este spec.
- [ ] En un viewport táctil chico (~320–414px), el HUD externo (`player-hud`, incluidos los botones PAUSA/FIN/SALIR), el CRT, el panel de controles y el modal de fin de partida de la pantalla de Asteroides se ven completos y usables, sin overflow horizontal ni elementos cortados — tanto en portrait como en landscape.
- [ ] Una partida completa jugada 100% por touch (sin tocar teclado ni mouse) permite pausar, reanudar, terminar, guardar la puntuación en Supabase y jugar de nuevo.

## Decisions

- **Sí:** dividir en una spec fundacional + 1 juego piloto (Asteroides) en vez de una sola spec para los 4 motores. Mismo patrón que `game-planner` → `skin-designer` (un juego real por corrida) — evita una spec desmesurada y deja el contrato listo para reusar.
- **No:** una sola spec cubriendo los 4 motores a la vez. Descartada por tamaño — cada motor necesita un esquema de control táctil distinto y a medida.
- **No:** una spec de solo responsive general, sin tocar ningún motor. Descartada — el pedido incluye explícitamente poder _jugar_ en táctil, no solo que se vea bien.
- **Sí:** Asteroides como piloto. Es el caso más exigente (giro sostenido en dos direcciones, empuje sostenido, disparo edge-triggered) — valida mejor el contrato de botones on-screen que los otros 3 motores van a reusar después.
- **No:** Arkanoid (input posicional continuo, patrón menos reusable) o Snake (demasiado simple, valida poco del contrato) como piloto.
- **Sí:** alcance responsive acotado solo a la pantalla de juego (`game-player.tsx`, HUD, CRT, modal de fin de partida). El resto del sitio ya tiene media queries propias.
- **No:** auditoría completa de responsive de toda la plataforma en esta misma spec. Se revisita si aparece un problema real.
- **Sí:** botones on-screen, no gestos. Más descubribles para un jugador nuevo y mapeo directo 1:1 con las teclas ya existentes.
- **No:** gestos (swipe) sobre el canvas. Menos descubrible, mapeo menos directo con el input actual.
- **Sí (revisado durante la implementación, 1ª vuelta):** panel de controles **debajo** de la pantalla del juego, con el cluster de rotar/empuje en forma de cruz/D-pad. Reemplaza la decisión original de un overlay semi-transparente superpuesto al CRT — feedback directo del usuario tras ver el overlay superpuesto en un dispositivo real: tapaba parte del área jugable y no se sentía como un control físico.
- **No:** mantener el overlay semi-transparente sobre el CRT (decisión original de esta spec). Descartada tras la revisión visual — se prioriza que el jugador vea el campo de juego completo, sin dedos ni botones tapando naves/asteroides cerca del borde.
- **Sí (revisado durante la implementación, 2ª vuelta):** el panel queda **totalmente fuera de `.crt`** (layout tipo GameBoy real: pantalla y cuerpo de botones como piezas separadas), no una franja dentro del mismo bezel como en la 1ª vuelta — otra vez feedback directo del usuario ("el panel del mando no debería estar dentro del juego, debe estar por fuera"). Como el wiring (`heldRef`/`shootQueuedRef`) sigue viviendo en `asteroids-canvas.tsx` —adentro de `.game-arena`, bien adentro de `.crt`— resolver la distancia requirió un mecanismo nuevo: Context + `createPortal` (`components/games/touch-panel-portal.tsx`). `game-player.tsx` monta el nodo externo (`.game-console-controls`) y lo publica por Context; el motor le hace portal. Esto simplificó `.game-arena`/`.crt-screen` de vuelta a su forma original (ya no necesitan un modo "columna" ni `aspect-ratio: auto` — ese layout alternativo de la 1ª vuelta se descartó junto con ella).
- **No:** resolver la distancia agregando un campo nuevo a `GameCanvasProps` (p. ej. una ref o callback para que game-player.tsx le pase el nodo del panel a cada motor por props). Un Context evita tocar el contrato compartido — cualquier motor futuro puede consumir `useTouchPanelPortal()` sin que `lib/games/types.ts` sepa que el panel táctil existe.
- **No:** forzar landscape con aviso "GIRÁ TU DISPOSITIVO" (decisión original de esta spec). Revertida por completo durante la implementación — feedback directo del usuario: el aviso no se adaptaba bien en un dispositivo real y volvía el juego injugable. Asteroides ahora es jugable en cualquier orientación; el lienzo 800×600 se ve más chico en portrait, pero eso quedó anotado como fuera de alcance (ver Scope) en vez de bloquear el juego.
- **Sí (hallazgo durante la verificación en dispositivo real):** agregar `overflow-x: hidden` también en `html` (antes solo estaba en `body`) y `flex-wrap: wrap` en `.hud-actions`. En un Samsung Galaxy S26 Ultra real, `.av-mobile-panel` (el panel de navegación mobile, cerrado fuera de pantalla por `transform: translateX(100%)`) agrandaba el `scrollWidth` del documento y descentraba toda la pantalla del juego — confirmado también en la home, así que es un bug preexistente de toda la plataforma, no algo que esta spec introdujo. Se corrigió igual porque el usuario lo señaló directamente sobre la pantalla de Asteroides y es una línea de CSS de bajo riesgo (no toca la lógica de `nav.tsx`). `.hud-actions` sin `flex-wrap` dejaba el botón SALIR inalcanzable en viewports angostos — eso sí es parte de `.player-hud`, ya en el alcance de esta spec.
- **No:** auditar o arreglar a fondo `nav.tsx`/`.av-mobile-panel` en esta spec. El fix de `overflow-x: hidden` en `html` es la mitigación de bajo riesgo; el motivo de fondo (por qué esa transformación agranda el scrollWidth) queda para una revisión de responsive general de la plataforma si vuelve a aparecer.
- **Sí (revisado durante la implementación, feedback visual del usuario):** el D-pad y el botón de disparo pasan de círculos planos con glow a una estética de gamepad físico — el D-pad es una cruz de teclas con forma de flecha (`clip-path`) montada sobre una placa circular con relieve (gradiente + sombra interior), y el botón de disparo es una tecla circular con brillo tipo plástico y "labio" de sombra inferior que se hunde al presionar. Sigue usando la paleta cian/magenta ya establecida — no se copia el gris/beige de la referencia física, para no romper la identidad neón del resto de la plataforma.
- **Sí:** bloquear zoom/scroll (`touch-action: none`) durante la partida — evita que un swipe accidental en los controles haga scroll/zoom de la página.
- **Sí:** panel de controles visible solo en dispositivos táctiles (`pointer: coarse`), nunca en desktop.
- **No:** mostrar el panel siempre, también en desktop. Ocuparía espacio de pantalla sin necesidad.
- **Sí:** `TouchControls` como componente genérico y reusable (`components/games/touch-controls.tsx`), no embebido específico en Asteroides. Decisión explícita del usuario, coherente con que esta es la spec fundacional del patrón táctil.
- **No:** implementación inline específica de Asteroides sin extraer componente. Dificultaría reusar el patrón en los próximos 3 motores.
- **Sí:** registro explícito `TOUCH_ENABLED_GAME_SLUGS` (`lib/games/touch.ts`) en vez de inferir por convención qué juegos tienen touch. Mismo patrón que `REAL_GAME_SLUGS`/`SKINNED_GAME_SLUGS` — explícito y chequeado por TypeScript, no una sorpresa en runtime.
- **Sí:** `engine.ts` de Asteroides no cambia — el touch se resuelve enteramente en la capa de cliente (`asteroids-canvas.tsx` + `touch-controls.tsx`), reusando el mismo `AsteroidsInput` que ya consume el teclado. Mantiene la regla de que el motor nunca toca el DOM/eventos de navegador.
- **No:** agregar un campo nuevo a `GameEngineState`/`GameCanvasProps` (`lib/games/types.ts`) para señalizar soporte táctil. Innecesario — la detección es enteramente de cliente vía `matchMedia`.
- **Sí:** `id` de cada botón como string libre por juego, no un enum central de acciones. Cada motor futuro define los suyos al integrar `TouchControls`, sin acoplar el componente genérico a las acciones específicas de Asteroides.
- **No:** vibración/haptic feedback, multi-touch avanzado, soporte de gamepad físico. Fuera de foco — esta spec es específicamente sobre pantalla táctil con botones simples.

## Risks

| Risk                                                                                                                                                                                                         | Mitigation                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matchMedia("(pointer: coarse)")` puede dar falsos positivos/negativos en dispositivos híbridos (p. ej. laptops con pantalla táctil y mouse), mostrando u ocultando el panel incorrectamente                 | Riesgo aceptado — es la señal estándar del navegador para esto; el paso 7 del plan incluye verificación manual en un dispositivo táctil real, no solo en devtools                                                       |
| ~~Los botones semi-transparentes en las esquinas inferiores pueden tapar parte del área jugable~~ — resuelto al mover el panel fuera de la pantalla                                                          | N/A — riesgo eliminado por el rediseño a panel externo (ver Decisions)                                                                                                                                                  |
| Sostener varios botones a la vez (empuje + disparo) puede fallar si el navegador no distingue bien touch-points simultáneos sobre elementos separados                                                        | `TouchControls` usa identificadores de touch por botón (no un solo listener global); se verifica explícitamente sosteniendo dos botones a la vez en el recorrido manual del paso 7                                      |
| ~~El aviso de rotación puede comportarse distinto entre emulación de devtools y un dispositivo físico real~~ — resuelto al eliminar el aviso de rotación por completo                                        | N/A — riesgo eliminado, no hay más bloqueo de orientación (ver Decisions)                                                                                                                                               |
| El panel externo vive fuera de `.crt` vía Context + `createPortal` (`touch-panel-portal.tsx`): si el nodo DOM del portal todavía no se montó en el primer render, el panel puede tardar un frame en aparecer | Riesgo aceptado — es el patrón estándar de React para portales a un nodo medido en tiempo de render (mismo enfoque que Radix/Floating UI); imperceptible para el jugador, se confirma en el recorrido manual del paso 7 |
| Al portar el patrón a Tetris/Arkanoid/Snake en specs futuros, olvidar agregar el slug a `TOUCH_ENABLED_GAME_SLUGS` dejaría ese motor sin panel de controles ni `touch-action: none`                          | Riesgo heredado y aceptado para specs futuras — mitigado porque es un registro explícito y tipado (`readonly RealGameSlug[]`), mismo patrón que `REAL_GAME_SLUGS`/`SKINNED_GAME_SLUGS`                                  |
