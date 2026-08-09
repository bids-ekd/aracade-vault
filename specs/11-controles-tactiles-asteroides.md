# SPEC 11 — Controles táctiles y responsive del reproductor (piloto: Asteroides)

> **Status:** Approved
> **Depends on:** [01-pantallas-mvp-visual](./01-pantallas-mvp-visual.md), [05-asteroides-juego-real](./05-asteroides-juego-real.md)
> **Date:** 2026-08-09
> **Objective:** Agregar un overlay de controles táctiles reusable (`TouchControls`) y las reglas de viewport/orientación necesarias para que Asteroides —como juego piloto— sea completamente jugable en un dispositivo con pantalla táctil, dejando el patrón listo para que los otros 3 motores reales lo adopten en specs futuros.

## Scope

**In:**

- Componente nuevo y reusable `components/games/touch-controls.tsx`: overlay DOM configurable (lista de botones con `id`/ícono/acción), pointer events (`touchstart`/`touchend`, o `pointerdown`/`pointerup`) mapeados a callbacks `onPress(action)`/`onRelease(action)`. No dibuja nada en el `<canvas>`, no lo toca el motor.
- Integración en `components/games/asteroids/asteroids-canvas.tsx`: detecta un dispositivo táctil vía `matchMedia("(pointer: coarse)")`, y si aplica renderiza `TouchControls` con 4 botones (rotar-izquierda, rotar-derecha, empuje, disparo) cableados a los mismos `heldRef`/`shootQueuedRef` que ya alimenta el teclado — el `AsteroidsInput` que recibe `engine.ts` no cambia.
- Overlay superpuesto sobre el CRT, semi-transparente, esquema estándar de shooter táctil (empuje a la izquierda, rotar/disparo a la derecha), estilo pixel/neón consistente con `.btn`.
- Pantalla de "GIRÁ TU DISPOSITIVO" en `game-player.tsx`: en portrait sobre un dispositivo táctil, reemplaza el CRT por un aviso hasta que el jugador rote a landscape. Condicional de pantalla, sin tocar el motor.
- `touch-action: none` en el área de juego (CRT + overlay de controles) mientras se juega desde un dispositivo táctil, para evitar scroll/pinch-zoom accidental.
- Ajustes de CSS responsive en `app/globals.css` **acotados a la pantalla de juego** (`.av-player`, `.player-hud`, `.crt`/`.crt-screen`, overlay de controles, modal de fin de partida) para viewports táctiles chicos (~320–414px).
- Verificación manual en un dispositivo o emulador táctil real de que Asteroides es jugable de punta a punta por touch: rotar, empujar, disparar, pausa, fin, guardar puntuación, jugar de nuevo.

**Out of scope (para specs futuros):**

- Controles táctiles para Tetris, Arkanoid, Snake — siguen con teclado (Arkanoid además mouse) exactamente igual que hoy. Reusarán `TouchControls` en specs futuros, uno por motor.
- Auditoría o ajustes responsive del resto de la plataforma (nav, biblioteca, home, ficha, salón) — ya tienen media queries propias, no se tocan salvo que algo se vea roto al revisar la pantalla de juego.
- Gestos tipo swipe — se descartó a favor de botones on-screen.
- Soporte de juego en portrait (sin aviso de rotación) — se descartó a favor de forzar landscape.
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

`game-player.tsx` lo usa para decidir si aplica el aviso de rotación y el `touch-action: none` — nada de esto se activa para Tetris/Arkanoid/Snake todavía.

**2. Hook compartido de detección táctil** (`components/games/use-touch-device.ts`):

```ts
// true si matchMedia("(pointer: coarse)") matchea; false en SSR y en desktop/mouse.
export function useTouchDevice(): boolean;
```

**3. Overlay de controles, reusable** (`components/games/touch-controls.tsx`):

```ts
export type TouchButtonConfig = {
  id: string; // libre, p. ej. "rotate-left" | "thrust" | "shoot"
  label: string; // glifo corto mostrado en el botón, p. ej. "◄" / "▲" / "●"
  ariaLabel: string;
  side: "left" | "right"; // qué mitad del overlay ocupa
};

export type TouchControlsProps = {
  buttons: TouchButtonConfig[];
  onPress: (id: string) => void;
  onRelease: (id: string) => void;
};

export function TouchControls(props: TouchControlsProps): JSX.Element;
```

Sin lógica de juego: no sabe qué significa `"thrust"`, solo dispara `onPress`/`onRelease` con el `id` del botón tocado.

**4. Wiring en Asteroides** (`components/games/asteroids/asteroids-canvas.tsx`, `engine.ts` sin cambios):

```ts
const ASTEROIDS_TOUCH_BUTTONS: TouchButtonConfig[] = [
  { id: "rotate-left", label: "◄", ariaLabel: "Rotar izquierda", side: "left" },
  { id: "rotate-right", label: "►", ariaLabel: "Rotar derecha", side: "left" },
  { id: "thrust", label: "▲", ariaLabel: "Empuje", side: "left" },
  { id: "shoot", label: "●", ariaLabel: "Disparo", side: "right" },
];
```

`onPress`/`onRelease` escriben sobre los mismos `heldRef`/`shootQueuedRef` que ya alimenta el teclado (`rotate-left`→`heldRef.left`, `rotate-right`→`heldRef.right`, `thrust`→`heldRef.thrust`, `shoot`→ encola `shootQueuedRef` en `onPress`, ignora `onRelease`). `AsteroidsInput` (el tipo que ya existe en `engine.ts`) no cambia.

Conventions:

- `id` de cada botón es un string libre por juego, no un enum compartido — cada motor futuro define los suyos al integrar `TouchControls`.
- `TouchControls` es puro overlay DOM (`position: absolute`, `pointer-events` solo en los botones); nunca dibuja sobre el `<canvas>`.

## Implementation plan

1. **Hook de detección táctil.** Crear `components/games/use-touch-device.ts`: `useTouchDevice()` con `matchMedia("(pointer: coarse)")`, `false` en el snapshot de servidor (mismo patrón `useSyncExternalStore` que ya usa `game-player.tsx` para `hydrated`, evita desajuste de hidratación). Archivo aislado, sin ningún consumidor todavía.
2. **Registro de motores con touch.** Crear `lib/games/touch.ts` con `TOUCH_ENABLED_GAME_SLUGS: readonly RealGameSlug[] = ["asteroides"]`. Aislado, sin consumidor todavía.
3. **Overlay reusable.** Crear `components/games/touch-controls.tsx` (`TouchControls`, `TouchButtonConfig`) + su CSS en `app/globals.css` (`.touch-controls`, `.touch-btn`, semi-transparente, estilo pixel/neón consistente con `.btn`). Componente puro, sin lógica de juego, sin consumidor todavía.
4. **Wiring en Asteroides.** En `asteroids-canvas.tsx`: usar `useTouchDevice()` para renderizar `TouchControls` con los 4 botones (`rotate-left`/`rotate-right`/`thrust`/`shoot`), cableados a los mismos `heldRef`/`shootQueuedRef` que ya alimenta el teclado. `engine.ts` no se toca. **Desde este paso, Asteroides ya es jugable de punta a punta por touch** (aunque orientación y zoom/scroll todavía no están resueltos).
5. **Aviso de rotación.** En `components/game-player.tsx`: si `useTouchDevice()` y `matchMedia("(orientation: portrait)")` y `TOUCH_ENABLED_GAME_SLUGS.includes(game.id)`, reemplazar el CRT por la pantalla "GIRÁ TU DISPOSITIVO" (sin motor corriendo debajo). Para el resto del catálogo (sin touch habilitado) no cambia nada.
6. **Bloqueo de zoom/scroll + pulido responsive.** `touch-action: none` en `.game-arena`/overlay de controles cuando el motor activo está en `TOUCH_ENABLED_GAME_SLUGS`; ajustes de CSS responsive acotados a `.av-player`/`.player-hud`/`.crt`/`.crt-screen`/modal de fin de partida para viewports táctiles chicos (~320–414px).
7. **Revisión final.** `npm run lint` y `npm run build` sin errores; recorrido manual en un dispositivo o emulador táctil real: jugar Asteroides completo solo por touch (rotar, empuje, disparo, pausa, fin, guardar puntuación, jugar de nuevo), verificar el aviso de rotación en portrait y que desaparece al girar a landscape, verificar que no hay scroll/zoom accidental durante la partida; confirmar en paralelo que en desktop (mouse/teclado) la pantalla de Asteroides se ve exactamente igual que antes (sin overlay, sin aviso) y que Tetris/Arkanoid/Snake y el resto del catálogo no tienen ningún cambio.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] En un dispositivo/emulador táctil, `/juego/asteroides/jugar` en landscape muestra el overlay `TouchControls` con 4 botones semi-transparentes superpuestos al CRT (empuje/rotación a la izquierda, disparo a la derecha).
- [ ] Tocar y mantener el botón de empuje mueve la nave hacia adelante mientras se sostiene; soltarlo detiene el empuje, igual que soltar `↑` en teclado.
- [ ] Tocar rotar-izquierda/rotar-derecha gira la nave mientras se sostiene el botón; soltarlo detiene la rotación, igual que las flechas en teclado.
- [ ] Tocar el botón de disparo dispara una vez por toque (edge-triggered), igual que `Space` en teclado — mantenerlo presionado no dispara en ráfaga continua.
- [ ] En un dispositivo táctil en **portrait**, `/juego/asteroides/jugar` muestra el aviso "GIRÁ TU DISPOSITIVO" en vez del CRT; al rotar a landscape, el CRT y los controles aparecen normalmente.
- [ ] Mientras se juega Asteroides desde un dispositivo táctil, ni el `<canvas>` ni el overlay de controles disparan scroll o pinch-zoom accidental de la página.
- [ ] En desktop (mouse/teclado, sin `pointer: coarse`), `/juego/asteroides/jugar` se ve y funciona exactamente igual que antes de este spec: sin overlay de botones, sin aviso de rotación.
- [ ] `/juego/tetris/jugar`, `/juego/arkanoid/jugar`, `/juego/snake/jugar` y el resto del catálogo (mock) no muestran overlay de touch ni aviso de rotación, y no tienen ningún cambio de comportamiento respecto a antes de este spec.
- [ ] En un viewport táctil chico (~320–414px, landscape), el HUD externo (`player-hud`), el CRT y el modal de fin de partida de la pantalla de Asteroides se ven completos y usables, sin overflow horizontal ni elementos cortados.
- [ ] Una partida completa jugada 100% por touch (sin tocar teclado ni mouse) permite pausar, reanudar, terminar, guardar la puntuación en Supabase y jugar de nuevo.

## Decisions

- **Sí:** dividir en una spec fundacional + 1 juego piloto (Asteroides) en vez de una sola spec para los 4 motores. Mismo patrón que `game-planner` → `skin-designer` (un juego real por corrida) — evita una spec desmesurada y deja el contrato listo para reusar.
- **No:** una sola spec cubriendo los 4 motores a la vez. Descartada por tamaño — cada motor necesita un esquema de control táctil distinto y a medida.
- **No:** una spec de solo responsive general, sin tocar ningún motor. Descartada — el pedido incluye explícitamente poder _jugar_ en táctil, no solo que se vea bien.
- **Sí:** Asteroides como piloto. Es el caso más exigente (giro sostenido en dos direcciones, empuje sostenido, disparo edge-triggered) — valida mejor el contrato de botones on-screen que los otros 3 motores van a reusar después.
- **No:** Arkanoid (input posicional continuo, patrón menos reusable) o Snake (demasiado simple, valida poco del contrato) como piloto.
- **Sí:** alcance responsive acotado solo a la pantalla de juego (`game-player.tsx`, HUD, CRT, modal de fin de partida). El resto del sitio ya tiene media queries propias.
- **No:** auditoría completa de responsive de toda la plataforma en esta misma spec. Se revisita si aparece un problema real.
- **Sí:** botones on-screen superpuestos, no gestos. Más descubribles para un jugador nuevo y mapeo directo 1:1 con las teclas ya existentes.
- **No:** gestos (swipe) sobre el canvas. Menos descubrible, mapeo menos directo con el input actual.
- **Sí:** forzar landscape con aviso "GIRÁ TU DISPOSITIVO" en vez de soportar portrait jugable. El lienzo lógico 800×600 (4:3) se aprovecha mejor apaisado; evita rediseñar el layout de HUD+controles+canvas para portrait en esta spec.
- **No:** soporte de juego en portrait. Fuera de alcance — se reconsidera si se vuelve un pedido real.
- **Sí:** bloquear zoom/scroll (`touch-action: none`) durante la partida — evita que un swipe accidental en los controles haga scroll/zoom de la página.
- **Sí:** overlay de controles visible solo en dispositivos táctiles (`pointer: coarse`), nunca en desktop.
- **No:** mostrar el overlay siempre, también en desktop. Ocuparía espacio de pantalla sin necesidad.
- **Sí:** `TouchControls` como componente genérico y reusable (`components/games/touch-controls.tsx`), no embebido específico en Asteroides. Decisión explícita del usuario, coherente con que esta es la spec fundacional del patrón táctil.
- **No:** implementación inline específica de Asteroides sin extraer componente. Dificultaría reusar el patrón en los próximos 3 motores.
- **Sí:** registro explícito `TOUCH_ENABLED_GAME_SLUGS` (`lib/games/touch.ts`) en vez de inferir por convención qué juegos tienen touch. Mismo patrón que `REAL_GAME_SLUGS`/`SKINNED_GAME_SLUGS` — explícito y chequeado por TypeScript, no una sorpresa en runtime.
- **Sí:** `engine.ts` de Asteroides no cambia — el touch se resuelve enteramente en la capa de cliente (`asteroids-canvas.tsx` + `touch-controls.tsx`), reusando el mismo `AsteroidsInput` que ya consume el teclado. Mantiene la regla de que el motor nunca toca el DOM/eventos de navegador.
- **No:** agregar un campo nuevo a `GameEngineState`/`GameCanvasProps` (`lib/games/types.ts`) para señalizar soporte táctil. Innecesario — la detección es enteramente de cliente vía `matchMedia`.
- **Sí:** `id` de cada botón como string libre por juego, no un enum central de acciones. Cada motor futuro define los suyos al integrar `TouchControls`, sin acoplar el componente genérico a las acciones específicas de Asteroides.
- **No:** vibración/haptic feedback, multi-touch avanzado, soporte de gamepad físico. Fuera de foco — esta spec es específicamente sobre pantalla táctil con botones simples.

## Risks

| Risk                                                                                                                                                                                           | Mitigation                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matchMedia("(pointer: coarse)")` puede dar falsos positivos/negativos en dispositivos híbridos (p. ej. laptops con pantalla táctil y mouse), mostrando u ocultando el overlay incorrectamente | Riesgo aceptado — es la señal estándar del navegador para esto; el paso 7 del plan incluye verificación manual en un dispositivo táctil real, no solo en devtools                      |
| Los botones semi-transparentes en las esquinas inferiores pueden tapar parte del área jugable (naves/asteroides cerca del borde) pese a la transparencia                                       | Se ajusta tamaño/opacidad/posición durante la verificación manual del paso 7, priorizando jugabilidad sobre estética si hace falta                                                     |
| Sostener varios botones a la vez (empuje + disparo) puede fallar si el navegador no distingue bien touch-points simultáneos sobre elementos superpuestos                                       | `TouchControls` usa identificadores de touch por botón (no un solo listener global); se verifica explícitamente sosteniendo dos botones a la vez en el recorrido manual del paso 7     |
| El aviso de rotación (`matchMedia("(orientation: portrait)")`) puede comportarse distinto entre emulación de devtools y un dispositivo físico real                                             | El paso 7 del plan exige verificación en un dispositivo o emulador táctil real, no solo en devtools con throttling                                                                     |
| Al portar el patrón a Tetris/Arkanoid/Snake en specs futuros, olvidar agregar el slug a `TOUCH_ENABLED_GAME_SLUGS` dejaría ese motor sin aviso de rotación ni `touch-action: none`             | Riesgo heredado y aceptado para specs futuras — mitigado porque es un registro explícito y tipado (`readonly RealGameSlug[]`), mismo patrón que `REAL_GAME_SLUGS`/`SKINNED_GAME_SLUGS` |
