// ===== engine.ts — motor de Arkanoid, portado desde references/started-games/04-arkanoid/game.js + levels.js =====
// Sin dependencias de React ni del DOM global (document/window/Audio). Todo el estado vive en ArkanoidEngine;
// el input se recibe como parámetro en cada frame, igual que AsteroidsEngine/TetrisEngine. El motor nunca
// instancia Audio — reporta los sonidos disparados en el buffer `sfx` de su estado; ArkanoidCanvas los reproduce.

export type ArkanoidStatus = "playing" | "won" | "gameover";

export type ArkanoidSfx = "bounce" | "break";

export type ArkanoidState = {
  score: number;
  lives: number;
  level: number; // 1–5
  status: ArkanoidStatus;
  sfx: ArkanoidSfx[]; // sonidos disparados durante el último update(); se vacía al iniciar cada update()
};

export type ArkanoidInput = {
  left: boolean; // ArrowLeft sostenida
  right: boolean; // ArrowRight sostenida
  // Coordenada X lógica del último mousemove sobre el canvas, edge-triggered — la detecta
  // arkanoid-canvas.tsx por evento, no el motor. `null` si no hubo un mousemove nuevo desde el
  // último frame, en cuyo caso el paddle sigue el control de left/right. Cuando llega un valor,
  // pisa la posición del paddle ese frame (mismo criterio que el mouse en el original).
  mouseX: number | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const PADDLE_SPEED = 400; // px/s
const PADDLE_W = 81;
const PADDLE_H = 14;
const BALL_SIZE = 16;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 0.15; // s — igual a los 150ms de EXPLOSION_DURATION en spritesheet.js

// Colores de bloque del original, usados tal cual como ctx.fillStyle (son nombres CSS válidos).
type BlockColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};

type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // s
};

type LevelDef = {
  speed: number;
  blocks: { col: number; row: number; color: BlockColor }[];
};

// ── Niveles ───────────────────────────────────────────────────────────────────
// Portados 1:1 desde levels.js: parrilla completa, pirámide, tablero de ajedrez, filas con
// huecos, marco+cruz. El multiplicador de velocidad de la pelota crece ×1.00 → ×1.46.
const LEVELS: LevelDef[] = (() => {
  const rowColors1: BlockColor[] = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2: BlockColor[] = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4: BlockColor[] = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: LevelDef["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelDef["blocks"] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelDef["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelDef["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelDef["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// ── ArkanoidEngine ────────────────────────────────────────────────────────────
export class ArkanoidEngine {
  private width: number;
  private height: number;
  private blocksOriginX: number;

  private paddle = { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H };
  private ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];

  private score = 0;
  private lives = 3;
  private level = 1;
  private status: ArkanoidStatus = "playing";
  private sfx: ArkanoidSfx[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.blocksOriginX = (width - BLOCK_COLS * BLOCK_W) / 2;
    this.paddle.y = height - 40;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.status = "playing";
    this.sfx = [];
    this.paddle.x = (this.width - this.paddle.w) / 2;
    this.loadLevel(1);
  }

  private loadLevel(n: number) {
    this.level = n;
    const level = LEVELS[n - 1];
    this.blocks = level.blocks.map((b) => ({
      x: this.blocksOriginX + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.initBall(level.speed);
  }

  private initBall(speed: number) {
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private collideAABB(block: Block) {
    return (
      this.ball.x < block.x + block.w &&
      this.ball.x + this.ball.w > block.x &&
      this.ball.y < block.y + block.h &&
      this.ball.y + this.ball.h > block.y
    );
  }

  update(dt: number, input: ArkanoidInput) {
    this.sfx = [];
    if (this.status !== "playing") return;

    // Paddle: teclado sostenido mueve a velocidad fija; si hubo un mousemove nuevo este frame,
    // el mouse pisa la posición encima de lo que haya hecho el teclado (mismo criterio que el original).
    if (input.left) this.paddle.x = Math.max(0, this.paddle.x - PADDLE_SPEED * dt);
    if (input.right)
      this.paddle.x = Math.min(this.width - this.paddle.w, this.paddle.x + PADDLE_SPEED * dt);
    if (input.mouseX !== null) {
      this.paddle.x = Math.max(
        0,
        Math.min(this.width - this.paddle.w, input.mouseX - this.paddle.w / 2),
      );
    }

    // Movimiento de la pelota
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Rebotes en paredes (izquierda, derecha, arriba)
    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ball.vx = Math.abs(this.ball.vx);
      this.sfx.push("bounce");
    }
    if (this.ball.x + this.ball.w >= this.width) {
      this.ball.x = this.width - this.ball.w;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.sfx.push("bounce");
    }
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ball.vy = Math.abs(this.ball.vy);
      this.sfx.push("bounce");
    }

    // Rebote en el paddle
    if (
      this.ball.vy > 0 &&
      this.ball.x + this.ball.w > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.w &&
      this.ball.y + this.ball.h >= this.paddle.y &&
      this.ball.y + this.ball.h <= this.paddle.y + this.paddle.h + 8
    ) {
      this.ball.y = this.paddle.y - this.ball.h;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.sfx.push("bounce");
    }

    // Colisión con bloques — uno por frame, igual que el original
    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += 10;
        this.ball.vy = -this.ball.vy;
        this.sfx.push("break");
        if (this.blocks.every((b) => !b.alive)) {
          if (this.level < 5) this.loadLevel(this.level + 1);
          else this.status = "won";
        }
        break;
      }
    }

    // Explosiones vectoriales
    for (const exp of this.explosions) exp.elapsed += dt;
    this.explosions = this.explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida
    if (this.status === "playing" && this.ball.y > this.height) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.status = "gameover";
      } else {
        this.initBall(LEVELS[this.level - 1].speed);
      }
    }
  }

  private drawExplosion(ctx: CanvasRenderingContext2D, exp: Explosion) {
    const progress = exp.elapsed / EXPLOSION_DURATION; // 0 → 1
    const cx = exp.x + exp.w / 2;
    const cy = exp.y + exp.h / 2;
    const radius = (Math.max(exp.w, exp.h) / 2) * (0.4 + progress * 1.1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = exp.color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${this.score}`, 10, 10);

    ctx.textAlign = "center";
    ctx.fillText(`Nivel: ${this.level}`, this.width / 2, 10);

    const lifeSize = 16;
    const lifeGap = 4;
    ctx.fillStyle = "#fff";
    for (let i = 0; i < this.lives; i++) {
      const bx = this.width - 10 - (this.lives - i) * (lifeSize + lifeGap);
      ctx.beginPath();
      ctx.arc(bx + lifeSize / 2, 10 + lifeSize / 2, lifeSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Dibuja paddle/pelota/bloques/explosiones vectoriales + HUD de juego en vivo
  // (SCORE/NIVEL/vidas), igual que el original; NO dibuja overlays de GAME OVER/victoria/pausa
  // (ese fin de partida lo maneja el modal de la plataforma).
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    for (const block of this.blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, block.w, block.h);
    }

    for (const exp of this.explosions) this.drawExplosion(ctx, exp);

    ctx.fillStyle = "#00f5ff";
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(
      this.ball.x + this.ball.w / 2,
      this.ball.y + this.ball.h / 2,
      this.ball.w / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    this.drawHUD(ctx);
  }

  getState(): ArkanoidState {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      status: this.status,
      sfx: this.sfx,
    };
  }
}
