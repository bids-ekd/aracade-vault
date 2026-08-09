# game-jam · FROGGER — 01 · Gameplay

> **Status:** Draft
> **Depends on:** [00-concepto](./00-concepto.md), [05-asteroides-juego-real](../../05-asteroides-juego-real.md), [06-tabla-juegos-supabase](../../06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](../../07-leaderboard-asteroides.md)
> **Date:** 2026-08-08
> **Objective:** Fijar las reglas exactas de FROGGER —mapa, mecánicas, curva de dificultad, tabla de puntuación, condiciones de derrota y feel de cada tecla— para que `02-motor.md` solo tenga que decir _cómo_ se implementan, no _cuáles_ son.

Este archivo es la autoridad sobre **las reglas del juego**. La implementación vive en
[02-motor](./02-motor.md), el aspecto en [03-arte](./03-arte.md).

## Bucle principal

1. La rana aparece en la **acera** (fila inferior), centrada, con el reloj lleno.
2. El jugador salta hacia arriba, celda a celda, atravesando **5 carriles de tráfico**.
3. Llega a la **berma**, la única fila segura del medio. El reloj no se detiene.
4. Cruza el **río** por **5 carriles** de troncos y tortugas: acá el agua mata y las plataformas
   salvan, exactamente al revés que abajo.
5. Aterriza en uno de los **5 nenúfares** de la fila superior. Suma puntos, el bonus de tiempo
   restante, y **vuelve a nacer en la acera** con el reloj lleno para llevar la siguiente rana.
6. Con los 5 nenúfares ocupados, el nivel se completa: bonus grande, los nenúfares se vacían, el
   tráfico se acelera y vuelve al paso 1 con `nivel + 1`.
7. Cada muerte cuesta una vida (empieza con 3). A 0 vidas, fin de partida.

No hay estado de victoria: los niveles se repiten indefinidamente con dificultad creciente. El juego
solo termina perdiendo.

## Mapa

Rejilla lógica de **13 columnas × 13 filas** de 40 px. Las columnas se numeran 0–12 de izquierda a
derecha; las filas 0–12 de arriba hacia abajo.

| Fila | Zona          | Contenido                                                                  | Sentido | Velocidad base |
| ---- | ------------- | -------------------------------------------------------------------------- | ------- | -------------- |
| 0    | **Nenúfares** | 5 nenúfares en las columnas 0, 3, 6, 9 y 12; el resto es matorral (mortal) | —       | —              |
| 1    | Río           | Troncos largos (3 celdas), 3 por carril                                    | →       | 60 px/s        |
| 2    | Río           | Tortugas en grupos de 3, 3 grupos                                          | ←       | 80 px/s        |
| 3    | Río           | Troncos medianos (2 celdas), 4 por carril                                  | →       | 100 px/s       |
| 4    | Río           | Troncos extra largos (4 celdas), 2 por carril                              | →       | 45 px/s        |
| 5    | Río           | Tortugas en grupos de 2, 4 grupos                                          | ←       | 70 px/s        |
| 6    | **Berma**     | Vacía y segura. Ni tráfico ni agua.                                        | —       | —              |
| 7    | Carretera     | Camiones (2 celdas), 3 por carril                                          | ←       | 90 px/s        |
| 8    | Carretera     | Coches, 4 por carril                                                       | →       | 120 px/s       |
| 9    | Carretera     | Coches, 4 por carril                                                       | ←       | 150 px/s       |
| 10   | Carretera     | Excavadora lenta (2 celdas), 3 por carril                                  | →       | 70 px/s        |
| 11   | Carretera     | Coches rápidos, 3 por carril                                               | ←       | 190 px/s       |
| 12   | **Acera**     | Vacía y segura. Punto de reaparición (columna 6).                          | —       | —              |

**Tráfico determinista, sin RNG.** Cada carril tiene un número fijo de entidades repartidas a
intervalos iguales sobre una tira cíclica más ancha que la pantalla; al salir por un borde reentran
por el opuesto conservando el espaciado. No hay generación procedural: un carril nunca puede quedar
sin huecos ni con un hueco imposible, y dos partidas del mismo nivel presentan el mismo patrón. La
única aleatoriedad del juego es **dónde y cuándo aparece la mosca bonus**.

## Mecánicas

### Salto

- Cada pulsación de flecha es **un salto de exactamente una celda** (40 px) en esa dirección.
- El salto dura ~110 ms de animación; durante ese lapso **el input se ignora** y la rana no está
  apoyada en ninguna plataforma. Es un desplazamiento **absoluto respecto del mundo**, no relativo
  al tronco: si saltás desde un tronco en movimiento, el tronco sigue sin vos durante esos 110 ms.
- La rana **conserva su `x` continua**: nunca hay snap a la columna más cercana. Es el
  comportamiento del arcade original y lo que hace que colocar la rana en un nenúfar sea una
  habilidad y no un trámite.
- Un salto que sacaría a la rana del área de juego por izquierda o derecha **se rechaza** (no muere,
  simplemente no ocurre). Un salto hacia abajo desde la acera también se rechaza.
- No hay ninguna forma de moverse sin saltar, salvo ser arrastrado por una plataforma del río.

### Carretera (filas 7–11)

- El contacto con cualquier vehículo mata al instante. Colisión AABB entre la caja de la rana y la
  del vehículo.
- No hay carriles "seguros" dentro de la carretera: la única seguridad es el hueco entre vehículos.

### Río (filas 1–5)

- **El agua mata.** Estar en una fila de río sin plataforma bajo el centro de la rana = ahogo
  inmediato.
- Estando sobre un tronco o una tortuga, la rana es **arrastrada** con esa plataforma a su velocidad
  y sentido.
- **Tolerancia de apoyo:** la rana está apoyada si el **centro** de su caja cae dentro de la
  plataforma. Es la regla más permisiva que sigue castigando un salto mal medido, y evita las dos
  patologías clásicas (flotar apoyado en un píxel, o caerse estando visiblemente encima).
- Ser arrastrada fuera del área de juego (izquierda o derecha) mata.
- **Tortugas sumergibles:** desde el nivel 3, la fila 2 entra en ciclo de 5 s — 3.2 s emergidas,
  1.0 s hundiéndose (visualmente avisadas, todavía sostienen), 0.8 s sumergidas (matan). Desde el
  nivel 5 la fila 5 entra en el mismo ciclo, desfasada media vuelta para que nunca se hundan las dos
  a la vez. Cada grupo de tortugas dentro de un carril tiene su propia fase, así que siempre hay
  parte del carril transitable.

### Nenúfares (fila 0)

- Solo se puede aterrizar en un nenúfar **libre**, y solo si el centro de la rana cae dentro de su
  ancho de una celda.
- Aterrizar en el matorral (entre nenúfares) o en un nenúfar **ya ocupado** mata.
- Meter una rana marca ese nenúfar como ocupado para el resto del nivel y devuelve al jugador a la
  acera con el reloj lleno.
- Completar los 5 nenúfares avanza de nivel: bonus, nenúfares vacíos, tráfico más rápido.

### Reloj

- **30 s por intento** en el nivel 1, decreciente por nivel (ver curva). Corre siempre que la rana
  esté viva y la partida no esté en pausa.
- Se reinicia al llenarse: al meter una rana en un nenúfar, al morir y al subir de nivel.
- Llegar a 0 cuesta una vida, como cualquier otra muerte.
- **No aparece en el HUD externo de la plataforma.** Se dibuja como una barra dentro del lienzo (ver
  [03-arte](./03-arte.md)) — decisión que evita extender `GameEngineState`, ver
  [02-motor](./02-motor.md) → Decisions.

### Mosca de neón (bonus)

- Cada 12–20 s aparece una mosca sobre uno de los nenúfares **libres**, al azar, y permanece 6 s.
- Meter la rana en ese nenúfar mientras la mosca está posada suma el bonus y la hace desaparecer.
- Es el único elemento aleatorio del juego.

### Vidas y muerte

- 3 vidas al empezar. **Una vida extra** al superar los 20 000 puntos, una sola vez por partida.
- Toda muerte reproduce una animación de ~700 ms (la rana se aplasta y se apaga) durante la cual el
  input se ignora pero **el mundo sigue moviéndose**; después reaparece en la acera con el reloj
  lleno.
- Lo que se conserva tras morir: score, nivel, nenúfares ya ocupados. Lo que se reinicia: posición y
  reloj.

**Las seis formas de convertirse en papilla:**

1. Te pisa un vehículo (filas 7–11).
2. Caés al agua (filas 1–5 sin plataforma bajo el centro).
3. Te hundís con una tortuga sumergida.
4. Un tronco o tortuga te arrastra fuera de la pantalla.
5. Saltás al matorral o a un nenúfar ocupado (fila 0).
6. Se te acaba el reloj.

## Curva de dificultad

Multiplicador de velocidad aplicado a **todos** los carriles (tráfico y río por igual):
`vel = min(2.00, 1 + 0.12 × (nivel − 1))`. Reloj por intento: `t = max(20, 32 − 2 × nivel)` segundos.

| Nivel | Multiplicador | Reloj | Cambios adicionales                                                   |
| ----- | ------------- | ----- | --------------------------------------------------------------------- |
| 1     | ×1.00         | 30 s  | Todo el mapa base. Tortugas siempre emergidas.                        |
| 2     | ×1.12         | 28 s  | —                                                                     |
| 3     | ×1.24         | 26 s  | La fila 2 empieza a sumergirse.                                       |
| 4     | ×1.36         | 24 s  | La fila 3 pierde un tronco: huecos más anchos en el río.              |
| 5     | ×1.48         | 22 s  | La fila 5 también se sumerge, desfasada respecto de la fila 2.        |
| 6     | ×1.60         | 20 s  | El reloj toca su piso y ya no baja más.                               |
| 7     | ×1.72         | 20 s  | —                                                                     |
| 8     | ×1.84         | 20 s  | —                                                                     |
| 9     | ×1.96         | 20 s  | —                                                                     |
| 10+   | ×2.00 (tope)  | 20 s  | La dificultad se congela: a partir de acá el juego es de resistencia. |

El tope de ×2.00 es deliberado: por encima de eso el carril 11 (190 px/s base → 380 px/s) empieza a
tener huecos que un salto de 110 ms no puede aprovechar, y el juego dejaría de ser difícil para
pasar a ser imposible.

## Puntuación

| Evento                                | Puntos               | Nota                                                                                                      |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| Avanzar a una fila nueva hacia arriba | +10                  | Solo por la fila **más alta alcanzada en el intento actual**. Bajar y volver a subir no vuelve a puntuar. |
| Meter una rana en un nenúfar          | +50                  | —                                                                                                         |
| Bonus de tiempo                       | +10 × seg. restantes | Se cobra al meter la rana, sobre los segundos enteros que queden en el reloj (máx. +290 en nivel 1).      |
| Mosca de neón                         | +200                 | Solo si el nenúfar elegido tenía la mosca posada.                                                         |
| Completar los 5 nenúfares             | +1000 × nivel        | El componente que hace que el score no tenga techo y que la tabla `scores` rankee progresión, no suerte.  |
| Vida extra                            | —                    | A los 20 000 puntos, una vez por partida. No suma score, suma una vida.                                   |

El score **nunca baja**: no hay penalización por morir, por perder tiempo ni por retroceder. Es la
propiedad que exige el criterio 2 de la rúbrica (ver [00-concepto](./00-concepto.md)).

## Condiciones de fin

- **Derrota** (única forma de terminar): llegar a 0 vidas. El motor reporta `status: "gameover"` y
  la plataforma abre su modal de fin de partida con el score acumulado.
- **Victoria:** no existe. El juego es infinito por diseño, así que **nunca** se reporta
  `status: "won"` (a diferencia de Arkanoid, que sí lo ejercita al superar sus 5 niveles).
- **Fin forzado:** el botón "FIN" de la plataforma corta la partida con el score acumulado, igual
  que en el resto de los juegos reales.

## Feel del input, control por control

Cuatro teclas, ninguna más. `controls: "teclado"`, sin mouse y sin táctil.

| Tecla | Acción                          | Feel esperado                                                                                                                             |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `↑`   | Saltar una fila hacia arriba    | La tecla del juego. Cada pulsación es un compromiso irreversible de 110 ms: no se cancela, no se frena a mitad. Suma +10 si estrena fila. |
| `↓`   | Saltar una fila hacia abajo     | Retirada. Sirve para esperar un hueco desde una fila segura. Se rechaza en la acera (fila 12).                                            |
| `←`   | Saltar una celda a la izquierda | Ajuste fino: es como se alinea la rana con un nenúfar o se busca el centro de un tronco. Se rechaza si sacaría a la rana de la pantalla.  |
| `→`   | Saltar una celda a la derecha   | Ídem, espejado.                                                                                                                           |

Reglas transversales del input:

- **Las cuatro llevan `preventDefault`**, para que las flechas no hagan scroll de la página durante
  la partida (mismo criterio que Asteroides/Tetris/Snake).
- **Edge-triggered, y además filtrando `e.repeat`.** A diferencia de Tetris —que deja pasar el
  auto-repeat del navegador por fidelidad al original— acá **sí** se filtra: en este juego cada
  salto es una decisión de vida o muerte, y una tecla sostenida que dispare 20 saltos a 30 ms de
  intervalo mataría a la rana en el primer carril. Mismo criterio que el `shoot` de
  `AsteroidsCanvas`.
- **La ventana de 110 ms del salto es el único "cooldown".** No hay repetición automática propia del
  motor: para cruzar hay que pulsar una vez por celda, siempre.
- **En pausa nada responde:** el loop se congela por completo, incluidos el reloj y las plataformas,
  y al reanudar no hay salto de física (`lastTime` se resetea).
