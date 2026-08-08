"use client";

import { useEffect, useRef } from "react";
import { TetrisEngine, type TetrisInput } from "@/components/games/tetris/engine";
import type { GameCanvasProps } from "@/lib/games/types";

const WIDTH = 800;
const HEIGHT = 600;
const KEY_CODES = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "KeyX", "Space"];

export function TetrisCanvas({ paused, onStateChange, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TetrisEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverFiredRef = useRef(false);

  const pausedRef = useRef(paused);
  // Input edge-triggered, fiel al original: cada tecla encola su acción al
  // llegar el keydown (sin filtrar `e.repeat`, sin estado "sostenida" como
  // AsteroidsCanvas) y se consume una sola vez en el siguiente frame de
  // update(). No hay listener de keyup — Tetris no tiene input continuo.
  const queuedRef = useRef({
    moveLeft: false,
    moveRight: false,
    rotate: false,
    softDrop: false,
    hardDrop: false,
  });

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

    engineRef.current = new TetrisEngine(WIDTH, HEIGHT);

    return () => {
      engineRef.current = null;
    };
  }, []);

  // Teclado: mientras está pausado, el input se ignora por completo (solo se
  // frena el scroll de la página con preventDefault en flechas y Espacio). No
  // se porta el atajo `P` del original — la pausa la controla exclusivamente
  // el botón de la plataforma, mismo criterio que Asteroides.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!KEY_CODES.includes(e.code)) return;
      if (e.code !== "KeyX") e.preventDefault();
      if (pausedRef.current) return;
      switch (e.code) {
        case "ArrowLeft":
          queuedRef.current.moveLeft = true;
          break;
        case "ArrowRight":
          queuedRef.current.moveRight = true;
          break;
        case "ArrowDown":
          queuedRef.current.softDrop = true;
          break;
        case "ArrowUp":
        case "KeyX":
          queuedRef.current.rotate = true;
          break;
        case "Space":
          queuedRef.current.hardDrop = true;
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
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

        const input: TetrisInput = { ...queuedRef.current };
        queuedRef.current = {
          moveLeft: false,
          moveRight: false,
          rotate: false,
          softDrop: false,
          hardDrop: false,
        };

        engine.update(dt, input);
        engine.draw(ctx);

        const state = engine.getState();
        onStateChangeRef.current({ score: state.score, lines: state.lines, level: state.level });
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
      aria-label="Tetris"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
