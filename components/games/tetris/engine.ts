// ===== engine.ts — motor de Tetris, portado desde references/started-games/03-tetris/game.js =====
// Sin dependencias de React ni del DOM global (document/window). Todo el estado vive en TetrisEngine;
// el input y el contexto de canvas se reciben como parámetros en cada frame, igual que AsteroidsEngine.

export type TetrisStatus = "playing" | "gameover";

export type TetrisState = {
  score: number;
  lines?: number;
  level?: number;
  status?: TetrisStatus;
  // Tetris no tiene "lives" ni estado "won" (juego infinito hasta toparse) —
  // ambos quedan fuera del tipo en vez de forzados a undefined explícito.
};

export type TetrisInput = {
  moveLeft: boolean; // ArrowLeft presionada este frame (edge-triggered, la encola tetris-canvas.tsx)
  moveRight: boolean; // ArrowRight presionada este frame
  rotate: boolean; // ArrowUp o KeyX presionada este frame
  softDrop: boolean; // ArrowDown presionada este frame — baja un solo paso por evento,
  // igual que game.js; la repetición mientras se mantiene la tecla depende del
  // auto-repeat nativo del navegador, no de lógica del motor (fiel al original).
  hardDrop: boolean; // Space presionada este frame
};

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;

// Índice 0 = celda vacía. 1-8 identifican tanto la pieza (PIECES) como su
// color (COLORS), igual que en el original.
const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Layout del lienzo lógico 800×600: tablero (10×20 a BLOCK=30px, igual que el
// original) alineado a toda la altura, más el panel de la siguiente pieza,
// ambos centrados como un solo bloque horizontal — así el tablero angosto
// (300×600) no queda deformado ni descentrado dentro del marco 4:3 compartido.
const BLOCK = 30;
const PREVIEW_BLOCK = 24;
const PREVIEW_CELLS = 4;
const PREVIEW_PAD = 17;
const BOARD_W = COLS * BLOCK; // 300
const BOARD_H = ROWS * BLOCK; // 600
const PREVIEW_SIZE = PREVIEW_CELLS * PREVIEW_BLOCK + PREVIEW_PAD * 2; // 130
const GAP = 50;

type Piece = { type: number; shape: number[][]; x: number; y: number };

function cloneShape(shape: number[][]): number[][] {
  return shape.map((row) => [...row]);
}

function collide(board: number[][], shape: number[][], ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

export class TetrisEngine {
  private width: number;
  private height: number;

  private board: number[][] = [];
  private current!: Piece;
  private next!: Piece;

  private score = 0;
  private lines = 0;
  private level = 1;
  private status: TetrisStatus = "playing";

  private dropInterval = 1; // segundos; max(100, 1000-(nivel-1)*90) ms, ver clearLines()
  private dropAccum = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.status = "playing";
    this.dropInterval = 1;
    this.dropAccum = 0;
    this.next = this.randomPiece();
    this.spawn();
  }

  private randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = cloneShape(PIECES[type]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  private spawn() {
    this.current = this.next;
    this.next = this.randomPiece();
    if (collide(this.board, this.current.shape, this.current.x, this.current.y)) {
      this.status = "gameover";
    }
  }

  private tryRotate() {
    const rotated = rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(this.board, rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private merge() {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
      }
    }
  }

  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90) / 1000;
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!collide(this.board, this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  update(dt: number, input: TetrisInput) {
    if (this.status === "gameover") return;

    if (
      input.moveLeft &&
      !collide(this.board, this.current.shape, this.current.x - 1, this.current.y)
    ) {
      this.current.x--;
    }
    if (
      input.moveRight &&
      !collide(this.board, this.current.shape, this.current.x + 1, this.current.y)
    ) {
      this.current.x++;
    }
    if (input.rotate) this.tryRotate();

    if (input.softDrop) {
      if (!collide(this.board, this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++;
        this.score += 1;
      } else {
        this.lockPiece();
      }
    }

    // softDrop pudo disparar lockPiece()→spawn() y terminar la partida (spawn
    // choca de inmediato con el tablero lleno): no seguir procesando hardDrop
    // ni la caída automática sobre una pieza que ya no existe. Se compara vía
    // isGameOver() (una llamada a método) en vez de `this.status === "..."`
    // directo porque TypeScript no invalida el narrowing del early-return de
    // arriba a través de las llamadas a lockPiece()/spawn() intermedias.
    if (this.isGameOver()) return;

    if (input.hardDrop) {
      const gy = this.ghostY();
      this.score += (gy - this.current.y) * 2;
      this.current.y = gy;
      this.lockPiece();
    }

    if (this.isGameOver()) return;

    // Caída automática: independiente del input, igual que loop()/dropAccum en el original.
    this.dropAccum += dt;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (!collide(this.board, this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }

  private isGameOver(): boolean {
    return this.status === "gameover";
  }

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    ctx.globalAlpha = alpha ?? 1;
    ctx.fillStyle = color as string;
    ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  private drawGrid(ctx: CanvasRenderingContext2D, boardX: number, boardY: number) {
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(boardX + c * BLOCK, boardY);
      ctx.lineTo(boardX + c * BLOCK, boardY + BOARD_H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(boardX, boardY + r * BLOCK);
      ctx.lineTo(boardX + BOARD_W, boardY + r * BLOCK);
      ctx.stroke();
    }
  }

  // Dibuja tablero + pieza actual + ghost piece + vista previa de la siguiente
  // pieza, todo centrado dentro del lienzo lógico 800×600. NO dibuja HUD de
  // texto (score/lines/level) ni overlays de pausa/game over — eso lo resuelve
  // exclusivamente el HUD externo y el modal/overlay de la plataforma.
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    const contentW = BOARD_W + GAP + PREVIEW_SIZE;
    const boardX = Math.round((this.width - contentW) / 2);
    const boardY = Math.round((this.height - BOARD_H) / 2);

    // Fondo + borde del tablero
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(boardX, boardY, BOARD_W, BOARD_H);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(boardX + 0.5, boardY + 0.5, BOARD_W - 1, BOARD_H - 1);

    this.drawGrid(ctx, boardX, boardY);

    // Tablero fijo
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.drawBlock(ctx, boardX, boardY, c, r, this.board[r][c], BLOCK);
      }
    }

    // Ghost piece
    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++) {
      for (let c = 0; c < this.current.shape[r].length; c++) {
        if (this.current.shape[r][c]) {
          this.drawBlock(
            ctx,
            boardX,
            boardY,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            BLOCK,
            0.2,
          );
        }
      }
    }

    // Pieza actual
    for (let r = 0; r < this.current.shape.length; r++) {
      for (let c = 0; c < this.current.shape[r].length; c++) {
        this.drawBlock(
          ctx,
          boardX,
          boardY,
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          BLOCK,
        );
      }
    }

    // Vista previa de la siguiente pieza, panel a la derecha del tablero,
    // centrado verticalmente en el lienzo.
    const previewX = boardX + BOARD_W + GAP;
    const previewY = Math.round((this.height - PREVIEW_SIZE) / 2);
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(previewX, previewY, PREVIEW_SIZE, PREVIEW_SIZE);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.strokeRect(previewX + 0.5, previewY + 0.5, PREVIEW_SIZE - 1, PREVIEW_SIZE - 1);

    const shape = this.next.shape;
    const offX = Math.floor((PREVIEW_CELLS - shape[0].length) / 2);
    const offY = Math.floor((PREVIEW_CELLS - shape.length) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        this.drawBlock(
          ctx,
          previewX + PREVIEW_PAD,
          previewY + PREVIEW_PAD,
          offX + c,
          offY + r,
          shape[r][c],
          PREVIEW_BLOCK,
        );
      }
    }
  }

  getState(): TetrisState {
    return {
      score: this.score,
      lines: this.lines,
      level: this.level,
      status: this.status,
    };
  }
}
