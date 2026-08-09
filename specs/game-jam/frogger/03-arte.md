# game-jam · FROGGER — 03 · Arte

> **Status:** Draft
> **Depends on:** [00-concepto](./00-concepto.md), [01-gameplay](./01-gameplay.md), [02-motor](./02-motor.md), [05-asteroides-juego-real](../../05-asteroides-juego-real.md)
> **Date:** 2026-08-08
> **Objective:** Fijar todo lo visual de FROGGER —paleta, portada `.cover-frogger` en CSS puro, estilo de render vectorial de cada entidad y HUD dentro del lienzo— para que la implementación no tenga que inventar ni un color.

Este archivo es la autoridad sobre **lo visual**. Las reglas están en [01-gameplay](./01-gameplay.md),
el contrato del motor en [02-motor](./02-motor.md).

## Paleta

Acento del juego: **`yellow`** (`--yellow: #f5ff00`). Es el color de la ficha en el catálogo, el de
la rana y el de las líneas de carril — la idea es que la partida se lea de un vistazo como "amarillo
sobre asfalto", igual que Snake se lee como "verde sobre grilla".

| Elemento                    | Color                                        | Nota                                                                                |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fondo del lienzo            | `#0a0a0f` (`--bg`)                           | El mismo negro del tema, para que el marco CRT no muestre costura.                  |
| Asfalto (filas 7–11)        | `#0d0d16`                                    | Apenas más claro que el fondo; lo que define la zona son las líneas, no el relleno. |
| Líneas de carril            | `--yellow` al 45 % de opacidad               | Trazos discontinuos de 22 px con 22 px de hueco, uno por frontera entre carriles.   |
| Río (filas 1–5)             | `#04202e` con velo `--cyan` al 10 %          | Agua oscura; el brillo cian sugiere corriente sin competir con las plataformas.     |
| Berma y acera (filas 6, 12) | `#141a20` con borde `--ink-faint`            | Las dos únicas franjas "de material sólido"; deben leerse como refugio.             |
| Rana                        | `--yellow`, ojos `--cyan`                    | El único amarillo saturado del lienzo. Nada más compite con ella.                   |
| Rana muerta                 | `--magenta`                                  | La animación de papilla: el amarillo colapsa a magenta y se apaga.                  |
| Coches                      | `--magenta` y `--cyan` alternados por carril | Dos colores, nunca tres: legibilidad por encima de variedad.                        |
| Camión / excavadora         | `#ff7700`                                    | Naranja del vocabulario ya presente en `globals.css` (`.cover-tetro`).              |
| Troncos                     | `#a86a2e` con veta `#7d4d1f`                 | Marrón cálido; la única zona del lienzo que no es neón, a propósito.                |
| Tortugas emergidas          | `--green`                                    | Verde vivo = te sostiene.                                                           |
| Tortugas hundiéndose        | `--green` parpadeando al 40 %                | El aviso: sigue sosteniendo, pero ya no por mucho.                                  |
| Tortugas sumergidas         | Solo el contorno al 15 %                     | Se ve dónde estaban, pero se lee claramente como agua.                              |
| Nenúfar libre               | Contorno `--green` al 60 %                   | Hueco oscuro con borde: invita.                                                     |
| Nenúfar ocupado             | Relleno `--green` + rana amarilla dentro     | Marcador de progreso del nivel, visible todo el tiempo.                             |
| Matorral (fila 0)           | `#0b2418`                                    | Verde casi negro. Debe parecer pared, no hueco.                                     |
| Mosca de neón               | `--magenta` con halo                         | El único elemento que titila; llama la atención sin ambigüedad.                     |
| Barra de reloj              | `--green` → `--yellow` → `--magenta`         | Verde llena, amarilla por debajo del 40 %, magenta por debajo de 5 s.               |

Regla general de estilo: **contorno + resplandor**, no rellenos planos. Cada entidad se dibuja con
`fillRect`/`arc` en su color y un `shadowBlur` de 8–12 px del mismo color, igual que ya hacen
Asteroides, Tetris y Arkanoid. Sin gradientes dentro del canvas: no combinan con el resto del Vault
y cuestan frames.

## Portada — `.cover-frogger`

Clase nueva, al final del bloque `/* Cover art generators */` de `app/globals.css`. No colisiona con
ninguna existente (`cover-bg`, `cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`,
`cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`, `cover-tetris`, `cover-asteroides`,
`cover-arkanoid`, `cover-snake-real`). Se distingue de `.cover-rana` —la portada del mock hermano,
que es una rana verde sobre carriles cian— por color, por composición y por tener las dos mitades
del tema, río arriba y asfalto abajo.

Lectura de la portada, de arriba a abajo: los 5 nenúfares, el río con dos troncos a la deriva, el
asfalto con sus líneas de carril y, en el centro, la rana amarilla entre dos coches que la cruzan.

```css
.cover-frogger {
  background: linear-gradient(180deg, #04202e 0 46%, #0d0d16 46% 100%);
}
.cover-frogger::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    /* 5 nenúfares en la franja superior */
    linear-gradient(var(--green), var(--green)) 6% 7% / 9% 8% no-repeat,
    linear-gradient(var(--green), var(--green)) 27% 7% / 9% 8% no-repeat,
    linear-gradient(var(--green), var(--green)) 48% 7% / 9% 8% no-repeat,
    linear-gradient(var(--green), var(--green)) 69% 7% / 9% 8% no-repeat,
    linear-gradient(var(--green), var(--green)) 90% 7% / 9% 8% no-repeat,
    /* dos troncos a la deriva */ linear-gradient(#a86a2e, #a86a2e) 10% 26% / 34% 8% no-repeat,
    linear-gradient(#a86a2e, #a86a2e) 64% 38% / 26% 8% no-repeat,
    /* tres líneas de carril discontinuas sobre el asfalto */
    repeating-linear-gradient(90deg, var(--yellow) 0 22px, transparent 22px 44px) 0 60% / 100% 3px
      no-repeat,
    repeating-linear-gradient(90deg, var(--yellow) 0 22px, transparent 22px 44px) 0 78% / 100% 3px
      no-repeat,
    repeating-linear-gradient(90deg, var(--yellow) 0 22px, transparent 22px 44px) 0 96% / 100% 3px
      no-repeat;
  opacity: 0.9;
}
.cover-frogger::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    /* la rana, cruzando el asfalto */
    radial-gradient(circle at 50% 71%, var(--yellow) 0 11px, transparent 12px),
    /* dos coches de neón */ linear-gradient(var(--magenta), var(--magenta)) 12% 68% / 16% 6%
      no-repeat,
    linear-gradient(var(--cyan), var(--cyan)) 78% 87% / 16% 6% no-repeat;
  filter: drop-shadow(0 0 8px rgba(245, 255, 0, 0.6));
}
```

Solo usa vocabulario ya presente en `globals.css`: `linear-gradient`, `repeating-linear-gradient`,
`radial-gradient`, posiciones/tamaños de `background`, `no-repeat`, `opacity`, `filter:
drop-shadow()` y las variables `--yellow`/`--green`/`--cyan`/`--magenta`. Sin `clip-path`, sin
`content` de texto, sin imágenes.

## Render dentro del canvas

Lienzo lógico 800×600, tablero de 13×13 celdas de 40 px con `OFFSET_X` 140 y `OFFSET_Y` 44 (la
geometría exacta está en [02-motor](./02-motor.md)). Todo se dibuja con primitivas: sin sprites, sin
`drawImage`, sin `public/games/frogger/`.

Orden de dibujado, de atrás hacia adelante:

1. **Fondo y franjas.** Un `fillRect` por zona (río, berma, asfalto, acera, matorral) más las líneas
   de carril discontinuas del asfalto. Se dibuja una vez por frame, sin capa cacheada.
2. **Nenúfares.** Rectángulo redondeado de una celda por nenúfar: contorno verde si está libre,
   relleno verde con una rana amarilla en miniatura si está ocupado.
3. **Plataformas del río.** Troncos como rectángulos marrones con dos vetas horizontales más
   oscuras; tortugas como tres círculos verdes en fila con un caparazón marcado por dos arcos. El
   estado de hundimiento cambia opacidad y relleno según la tabla de paleta, nunca la posición.
4. **Vehículos.** Coches: rectángulo de una celda con dos "faros" (círculos de 3 px) en el frente,
   apuntando hacia su sentido de marcha. Camión y excavadora: rectángulo de dos celdas con una línea
   divisoria que sugiere cabina + caja.
5. **Mosca bonus.** Círculo magenta de 6 px con halo, sobre el nenúfar correspondiente, con un
   titileo de ~4 Hz.
6. **Rana.** Cuadrado redondeado de 30 px en amarillo con dos ojos cian de 3 px orientados según la
   última dirección saltada. Durante el salto, se escala a 1.25× en el punto medio del tween y
   vuelve a 1.0× al aterrizar — es el único "efecto" de animación del juego y es lo que le da peso a
   cada salto.
7. **Muerte.** Los 700 ms de `DEATH_MS`: la rana se aplasta a 1.0 → 0.3 de alto, vira de amarillo a
   magenta y se desvanece, con cuatro trazos cortos saliendo del centro. Ahogo y atropello comparten
   la animación, cambiando solo el color de los trazos (cian para el agua, magenta para el asfalto).
8. **HUD** (ver abajo). Siempre lo último, para que ninguna entidad lo tape.

## HUD dentro del lienzo

Mismo patrón que `AsteroidsEngine.drawHUD()` y que el HUD en canvas de Tetris/Arkanoid/Snake:
etiqueta tenue en `--ink-dim` + valor con resplandor neón (`shadowBlur`), un acento de color por
estadística, coherente con las clases `.hud-stat` del HUD externo en `app/globals.css`.

**Franja superior (44 px, y ∈ [0, 44]):**

- **SCORE** arriba a la izquierda, acento cian, alineado con `OFFSET_X`.
- **NIVEL** arriba al centro, acento amarillo.
- **Vidas** arriba a la derecha: una ranita amarilla en miniatura (12 px) por vida restante, no un
  número. Es la lectura más rápida y la que usa el arcade original.

**Franja inferior (36 px, y ∈ [564, 600]) — la barra de reloj:**

- Barra horizontal del ancho del tablero (520 px, de x=140 a x=660) y 10 px de alto, con la etiqueta
  "TIEMPO" a su izquierda en `--ink-dim`.
- Se vacía de derecha a izquierda a medida que corre el reloj.
- Cambia de color por umbral: verde por encima del 40 %, amarilla entre 40 % y el último 5 s,
  magenta con resplandor pulsante en los últimos 5 s.
- Es el **único** lugar donde el reloj existe: no se reporta a `onStateChange` ni aparece en el HUD
  externo de la plataforma (ver [02-motor](./02-motor.md) → Decisions).

**Lo que el motor no dibuja nunca:** overlays de pausa, de fin de partida o de "presioná una tecla".
Todo eso lo resuelve el modal de la plataforma, igual que en los cuatro motores reales existentes.

## Criterios de aceptación visuales

- [ ] `/biblioteca` muestra la ficha "FROGGER" con portada propia y acento amarillo, distinguible a
      simple vista de "RANARIA" (verde) en la misma grilla y sin parecerse a ninguna otra `.cover-*`.
- [ ] La portada se compone solo de CSS del vocabulario ya presente en `globals.css`: sin imágenes,
      sin `clip-path`, sin propiedades nuevas.
- [ ] En el lienzo se distinguen sin ambigüedad las cuatro zonas —nenúfares, río, berma+acera,
      asfalto— sin necesidad de leer ningún texto.
- [ ] Las tortugas comunican sus tres estados (emergida, hundiéndose, sumergida) solo con color y
      opacidad, y el estado "hundiéndose" es visible al menos 1 s antes de que la tortuga mate.
- [ ] La rana es el elemento más brillante del lienzo en todo momento y su dirección se lee por la
      orientación de los ojos.
- [ ] El salto tiene un pico de escala perceptible: se nota que la rana salta, no que se teletransporta.
- [ ] Las dos muertes (atropello y ahogo) se distinguen por color sin leer ningún texto.
- [ ] El HUD en lienzo (SCORE/NIVEL/vidas) usa el mismo lenguaje visual que el de Asteroides/Tetris y
      coincide en todo momento con el HUD externo de la plataforma.
- [ ] La barra de reloj se vacía de derecha a izquierda, cambia de color en los dos umbrales
      definidos y se congela por completo cuando la partida está en pausa.
- [ ] Ninguna entidad del juego se dibuja fuera del tablero (x ∈ [140, 660], y ∈ [44, 564]) salvo el
      HUD y la barra de reloj, que viven exactamente en las franjas reservadas para ellos.
- [ ] No existe `public/games/frogger/`: el juego no carga ninguna imagen ni ningún audio.
