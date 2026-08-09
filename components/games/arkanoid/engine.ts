// ===== engine.ts — motor de Arkanoid, portado desde references/started-games/04-arkanoid/game.js + levels.js =====
// Sin dependencias de React ni del DOM global (document/window/Audio). Todo el estado vive en ArkanoidEngine;
// el input se recibe como parámetro en cada frame, igual que AsteroidsEngine/TetrisEngine. El motor nunca
// instancia Audio — reporta los sonidos disparados en el buffer `sfx` de su estado; ArkanoidCanvas los reproduce.
//
// Colores: ni un literal. La paleta entra como dato explícito (GameSkin de lib/games/skins.ts) por el
// constructor y se reemplaza en caliente con setSkin() — el motor no lee variables CSS ni consulta el DOM.
// Cambiar de skin no reinicia la partida: el estado de juego no guarda ningún color, solo índices de rampa.
//
// Mapa de los sitios de color a campos semánticos de GameSkin:
//   bg      → fondo del campo
//   grid    → celosía 10×6 del muro (se ve también donde ya no hay bloque) y las 3 paredes de rebote
//   ramp[n] → bloque y su explosión; `n` es el BlockTone de la definición de nivel (ver LEVELS)
//   primary → pelota
//   accent  → paddle y los iconos de vida del HUD (misma cosa: tu stock de paddles)
//   ink     → texto del HUD interno (Score / Nivel)
//   danger  → línea de muerte del borde inferior, por donde se pierde la pelota
// `inkDim` no se usa: el HUD del original no tiene jerarquía secundaria que justificarlo.

import type { GameSkin } from "@/lib/games/skins";

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

// ── Helpers de skin ───────────────────────────────────────────────────────────
// En modo claro `glow` es 0 porque shadowBlur es invisible sobre fondo claro:
// la legibilidad se compensa engrosando el trazo, no con brillo.
const trazo = (skin: GameSkin, base: number) => (skin.glow === 0 ? base * 1.7 : base);

// shadowColor siempre sale de la paleta, nunca de un literal.
function aplicarGlow(ctx: CanvasRenderingContext2D, skin: GameSkin, color: string) {
  ctx.shadowColor = color;
  ctx.shadowBlur = skin.glow;
}

// Índice sobre GameSkin.ramp (7 entradas, ver la invariante en lib/games/skins.ts).
// Reemplaza al union de nombres CSS del original ("red" | "cyan" | … se usaban tal cual como
// fillStyle en levels.js): un bloque ya no sabe de qué COLOR es, solo de qué SLOT de la paleta
// es, y cada skin decide el hex. Las 5 definiciones de nivel de abajo conservan exactamente la
// distribución del original — solo cambian los nombres por sus índices:
//   red → 0   yellow → 1   cyan → 2   magenta → 3   hotpink → 4   green → 5   gray → 6
type BlockTone = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Color de un bloque bajo la skin activa. El módulo es defensa por si una skin futura
// declara una rampa más corta que 7.
const tonoHex = (skin: GameSkin, tone: BlockTone) => skin.ramp[tone % skin.ramp.length];

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: BlockTone;
  alive: boolean;
};

type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: BlockTone;
  elapsed: number; // s
};

type LevelDef = {
  speed: number;
  blocks: { col: number; row: number; tone: BlockTone }[];
};

// ── Niveles ───────────────────────────────────────────────────────────────────
// Portados 1:1 desde levels.js: parrilla completa, pirámide, tablero de ajedrez, filas con
// huecos, marco+cruz. El multiplicador de velocidad de la pelota crece ×1.00 → ×1.46.
const LEVELS: LevelDef[] = (() => {
  // Original: ["red","yellow","cyan","magenta","hotpink","green"]
  const rowTones1: BlockTone[] = [0, 1, 2, 3, 4, 5];
  // Original: ["gray","cyan","hotpink","yellow","magenta","green"]
  const rowTones2: BlockTone[] = [6, 2, 4, 1, 3, 5];
  // Original: ["cyan","magenta","green","yellow","hotpink","red"]
  const rowTones4: BlockTone[] = [2, 3, 5, 1, 4, 0];

  const l1: LevelDef["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) l1.push({ col, row, tone: rowTones1[row] });

  const l2: LevelDef["blocks"] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, tone: rowTones2[row] });

  const l3: LevelDef["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, tone: row < 3 ? 1 : 3 });

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
      if (!gaps4[row].includes(col)) l4.push({ col, row, tone: rowTones4[row] });

  const l5: LevelDef["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      // Original: cruz "hotpink" sobre marco "cyan"
      if (isFrame || isCross) l5.push({ col, row, tone: isCross && !isFrame ? 4 : 2 });
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
  private skin: GameSkin;

  constructor(width: number, height: number, skin: GameSkin) {
    this.width = width;
    this.height = height;
    this.skin = skin;
    this.blocksOriginX = (width - BLOCK_COLS * BLOCK_W) / 2;
    this.paddle.y = height - 40;
    this.reset();
  }

  // Cambio de skin (o de modo claro/oscuro) en caliente: nada del estado de juego
  // depende de la paleta — los bloques guardan un índice de rampa, no un color —
  // así que se puede cambiar de skin a media partida sin remontar el canvas.
  setSkin(skin: GameSkin) {
    this.skin = skin;
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
      tone: b.tone,
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
          tone: block.tone,
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
    const color = tonoHex(this.skin, exp.tone);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = color;
    aplicarGlow(ctx, this.skin, color);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Celosía del muro: se dibuja bajo los bloques y sigue visible donde ya no
  // queda ninguno, así el campo se lee como una grilla aun con el nivel casi
  // limpio. `grid` es deliberadamente tenue en las 6 combinaciones (~1.1–1.3:1
  // contra bg): es detalle decorativo, no una entidad de juego.
  private drawCelosia(ctx: CanvasRenderingContext2D) {
    const x0 = this.blocksOriginX;
    const x1 = x0 + BLOCK_COLS * BLOCK_W;
    const y0 = BLOCKS_ORIGIN_Y;
    const y1 = y0 + BLOCK_ROWS * BLOCK_H;

    ctx.save();
    ctx.strokeStyle = this.skin.grid;
    ctx.lineWidth = trazo(this.skin, 1);
    ctx.beginPath();
    for (let col = 0; col <= BLOCK_COLS; col++) {
      const x = x0 + col * BLOCK_W;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let row = 0; row <= BLOCK_ROWS; row++) {
      const y = y0 + row * BLOCK_H;
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Las 3 paredes contra las que rebota la pelota (izquierda, arriba, derecha) y
  // la línea de muerte de abajo, la única que NO rebota: por ahí se pierde una
  // vida, y por eso es la que se pinta con `danger`.
  private drawLimites(ctx: CanvasRenderingContext2D) {
    const lw = trazo(this.skin, 2);
    ctx.save();
    ctx.lineWidth = lw;

    ctx.strokeStyle = this.skin.grid;
    ctx.beginPath();
    ctx.moveTo(lw / 2, this.height);
    ctx.lineTo(lw / 2, lw / 2);
    ctx.lineTo(this.width - lw / 2, lw / 2);
    ctx.lineTo(this.width - lw / 2, this.height);
    ctx.stroke();

    ctx.strokeStyle = this.skin.danger;
    aplicarGlow(ctx, this.skin, this.skin.danger);
    ctx.beginPath();
    ctx.moveTo(0, this.height - lw / 2);
    ctx.lineTo(this.width, this.height - lw / 2);
    ctx.stroke();
    ctx.restore();
  }

  // El HUD interno se dibuja SIN glow a propósito: el halo emborrona el texto
  // pequeño y el contraste ya está garantizado por la paleta (`ink` y `accent`
  // cumplen ≥ 4.5:1 contra bg en las 6 combinaciones, ver lib/games/skins.ts).
  private drawHUD(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.skin.ink;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${this.score}`, 10, 10);

    ctx.textAlign = "center";
    ctx.fillText(`Nivel: ${this.level}`, this.width / 2, 10);

    // Los iconos de vida van en `accent`, el mismo color del paddle: lo que te
    // queda en stock son paddles, y verlos del color del paddle lo hace obvio.
    const lifeSize = 16;
    const lifeGap = 4;
    ctx.fillStyle = this.skin.accent;
    for (let i = 0; i < this.lives; i++) {
      const bx = this.width - 10 - (this.lives - i) * (lifeSize + lifeGap);
      ctx.beginPath();
      ctx.arc(bx + lifeSize / 2, 10 + lifeSize / 2, lifeSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Dibuja paddle/pelota/bloques/explosiones vectoriales + HUD de juego en vivo
  // (SCORE/NIVEL/vidas), igual que el original; NO dibuja overlays de GAME OVER/victoria/pausa
  // (ese fin de partida lo maneja el modal de la plataforma).
  draw(ctx: CanvasRenderingContext2D) {
    const skin = this.skin;

    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawCelosia(ctx);
    this.drawLimites(ctx);

    // Los bloques van SIN glow: son hasta 60 rectángulos y el halo de `neon`
    // los fundiría en una mancha además de costar un shadowBlur por bloque.
    // El brillo se reserva para lo que se mueve (pelota, paddle, explosión).
    // Se rellenan con 1px de sangría para que quede una junta de `bg` entre
    // bloques contiguos del mismo tono, que si no se leen como una barra sólida.
    ctx.save();
    ctx.shadowBlur = 0;
    for (const block of this.blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = tonoHex(skin, block.tone);
      ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
    }
    ctx.restore();

    for (const exp of this.explosions) this.drawExplosion(ctx, exp);

    ctx.save();
    ctx.fillStyle = skin.accent;
    aplicarGlow(ctx, skin, skin.accent);
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    ctx.restore();

    // La pelota lleva un aro de `bg`: en `neon` y `retro` hay entradas de la
    // rampa idénticas a `primary` (p. ej. retro/dark ramp[3] === primary), así
    // que sin el aro la pelota desaparecería al pasar sobre un bloque de ese
    // tono. El aro la separa de cualquier bloque en las 6 combinaciones.
    const cx = this.ball.x + this.ball.w / 2;
    const cy = this.ball.y + this.ball.h / 2;
    ctx.save();
    ctx.fillStyle = skin.primary;
    aplicarGlow(ctx, skin, skin.primary);
    ctx.beginPath();
    ctx.arc(cx, cy, this.ball.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = skin.bg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, this.ball.w / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

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
