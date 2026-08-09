// ===== engine.ts — motor de Snake, construido desde cero (sin game.js de referencia) =====
// Sin dependencias de React ni del DOM global (document/window/ctx/Image). Todo el estado vive
// en SnakeEngine; el input se recibe como parámetro en cada frame, igual que
// AsteroidsEngine/TetrisEngine/ArkanoidEngine. El motor nunca dibuja la fruta como imagen —
// reporta qué celda/sprite corresponde en su estado (foodCell/foodSprite) y es snake-canvas.tsx
// quien la dibuja con drawImage, mismo principio que el buffer `sfx` de ArkanoidState.
//
// Colores: ni un literal. La paleta entra como dato explícito (GameSkin de lib/games/skins.ts) por
// el constructor y se reemplaza en caliente con setSkin() — el motor no lee variables CSS ni
// consulta el DOM. Cambiar de skin no reinicia la partida: no hay estado de juego atado a la paleta.
//
// Mapa de los sitios de color a campos semánticos de GameSkin:
//   bg      → fondo que pinta draw() antes de todo, y los ojos "calados" de la cabeza
//   grid    → rejilla de la grilla 20×15 y relleno del plato bajo la fruta
//   primary → cuerpo de la serpiente (la entidad principal del juego)
//   accent  → cabeza de la serpiente
//   danger  → marco del tablero: el borde MATA (no hay wrap-around), así que se pinta con el
//             color de peligro en vez de dejarlo implícito como en la versión sin skin
//   ramp[0] → aro del plato bajo la fruta y halo del sprite. La fruta es un PNG a todo color que
//             no se retiñe (ver la decisión en references/game-with-themes.md): la paleta se
//             adueña de lo que la rodea, no del sprite. ramp[0] está garantizado como distinto de
//             primary/accent/danger por la invariante de rampa de lib/games/skins.ts.
//   ink     → cifras del HUD interno; inkDim → sus etiquetas
//   glow    → shadowBlur de la serpiente y del halo de la fruta; siempre 0 en modo claro
//
// Cabeza vs cuerpo: `accent` y `primary` son casi isoluminantes en 3 de las 6 combinaciones
// (neon/light 1.00:1, retro/light 1.04:1, clasico/dark 1.13:1), así que distinguirlas SOLO por
// color fallaría ahí y para cualquier daltonismo. Por eso la cabeza además lleva dos ojos
// calados en `bg`: la diferencia es de forma, no solo de tono.

import type { GameSkin } from "@/lib/games/skins";
import { FRUIT_KEYS, type FruitKey } from "./fruit-atlas";

export type SnakeStatus = "playing" | "gameover";

export type SnakeState = {
  score: number;
  level: number; // arranca en 1, sube cada 5 frutas
  status: SnakeStatus; // Snake no tiene estado "won" — es un juego infinito hasta chocar
  foodCell: { x: number; y: number }; // coordenadas de grilla (0–19, 0–14) de la fruta activa
  foodSprite: FruitKey; // qué fruta del atlas dibujar ahí — el motor nunca la dibuja él mismo
};

export type SnakeInput = {
  left: boolean; // ArrowLeft presionada este frame (edge-triggered, la detecta snake-canvas.tsx)
  right: boolean;
  up: boolean;
  down: boolean;
  // Un giro que invierte 180° la dirección actual se ignora dentro del motor,
  // incluso si snake-canvas.tsx lo deja pasar — doble resguardo.
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL = 40; // px por celda de grilla
const INITIAL_TICK = 0.15; // s — velocidad inicial de avance (150ms)
const TICK_STEP = 0.05; // s — cuánto baja el tick cada 5 frutas comidas
const MIN_TICK = 0.06; // s — piso del tick (60ms)
const FOOD_PER_LEVEL = 5; // frutas comidas para subir de nivel
const SCORE_PER_FOOD = 10;

type Cell = { x: number; y: number };
type Direction = { dx: number; dy: number };

const UP: Direction = { dx: 0, dy: -1 };
const DOWN: Direction = { dx: 0, dy: 1 };
const LEFT: Direction = { dx: -1, dy: 0 };
const RIGHT: Direction = { dx: 1, dy: 0 };

function isOpposite(a: Direction, b: Direction): boolean {
  return a.dx === -b.dx && a.dy === -b.dy;
}

// ── Helpers de skin ───────────────────────────────────────────────────────────
// En modo claro `glow` es 0 porque shadowBlur es invisible sobre fondo claro: la
// legibilidad se compensa engrosando el trazo, no con brillo (mismo criterio que
// el motor de Asteroides).
const trazo = (skin: GameSkin, base: number) => (skin.glow === 0 ? base * 1.7 : base);

export class SnakeEngine {
  private width: number;
  private height: number;
  private gridW: number;
  private gridH: number;

  private segments: Cell[] = []; // segments[0] = cabeza
  private direction: Direction = RIGHT;

  private score = 0;
  private level = 1;
  private status: SnakeStatus = "playing";
  private foodEatenSinceLevel = 0;

  private tickInterval = INITIAL_TICK;
  private tickAccum = 0;

  private foodCell: Cell = { x: 0, y: 0 };
  private foodSprite: FruitKey = FRUIT_KEYS[0];

  private skin: GameSkin;

  constructor(width: number, height: number, skin: GameSkin) {
    this.width = width;
    this.height = height;
    this.skin = skin;
    this.gridW = Math.floor(width / CELL); // 800 / 40 = 20
    this.gridH = Math.floor(height / CELL); // 600 / 40 = 15
    this.reset();
  }

  // Cambio de paleta en caliente: solo afecta al dibujo, no toca nada del estado
  // de la partida (segmentos, dirección, score, tick). Por eso el reproductor
  // puede cambiar de skin a media partida sin remontar el canvas.
  setSkin(skin: GameSkin) {
    this.skin = skin;
  }

  reset() {
    this.score = 0;
    this.level = 1;
    this.status = "playing";
    this.foodEatenSinceLevel = 0;
    this.tickInterval = INITIAL_TICK;
    this.tickAccum = 0;
    this.direction = RIGHT;

    // Serpiente de 3 segmentos centrada, mirando a la derecha (cabeza a la derecha de la cola).
    const cx = Math.floor(this.gridW / 2);
    const cy = Math.floor(this.gridH / 2);
    this.segments = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];

    this.spawnFood();
  }

  private occupiesCell(cell: Cell): boolean {
    return this.segments.some((s) => s.x === cell.x && s.y === cell.y);
  }

  private spawnFood() {
    // Celda vacía aleatoria uniforme, sorteando hasta encontrar una libre — la
    // grilla (300 celdas) es mucho más grande que la serpiente, así que este
    // sorteo converge casi siempre en el primer intento.
    let cell: Cell;
    do {
      cell = {
        x: Math.floor(Math.random() * this.gridW),
        y: Math.floor(Math.random() * this.gridH),
      };
    } while (this.occupiesCell(cell));
    this.foodCell = cell;
    this.foodSprite = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
  }

  // Aplica el giro pedido por el input, en incrementos de 90°, descartando
  // cualquier inversión de 180° sobre la dirección actual — doble resguardo,
  // snake-canvas.tsx ya filtra lo mismo antes de encolar el input.
  private applyInput(input: SnakeInput) {
    let candidate: Direction | null = null;
    if (input.left) candidate = LEFT;
    else if (input.right) candidate = RIGHT;
    else if (input.up) candidate = UP;
    else if (input.down) candidate = DOWN;

    if (candidate && !isOpposite(candidate, this.direction)) {
      this.direction = candidate;
    }
  }

  update(dt: number, input: SnakeInput) {
    if (this.status !== "playing") return;

    this.applyInput(input);

    this.tickAccum += dt;
    if (this.tickAccum < this.tickInterval) return;
    this.tickAccum -= this.tickInterval;

    const head = this.segments[0];
    const newHead: Cell = { x: head.x + this.direction.dx, y: head.y + this.direction.dy };

    // Colisión con el borde del tablero — muerte instantánea, sin wrap-around.
    if (newHead.x < 0 || newHead.x >= this.gridW || newHead.y < 0 || newHead.y >= this.gridH) {
      this.status = "gameover";
      return;
    }

    const ateFood = newHead.x === this.foodCell.x && newHead.y === this.foodCell.y;
    // La cola se corre este mismo paso salvo que la serpiente coma — comparar
    // contra el cuerpo sin la última celda evita un falso choque contra la
    // cola que está por liberarse.
    const bodyToCheck = ateFood ? this.segments : this.segments.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.status = "gameover";
      return;
    }

    this.segments.unshift(newHead);
    if (ateFood) {
      this.score += SCORE_PER_FOOD;
      this.foodEatenSinceLevel++;
      if (this.foodEatenSinceLevel >= FOOD_PER_LEVEL) {
        this.foodEatenSinceLevel = 0;
        this.level++;
        this.tickInterval = Math.max(MIN_TICK, this.tickInterval - TICK_STEP);
      }
      this.spawnFood();
    } else {
      this.segments.pop();
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = this.skin.grid;
    ctx.lineWidth = 1;
    for (let c = 1; c < this.gridW; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, this.height);
      ctx.stroke();
    }
    for (let r = 1; r < this.gridH; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(this.width, r * CELL);
      ctx.stroke();
    }
  }

  // Marco del tablero en `danger`: en Snake el borde mata (no hay wrap-around),
  // así que el límite letal se dibuja en vez de quedar implícito. Es solo pintura
  // — la colisión la sigue resolviendo update() contra gridW/gridH.
  private drawBorder(ctx: CanvasRenderingContext2D) {
    const lw = trazo(this.skin, 2);
    ctx.strokeStyle = this.skin.danger;
    ctx.lineWidth = lw;
    ctx.strokeRect(lw / 2, lw / 2, this.width - lw, this.height - lw);
  }

  // Plato bajo la fruta: relleno `grid` + aro `ramp[0]`. El sprite de fruits.png
  // es arte a todo color que NO se retiñe con la paleta, así que la skin se
  // adueña de lo que lo rodea. Además resuelve el caso feo del modo claro, donde
  // una fruta pálida (ajo, champiñón) se perdía contra un fondo claro.
  // El sprite en sí lo dibuja snake-canvas.tsx encima de este plato.
  private drawFoodPlate(ctx: CanvasRenderingContext2D) {
    const cx = this.foodCell.x * CELL + CELL / 2;
    const cy = this.foodCell.y * CELL + CELL / 2;
    const r = CELL * 0.4;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.skin.grid;
    ctx.fill();

    ctx.lineWidth = trazo(this.skin, 1.5);
    ctx.strokeStyle = this.skin.ramp[0];
    ctx.shadowColor = this.skin.ramp[0];
    ctx.shadowBlur = this.skin.glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawSnake(ctx: CanvasRenderingContext2D) {
    const pad = 2;
    const size = CELL - pad * 2;

    // Cuerpo primero, de la cola hacia la cabeza, para que la cabeza quede encima.
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const isHead = i === 0;
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;

      ctx.fillStyle = isHead ? this.skin.accent : this.skin.primary;
      ctx.shadowColor = isHead ? this.skin.accent : this.skin.primary;
      ctx.shadowBlur = isHead ? this.skin.glow : this.skin.glow * 0.6;
      ctx.fillRect(x, y, size, size);

      if (isHead) this.drawEyes(ctx, x, y, size);
    }
    ctx.shadowBlur = 0;
  }

  // Dos ojos calados en `bg` sobre la cabeza, orientados según la dirección de
  // marcha. Es lo que garantiza que la cabeza se distinga del cuerpo incluso
  // cuando `accent` y `primary` tienen casi la misma luminancia (neon/light,
  // retro/light, clasico/dark): la diferencia pasa a ser de forma, no de tono.
  private drawEyes(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const { dx, dy } = this.direction;
    const cx = x + size / 2;
    const cy = y + size / 2;
    // Adelante en el sentido de la marcha, y separados en el eje perpendicular.
    const fwd = size * 0.2;
    const sep = size * 0.22;
    const r = size * 0.11;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.skin.bg;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + dx * fwd + -dy * sep * s, cy + dy * fwd + dx * sep * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // El HUD interno se dibuja SIN glow a propósito: el halo emborrona el texto
  // pequeño y el contraste ya está garantizado por la paleta (ink ≥ 13:1 e
  // inkDim ≥ 6.1:1 contra bg en las 6 combinaciones, ver lib/games/skins.ts).
  private drawHUD(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = "bold 18px monospace";
    ctx.textBaseline = "top";

    ctx.textAlign = "left";
    ctx.fillStyle = this.skin.inkDim;
    ctx.fillText("Score:", 14, 12);
    ctx.fillStyle = this.skin.ink;
    ctx.fillText(`${this.score}`, 14 + ctx.measureText("Score: ").width, 12);

    // El par etiqueta+cifra queda repartido alrededor del centro: la etiqueta
    // termina 5 px antes y la cifra empieza 5 px después.
    ctx.textAlign = "right";
    ctx.fillStyle = this.skin.inkDim;
    ctx.fillText("Nivel:", this.width / 2 - 5, 12);
    ctx.textAlign = "left";
    ctx.fillStyle = this.skin.ink;
    ctx.fillText(`${this.level}`, this.width / 2 + 5, 12);
    ctx.restore();
  }

  // Dibuja la grilla, el marco letal, el plato de la fruta, el cuerpo de la
  // serpiente y el HUD en vivo (SCORE/NIVEL) sobre el lienzo lógico 800×600, todo
  // con la paleta vigente. NO dibuja el sprite de la fruta (eso lo hace
  // snake-canvas.tsx con FRUIT_ATLAS + drawImage a partir de foodCell/foodSprite,
  // encima del plato) ni overlays de pausa/game over — eso lo maneja la plataforma.
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // Estado de sombra limpio antes de nada: el contexto llega compartido desde
    // el canvas, que también dibuja la fruta con su propio shadowBlur.
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.skin.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid(ctx);
    this.drawBorder(ctx);
    this.drawFoodPlate(ctx);
    this.drawSnake(ctx);
    this.drawHUD(ctx);
    ctx.restore();
  }

  getState(): SnakeState {
    return {
      score: this.score,
      level: this.level,
      status: this.status,
      foodCell: this.foodCell,
      foodSprite: this.foodSprite,
    };
  }
}
