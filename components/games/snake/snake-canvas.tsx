"use client";

import { useEffect, useRef, useState } from "react";
import { SnakeEngine, type SnakeInput } from "@/components/games/snake/engine";
import { FRUIT_ATLAS } from "@/components/games/snake/fruit-atlas";
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

export function SnakeCanvas({ paused, onStateChange, onGameOver }: GameCanvasProps) {
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

    engineRef.current = new SnakeEngine(WIDTH, HEIGHT);

    return () => {
      engineRef.current = null;
    };
  }, []);

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
        if (img) {
          const rect = FRUIT_ATLAS[state.foodSprite];
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
        }

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
