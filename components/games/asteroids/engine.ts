// ===== engine.ts — motor de Asteroids, portado desde references/started-games/02-asteroids/game.js =====
// Sin dependencias de React ni del DOM global (document/window). Todo el estado vive en AsteroidsEngine;
// el input y el contexto de canvas se reciben como parámetros en cada frame.
//
// Colores: ni un literal. La paleta entra como dato explícito (GameSkin de lib/games/skins.ts) por el
// constructor y se reemplaza en caliente con setSkin() — el motor no lee variables CSS ni consulta el
// DOM. Cambiar de skin no reinicia la partida: no hay estado de juego atado a la paleta.
//
// Mapa de los 11 sitios de color a campos semánticos de GameSkin:
//   bg      → fondo que pinta draw() antes de todo
//   grid    → relleno tenue del cuerpo de los asteroides (evita que en modo claro el interior
//             del polígono se confunda con el fondo)
//   ramp    → contorno del asteroide, indexado por tamaño: ramp[size - 1] (tamaños 1, 2 y 3).
//             Las 3 primeras entradas de la rampa están elegidas para no colisionar con
//             primary/accent/danger (ver la invariante en lib/games/skins.ts).
//   primary → nave y balas (la bala es "de la nave", comparte su color)
//   accent  → powerup 3x: recuadro, etiqueta y contador del HUD
//   danger  → fuego: llama del propulsor y partículas de explosión
//   ink     → texto del HUD interno e iconos de vidas
//   glow    → shadowBlur de nave/balas/asteroides/powerup; siempre 0 en modo claro

import type { GameSkin } from "@/lib/games/skins";

export type AsteroidsStatus = "playing" | "dead" | "gameover";
// "playing"  → partida en curso
// "dead"     → nave recién destruida, respawn pendiente (deadTimer), no es fin de partida
// "gameover" → 0 vidas, GamePlayer debe leer el score final y disparar onGameOver

export type AsteroidsState = {
  score: number;
  lives: number;
  level: number;
  status: AsteroidsStatus;
};

export type AsteroidsInput = {
  left: boolean; // ArrowLeft sostenida
  right: boolean; // ArrowRight sostenida
  thrust: boolean; // ArrowUp sostenida
  shoot: boolean; // Space presionada este frame (edge-triggered, la detecta asteroids-canvas.tsx)
};

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Constants ─────────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

// ── Helpers de skin ───────────────────────────────────────────────────────────
// En modo claro `glow` es 0 porque shadowBlur es invisible sobre fondo claro:
// la legibilidad se compensa engrosando el trazo, no con brillo.
const trazo = (skin: GameSkin, base: number) => (skin.glow === 0 ? base * 1.7 : base);

// shadowColor siempre sale de la paleta, nunca de un literal.
function aplicarGlow(ctx: CanvasRenderingContext2D, skin: GameSkin, color: string) {
  ctx.shadowColor = color;
  ctx.shadowBlur = skin.glow;
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;
  private width: number;
  private height: number;

  constructor(x: number, y: number, angle: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.width = width;
    this.height = height;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, this.width);
    this.y = wrap(this.y + this.vy * dt, this.height);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    ctx.save();
    ctx.fillStyle = skin.primary;
    aplicarGlow(ctx, skin, skin.primary);
    ctx.beginPath();
    // Sin glow (modo claro) la bala necesita algo más de cuerpo para leerse.
    ctx.arc(this.x, this.y, skin.glow === 0 ? this.radius + 0.8 : this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];
  private width: number;
  private height: number;

  constructor(x: number, y: number, size: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    this.width = width;
    this.height = height;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, this.width);
    this.y = wrap(this.y + this.vy * dt, this.height);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1, this.width, this.height),
      new Asteroid(this.x, this.y, this.size - 1, this.width, this.height),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    // Tamaños 1..3 → ramp[0..2]. El módulo es defensa por si una skin futura
    // declara una rampa más corta; con las tres actuales (7 entradas) nunca actúa.
    const color = skin.ramp[(this.size - 1) % skin.ramp.length];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    // Cuerpo apenas insinuado antes del contorno: sin él, en modo claro el
    // interior del polígono se confunde con el fondo y las balas "desaparecen"
    // al pasar por detrás de una roca.
    ctx.fillStyle = skin.grid;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = trazo(skin, 1.5);
    ctx.lineJoin = "round";
    aplicarGlow(ctx, skin, color);
    ctx.stroke();
    ctx.restore();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;
  private width: number;
  private height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.width = width;
    this.height = height;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, this.width);
    this.y = wrap(this.y + this.vy * dt, this.height);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  // `elapsedMs` reemplaza a `performance.now()` del original — el motor no depende de globales del DOM,
  // el tiempo transcurrido lo lleva AsteroidsEngine y se pasa explícitamente para el pulso visual.
  draw(ctx: CanvasRenderingContext2D, elapsedMs: number, skin: GameSkin) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(elapsedMs / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = skin.accent;
    ctx.lineWidth = trazo(skin, 2);
    aplicarGlow(ctx, skin, skin.accent);
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = skin.accent;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  x = 0;
  y = 0;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tripleShot = 0;
    this.reset();
  }

  reset() {
    this.x = this.width / 2;
    this.y = this.height / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, input: AsteroidsInput) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (input.left) this.angle -= ROT * dt;
    if (input.right) this.angle += ROT * dt;

    this.thrusting = input.thrust;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, this.width);
    this.y = wrap(this.y + this.vy * dt, this.height);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD, this.width, this.height),
        new Bullet(ox, oy, this.angle, this.width, this.height),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD, this.width, this.height),
      ];
    }
    return [new Bullet(ox, oy, this.angle, this.width, this.height)];
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.primary;
    ctx.lineWidth = trazo(skin, 1.5);
    ctx.lineJoin = "round";
    aplicarGlow(ctx, skin, skin.primary);

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      // El 0.85 de opacidad del original se aplica con globalAlpha en vez de
      // ir embebido en un color literal: el color sale entero de la paleta.
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = skin.danger;
      aplicarGlow(ctx, skin, skin.danger);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: GameSkin) {
    // El desvanecido del original venía embebido en el color literal; ahora el
    // color es de paleta y la opacidad se aplica aparte con globalAlpha.
    ctx.save();
    ctx.globalAlpha = this.ttl / this.life;
    ctx.strokeStyle = skin.danger;
    ctx.lineWidth = trazo(skin, 1);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
    ctx.restore();
  }
}

// ── AsteroidsEngine ───────────────────────────────────────────────────────────
export class AsteroidsEngine {
  private width: number;
  private height: number;
  private skin: GameSkin;

  private ship!: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];

  private score = 0;
  private lives = 3;
  private level = 1;
  private status: AsteroidsStatus = "playing";
  private deadTimer = 0;
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;
  private elapsed = 0; // tiempo total transcurrido (s), reemplaza a performance.now() en PowerUp.draw

  constructor(width: number, height: number, skin: GameSkin) {
    this.width = width;
    this.height = height;
    this.skin = skin;
    this.reset();
  }

  // Cambio de paleta en caliente: solo afecta al dibujo, no toca nada del
  // estado de la partida (posiciones, vidas, score). Por eso el reproductor
  // puede cambiar de skin a media partida sin remontar el canvas.
  setSkin(skin: GameSkin) {
    this.skin = skin;
  }

  reset() {
    this.ship = new Ship(this.width, this.height);
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.status = "playing";
    this.deadTimer = 0;
    this.spawnAsteroids(4);
  }

  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, this.width);
        y = rand(0, this.height);
      } while (Math.hypot(x - this.width / 2, y - this.height / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3, this.width, this.height));
    }
  }

  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }

  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.status = "gameover";
    } else {
      this.status = "dead";
      this.deadTimer = 2;
    }
  }

  update(dt: number, input: AsteroidsInput) {
    this.elapsed += dt;

    if (this.status === "gameover") {
      // El overlay "GAME OVER" y su atajo de Espacio para reiniciar se eliminan aquí:
      // el fin de partida lo maneja el modal de la plataforma, no el motor.
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      return;
    }

    if (this.status === "dead") {
      this.deadTimer -= dt;
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.asteroids.forEach((a) => a.update(dt));
      if (this.deadTimer <= 0) {
        this.status = "playing";
        this.ship.reset();
      }
      return;
    }

    // Disparar
    if (input.shoot) {
      this.bullets.push(...this.ship.tryShoot());
    }

    this.ship.update(dt, input);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.particles.forEach((p) => p.update(dt));
    this.powerUps.forEach((p) => p.update(dt));

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed = this.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y, this.width, this.height));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();
  }

  private drawLifeIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = this.skin.ink;
    ctx.lineWidth = trazo(this.skin, 1.2);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // El HUD interno se dibuja SIN glow a propósito: el halo emborrona el texto
  // pequeño y el contraste ya está garantizado por la paleta (ink y accent
  // cumplen ≥ 4.5:1 contra bg en las 6 combinaciones, ver lib/games/skins.ts).
  private drawHUD(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.skin.ink;
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${this.score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, this.width / 2, 26);

    for (let i = 0; i < this.lives; i++) this.drawLifeIcon(ctx, this.width - 16 - i * 22, 18);

    if (this.ship.tripleShot > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = this.skin.accent;
      ctx.fillText(`3x  ${this.ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
    ctx.restore();
  }

  // Dibuja entidades + HUD de juego en vivo (SCORE/NIVEL/vidas/"3x Ns"), igual que game.js;
  // NO dibuja el overlay "GAME OVER" (ese fin de partida lo maneja el modal de la plataforma).
  draw(ctx: CanvasRenderingContext2D) {
    const skin = this.skin;
    ctx.save();
    // Estado de sombra limpio antes de nada: cada entidad se dibuja dentro de
    // su propio save/restore, pero el contexto llega compartido desde el canvas.
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this.particles.forEach((p) => p.draw(ctx, skin));
    this.asteroids.forEach((a) => a.draw(ctx, skin));
    this.powerUps.forEach((p) => p.draw(ctx, this.elapsed * 1000, skin));
    this.bullets.forEach((b) => b.draw(ctx, skin));
    this.ship.draw(ctx, skin);

    this.drawHUD(ctx);
    ctx.restore();
  }

  getState(): AsteroidsState {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      status: this.status,
    };
  }
}
