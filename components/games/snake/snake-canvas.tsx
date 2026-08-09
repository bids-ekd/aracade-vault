"use client";

import { useEffect, useRef, useState } from "react";
import { SnakeEngine, type SnakeInput, type SnakeState } from "@/components/games/snake/engine";
import { FRUIT_ATLAS } from "@/components/games/snake/fruit-atlas";
import type { GameSkin } from "@/lib/games/skins";
import type { GameCanvasProps } from "@/lib/games/types";

const WIDTH = 800;
const HEIGHT = 600;
const CELL = 40; // debe coincidir con CELL en engine.ts (grilla 20×15 sobre 800×600)
const KEY_CODES = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

type Direction = { dx: number; dy: number };
const UP: Direction = { dx: 0, dy: -1 };
const DOWN: Direction = { dx: 0, dy: 1 };
const LEFT: Direction = { dx: -1, dy: 0 };
const RIGHT: Direction = { dx: 1, dy: 0 };

// Dibuja el sprite de la fruta encima del plato que ya pintó el motor.
//
// fruits.png es arte a todo color y NO se retiñe con la skin: el sprite se dibuja
// siempre igual en las 6 combinaciones (ese es su "tratamiento fijo"). Lo único
// que aporta la paleta es el halo, cuyo color sale de ramp[0] — el mismo campo
// con el que el motor pinta el aro del plato — y cuyo radio es skin.glow, así que
// en modo claro (glow 0) desaparece solo, sin caso especial.
function dibujarFruta(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  state: SnakeState,
  skin: GameSkin,
) {
  const rect = FRUIT_ATLAS[state.foodSprite];
  ctx.save();
  ctx.shadowColor = skin.ramp[0];
  ctx.shadowBlur = skin.glow;
  ctx.drawImage(
    img,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    state.foodCell.x * CELL,
    state.foodCell.y * CELL,
    CELL,
    CELL,
  );
  ctx.restore();
}

export function SnakeCanvas({ paused, skin, onStateChange, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SnakeEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverFiredRef = useRef(false);

  const pausedRef = useRef(paused);
  // Input edge-triggered: cada tecla encola su acción al llegar el keydown y
  // se consume una sola vez en el siguiente frame de update(), mismo patrón
  // que TetrisCanvas (sin listener de keyup).
  const queuedRef = useRef({ left: false, right: false, up: false, down: false });
  // Última dirección aceptada por este componente, para descartar de entrada
  // cualquier tecla que invierta 180° la dirección actual — resguardo
  // duplicado con el que ya aplica SnakeEngine internamente. No se lee de
  // getState() (el contrato de SnakeState no expone `direction`): este ref
  // espeja la misma regla de forma independiente, arrancando en la misma
  // dirección inicial que reset() en engine.ts (mirando a la derecha).
  const directionRef = useRef<Direction>(RIGHT);
  // La skin del primer render, para construir el motor ya con la paleta buena
  // (el efecto de creación corre una sola vez y no puede depender de `skin` sin
  // remontar el motor). Los cambios posteriores van por setSkin().
  const skinInicialRef = useRef(skin);
  // Espejo de la skin vigente para el loop: el motor ya la tiene por setSkin(),
  // pero la fruta la dibuja este componente. Va por ref y no por dependencia del
  // efecto del loop para no cancelar y reagendar el requestAnimationFrame en cada
  // cambio de paleta.
  const skinRef = useRef(skin);

  // Precarga de fruits.png: el loop no arranca hasta que resuelve (assetsReady).
  const [assetsReady, setAssetsReady] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Callbacks siempre frescos sin forzar que el loop se recree en cada render.
  const onStateChangeRef = useRef(onStateChange);
  const onGameOverRef = useRef(onGameOver);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
    onGameOverRef.current = onGameOver;
  }, [onStateChange, onGameOver]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Canvas + motor: se crean una única vez por montaje. El reinicio de partida
  // se hace remontando el componente entero vía `key`, no con un reset imperativo.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    engineRef.current = new SnakeEngine(WIDTH, HEIGHT, skinInicialRef.current);

    return () => {
      engineRef.current = null;
    };
  }, []);

  // Cambio de skin o de modo claro/oscuro: se reaplica sobre el MISMO motor.
  // Nada de `key={skin}` ni de remontar el canvas — eso reiniciaría la partida
  // (el remonte es el mecanismo de reinicio de components/game-player.tsx).
  // Si el juego está en pausa el loop no corre, así que se repinta a mano
  // (motor + fruta) para que el cambio se vea igual.
  useEffect(() => {
    skinRef.current = skin;
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSkin(skin);
    if (!pausedRef.current) return;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    engine.draw(ctx);
    const img = imgRef.current;
    if (img?.complete) dibujarFruta(ctx, img, engine.getState(), skin);
  }, [skin]);

  // Precarga de la imagen de frutas. El motor nunca posee ni crea este
  // HTMLImageElement — solo reporta foodCell/foodSprite en su estado; dibujar
  // la fruta con drawImage es responsabilidad exclusiva de este componente.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setAssetsReady(true);
    img.src = "/games/snake/fruits.png";
    imgRef.current = img;
    return () => {
      img.onload = null;
      imgRef.current = null;
    };
  }, []);

  // Teclado: mientras está pausado, el input se ignora por completo (solo se
  // frena el scroll de la página con preventDefault). Descarta acá mismo
  // cualquier tecla que invierta 180° la dirección actual, antes de encolarla
  // — doble resguardo, el motor vuelve a filtrar lo mismo por su cuenta.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!KEY_CODES.includes(e.code)) return;
      e.preventDefault();
      if (pausedRef.current) return;

      let candidate: Direction | null = null;
      if (e.code === "ArrowLeft") candidate = LEFT;
      else if (e.code === "ArrowRight") candidate = RIGHT;
      else if (e.code === "ArrowUp") candidate = UP;
      else if (e.code === "ArrowDown") candidate = DOWN;
      if (!candidate) return;

      const current = directionRef.current;
      if (candidate.dx === -current.dx && candidate.dy === -current.dy) return;
      directionRef.current = candidate;

      if (e.code === "ArrowLeft") queuedRef.current.left = true;
      else if (e.code === "ArrowRight") queuedRef.current.right = true;
      else if (e.code === "ArrowUp") queuedRef.current.up = true;
      else if (e.code === "ArrowDown") queuedRef.current.down = true;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Loop: no se agenda ningún requestAnimationFrame mientras está pausado o
  // los assets todavía no cargaron (nada se mueve, el teclado no responde).
  // Al reanudar, `lastTimeRef` se resetea para no arrastrar un dt inflado por
  // el tiempo que estuvo congelado.
  useEffect(() => {
    if (paused || !assetsReady) return;

    lastTimeRef.current = null;

    const frame = (ts: number) => {
      const engine = engineRef.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (engine && ctx) {
        const dt =
          lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = ts;

        const input: SnakeInput = { ...queuedRef.current };
        queuedRef.current = { left: false, right: false, up: false, down: false };

        engine.update(dt, input);
        engine.draw(ctx);

        const state = engine.getState();

        const img = imgRef.current;
        if (img) dibujarFruta(ctx, img, state, skinRef.current);

        onStateChangeRef.current({ score: state.score, level: state.level, status: state.status });

        if (state.status === "gameover" && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          onGameOverRef.current(state.score);
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [paused, assetsReady]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        aria-label="Snake"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {!assetsReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="spinner" aria-hidden="true"></span>
        </div>
      )}
    </div>
  );
}
