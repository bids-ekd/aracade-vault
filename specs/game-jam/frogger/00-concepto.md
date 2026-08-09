# game-jam · FROGGER — 00 · Concepto

> **Status:** Draft
> **Depends on:** [05-asteroides-juego-real](../../05-asteroides-juego-real.md), [06-tabla-juegos-supabase](../../06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](../../07-leaderboard-asteroides.md)
> **Date:** 2026-08-08
> **Objective:** Documentar por qué, para el tema "Frogger — cruza la carretera y el río sin convertirte en papilla", el juego elegido es **FROGGER** (`frogger`) y no los otros dos candidatos evaluados, y dejar registrados los riesgos reales del port antes de que nadie escriba una línea de código.

## Tema recibido

> **Frogger — "Cruza la carretera y el río sin convertirte en papilla".**

El tema no describe una estética, describe una **estructura de riesgo**: dos mitades hostiles con
lógicas opuestas. Abajo, la carretera **te mata si la tocás** (el peligro se mueve y vos tenés que
no estar ahí). Arriba, el río **te mata si no la tocás** (el peligro es el vacío y tenés que estar
justo encima de lo que se mueve). En el medio, una berma segura donde respirar. Esa inversión
—esquivar abajo, montarse arriba— es la idea entera del tema y es lo que un candidato tiene que
reproducir para no ser "un juego de esquivar cosas" cualquiera.

De ahí salen los tres candidatos: los tres son arcades clásicos reconocibles del mismo linaje
"tráfico que te aplasta", reinterpretados al vocabulario neón del Vault (asfalto oscuro, líneas de
carril amarillas, río cian, coches magenta/cian, rana amarilla).

## Los tres candidatos

| Candidato                       | Clásico de referencia       | Cómo reinterpreta el tema                                                                                                                                                                           |
| ------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — FROGGER** (`frogger`)     | Frogger (Konami/Sega, 1981) | El tema literal: 5 carriles de tráfico, berma, 5 carriles de río con troncos y tortugas, 5 nenúfares arriba. Salto discreto por celdas. Rana amarilla de neón sobre autopista de scanlines.         |
| **B — AUTOPISTA** (`autopista`) | Freeway (Activision, 1981)  | Solo la mitad "carretera", llevada al extremo: 10 carriles seguidos, movimiento continuo arriba/abajo, sin río, sin muerte — el atropello te empuja hacia atrás. Duelo a dos gallinas contra reloj. |
| **C — ASFALTO** (`asfalto`)     | Road Fighter (Konami, 1984) | El tema desde adentro del coche: sos el tráfico. Auto-scroll vertical, esquivás rivales y manchas de aceite a 300 km/h, la papilla es tu propio choque. Score = distancia recorrida.                |

## Rúbrica de 7 criterios (la misma que usa `game-planner`)

| #   | Criterio             | A — FROGGER                                                                                                                                                                                        | B — AUTOPISTA                                                                                                                                                   | C — ASFALTO                                                                                                                                      |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Contrato del motor   | ✅ Estado íntegramente numérico (posición de rana, offsets de carril, reloj). `update(dt, input)` + `draw(ctx)` sin tocar `document`/`window`/`Audio`.                                             | ✅ El más simple de los tres: dos entidades y 10 carriles.                                                                                                      | ✅ Auto-scroll + lista de rivales, sin globals.                                                                                                  |
| 2   | Leaderboard          | ✅ Score monótono de un solo jugador, acumulativo y **sin techo** (los niveles se repiten con dificultad creciente). Nunca baja.                                                                   | ❌ **Descarte.** Es un duelo 1v1 a reloj; en modo 1P el score es "cruces logradas en 2:16", acotado a ~30 y con empates masivos. Mismo fallo que `duelo-pixel`. | ✅ Score = distancia + bonus, estrictamente monótono.                                                                                            |
| 3   | HUD                  | ⚠️ `score`/`lives`/`level` encajan; el **reloj de 30 s por intento no cabe** en `GameEngineState` → se resuelve dibujándolo dentro del lienzo, sin tocar `lib/games/types.ts` (ver `02-motor.md`). | ❌ El reloj de 2:16 **es** la condición de fin, no un adorno: no se puede relegar al lienzo y no cabe en el contrato.                                           | ⚠️ El combustible del original no cabe; hay que recortarlo (y perder identidad) o dibujarlo dentro del lienzo.                                   |
| 4   | Input                | ✅ Teclado puro: 4 flechas, edge-triggered, `preventDefault` en las cuatro. Cero mouse, cero teclas nuevas para la plataforma.                                                                     | ✅ Teclado, 2 teclas por jugador… pero 4 en total si se respeta el duelo.                                                                                       | ✅ Teclado: `←`/`→` sostenidas + acelerar/frenar.                                                                                                |
| 5   | Assets y portada     | ✅ 100% primitivas de canvas (rectángulos, círculos, líneas). `.cover-frogger` sale con el vocabulario CSS ya presente en `globals.css`.                                                           | ✅ Igual de barato.                                                                                                                                             | ✅ Igual de barato.                                                                                                                              |
| 6   | Hueco de catálogo    | ⚠️ ARCADE ya es la categoría más representada entre los reales (`arkanoid` magenta, `snake` verde), pero **estrena `yellow`**, el único color sin ningún motor real hoy.                           | ⚠️ Mismo problema de categoría, sin la compensación de color.                                                                                                   | ⚠️ ARCADE otra vez, y además pisa el nicho de `saltarin`/`propulsor` (auto-scroll de esquivar en un eje), ambos ya pendientes en el To Do.       |
| 7   | No duplicar mecánica | ✅ Ningún real hace cruce por celdas contra carriles bidireccionales. `snake` comparte grilla pero su tensión es crecimiento y autocolisión, no tráfico.                                           | ❌ Duplica al candidato A dentro de la propia jam: es Frogger sin río y sin muerte.                                                                             | ✅ No duplica un real… pero tampoco cumple el tema: se conduce **a lo largo** de la carretera, no **a través**, y el río directamente no existe. |

## Veredicto

**Gana A — FROGGER (`frogger`).**

- **Por el criterio 2, que manda.** Es el único de los tres que combina un score monótono de un
  solo jugador _y_ un techo abierto: cada nivel completado suma `+1000 × nivel` sobre lo ya
  acumulado, así que la tabla `scores` rankea progresión real y no empates. B queda **descartado sin
  apelación** por el mismo motivo que dejó a `duelo-pixel`/Pong sin motor: un duelo local no produce
  la puntuación que la plataforma sabe rankear.
- **Porque resuelve la objeción que lo había dejado en segundo lugar.** `game-planner` lo postergó
  el 2026-08-08 con dos razones: "el temporizador por vida no cabe en `GameEngineState`" y "ARCADE
  ya es la categoría más representada". El tema cambia el cálculo de la primera: el reloj **no
  necesita** una tarjeta en el HUD externo, se dibuja como una barra dentro del lienzo (mismo
  precedente que `AsteroidsEngine.drawHUD()` y que el HUD en canvas de Tetris/Arkanoid/Snake), y así
  **cero archivos compartidos se tocan** — ni `lib/games/types.ts` ni `components/game-player.tsx`.
  La segunda razón sigue siendo válida y se acepta a conciencia: es el costo de tener un tema
  cerrado en vez de una pregunta abierta de catálogo.
- **Porque es el único que cumple el tema completo.** C cubre la carretera y tira el río; B tira el
  río y la muerte. A es el único con las dos lógicas opuestas —esquivar abajo, montarse arriba— que
  son el tema.
- **Porque es barato.** Sin assets, sin sonido, sin sprites, sin extender la plataforma: motor
  vectorial + componente canvas + dos ediciones de registro + una fila en `public.games`. Mismo
  perímetro exacto que SPEC 10 (Snake), el port más limpio del repo hasta hoy.

**Por qué pierden los otros dos** (quedan documentados acá por si el usuario los prefiere):

- **B — AUTOPISTA** pierde por 2 y por 3, ambos duros. Solo sería viable reescribiéndolo como
  "cruces contra una CPU en modo campaña sin reloj", momento en el que deja de ser Freeway y pasa a
  ser Frogger sin río — es decir, una versión peor de A. No vale la pena rescatarlo.
- **C — ASFALTO** pierde por 6 y 7 combinados: es un buen juego y un mal encaje de _este_ tema. Si el
  usuario lo prefiere igual, el camino honesto es sacarlo de esta jam y evaluarlo contra
  `saltarin`/`propulsor` en el To Do de `game-planner`, no promoverlo acá.

## Nota sobre los ya evaluados

`frogger` figura en **Pendientes** del To Do (no en Descartados), así que no se está re-proponiendo
nada descartado. Los `Descartados` vigentes (`duelo-pixel`, `columns`, `bloque-buster`) no fueron
tocados por esta jam. `references/game-suggetions-todo.md` **no se modifica**: es memoria exclusiva
de `game-planner`; si el usuario aprueba este paquete, moverlo de "Pendientes" a "En spec" es
decisión suya.

## Hueco de catálogo que llena

| Eje       | Estado hoy (fuente: `REAL_GAME_SLUGS` + `references/implemented-games.md`) | Qué aporta `frogger`                                                                                          |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Categoría | SHOOTER 1 · PUZZLE 1 · ARCADE 2 · VERSUS 0                                 | ARCADE 3 — no llena un hueco, lo asume como costo del tema (ver Riesgo 3).                                    |
| Color     | cyan ×2 (`asteroides`, `tetris`) · magenta ×1 · green ×1 · **yellow ×0**   | Estrena `yellow`: primer motor real amarillo del Vault, y el único color libre dentro de ARCADE junto a cyan. |
| Mecánica  | Disparo inercial · apilar piezas · rebote paddle · grilla de crecimiento   | **Evasión posicional por celdas** con dos regímenes opuestos (esquivar / montarse). Género nuevo.             |
| Contrato  | `status: "won"` ejercitado por Arkanoid; `lines` por Tetris                | Primer juego con un **recurso temporal visible** resuelto sin extender el contrato compartido.                |

Nota sobre la ficha mock hermana: **`ranaria`** (ARCADE, verde, `.cover-rana`) queda **intacta**,
igual que `rocas`/`caida`/`bloque-buster`/`serpentina` frente a sus versiones reales.

## Riesgos reales del port

| #   | Riesgo                                                                                                                                                                                                                                                          | Cómo se maneja                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **El reloj de 30 s no cabe en `GameEngineState`.** Es el motivo por el que este juego quedó postergado. Si se resuelve mal, obliga a tocar `lib/games/types.ts` + el HUD de `components/game-player.tsx` — dos archivos compartidos por las 10 fichas.          | Se dibuja como barra dentro del lienzo (`02-motor.md` → Decisions; `03-arte.md` → HUD en canvas). **Cero archivos compartidos tocados.** El costo de la alternativa (extender el contrato, como hizo SPEC 08 con "Líneas") queda documentado y explícitamente descartado. |
| 2   | **Física mixta.** La rana salta en celdas discretas pero, sobre el río, es arrastrada con `x` continua por troncos y tortugas. Mezclar los dos regímenes mal produce los bugs clásicos: quedar medio fuera de un nenúfar, o "flotar" sobre el borde del tronco. | `x` es siempre continua (nunca se hace snap a columna, igual que el original); el salto es un desplazamiento de exactamente una celda; el encaje en nenúfar y el apoyo sobre plataforma se resuelven con una tolerancia explícita, definida en `01-gameplay.md`.          |
| 3   | **ARCADE se va a 3 de 5 motores reales** y `frogger` se queda con `yellow`, el color que en el To Do se disputan `space-invaders` (recomendado por `game-planner`) y otros 6 candidatos.                                                                        | Aceptado a conciencia y señalado acá para que el usuario decida: aprobar este paquete implica que un futuro `space-invaders` deberá usar otro color. La alternativa (`cyan` para `frogger`) está evaluada y descartada en `03-arte.md`.                                   |

## Qué sigue

Este archivo solo justifica la elección. Las reglas del juego están en
[01-gameplay](./01-gameplay.md), la implementación en [02-motor](./02-motor.md), lo visual en
[03-arte](./03-arte.md) y el catálogo/ranking en [04-catalogo](./04-catalogo.md). Los cinco están en
`Draft`: nadie implementa nada hasta que se revisen.
