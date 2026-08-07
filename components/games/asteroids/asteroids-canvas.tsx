"use client";

import { useEffect, useRef } from "react";
import { AsteroidsEngine, type AsteroidsInput } from "@/components/games/asteroids/engine";

const WIDTH = 800;
const HEIGHT = 600;
const KEY_CODES = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"];

type AsteroidsCanvasProps = {
  paused: boolean;
  onStateChange: (state: { score: number; lives: number; level: number }) => void;
  onGameOver: (finalScore: number) => void;
};

export function AsteroidsCanvas({ paused, onStateChange, onGameOver }: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverFiredRef = useRef(false);

  const pausedRef = useRef(paused);
  const heldRef = useRef({ left: false, right: false, thrust: false });
  const shootQueuedRef = useRef(false);

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

    engineRef.current = new AsteroidsEngine(WIDTH, HEIGHT);

    return () => {
      engineRef.current = null;
    };
  }, []);

  // Teclado: mientras está pausado, el input se ignora por completo (solo se
  // frena el scroll de la página con preventDefault).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!KEY_CODES.includes(e.code)) return;
      e.preventDefault();
      if (pausedRef.current) return;
      if (e.code === "ArrowLeft") heldRef.current.left = true;
      else if (e.code === "ArrowRight") heldRef.current.right = true;
      else if (e.code === "ArrowUp") heldRef.current.thrust = true;
      else if (e.code === "Space" && !e.repeat) shootQueuedRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!KEY_CODES.includes(e.code)) return;
      e.preventDefault();
      if (pausedRef.current) return;
      if (e.code === "ArrowLeft") heldRef.current.left = false;
      else if (e.code === "ArrowRight") heldRef.current.right = false;
      else if (e.code === "ArrowUp") heldRef.current.thrust = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Loop: mientras `paused` es true no se agenda ningún requestAnimationFrame
  // (nada se mueve). Al reanudar, `lastTimeRef` se resetea para no arrastrar
  // un dt inflado por el tiempo que estuvo congelado.
  useEffect(() => {
    if (paused) return;

    lastTimeRef.current = null;

    const frame = (ts: number) => {
      const engine = engineRef.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (engine && ctx) {
        const dt =
          lastTimeRef.current === null ? 0 : Math.min((ts - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = ts;

        const shoot = shootQueuedRef.current;
        shootQueuedRef.current = false;
        const input: AsteroidsInput = { ...heldRef.current, shoot };

        engine.update(dt, input);
        engine.draw(ctx);

        const state = engine.getState();
        onStateChangeRef.current({ score: state.score, lives: state.lives, level: state.level });
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
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Asteroides"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
