// ===== engine.ts — motor de Snake, construido desde cero (sin game.js de referencia) =====
// Sin dependencias de React ni del DOM global (document/window/ctx/Image). Todo el estado vive
// en SnakeEngine; el input se recibe como parámetro en cada frame, igual que
// AsteroidsEngine/TetrisEngine/ArkanoidEngine. El motor nunca dibuja la fruta como imagen —
// reporta qué celda/sprite corresponde en su estado (foodCell/foodSprite) y es snake-canvas.tsx
// quien la dibuja con drawImage, mismo principio que el buffer `sfx` de ArkanoidState.

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

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.gridW = Math.floor(width / CELL); // 800 / 40 = 20
    this.gridH = Math.floor(height / CELL); // 600 / 40 = 15
    this.reset();
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
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
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

  private drawSnake(ctx: CanvasRenderingContext2D) {
    const pad = 2;
    this.segments.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? "#00ff88" : "#00cc6e";
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = isHead ? 14 : 8;
      ctx.fillRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
    });
    ctx.shadowBlur = 0;
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${this.score}`, 10, 10);

    ctx.textAlign = "center";
    ctx.fillText(`Nivel: ${this.level}`, this.width / 2, 10);
  }

  // Dibuja la grilla, el cuerpo de la serpiente (vectorial, con resplandor neón)
  // y el HUD en vivo (SCORE/NIVEL) sobre el lienzo lógico 800×600. NO dibuja la
  // fruta (eso lo hace snake-canvas.tsx con FRUIT_ATLAS + drawImage a partir de
  // foodCell/foodSprite) ni overlays de pausa/game over — eso lo maneja la
  // plataforma.
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid(ctx);
    this.drawSnake(ctx);
    this.drawHUD(ctx);
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
