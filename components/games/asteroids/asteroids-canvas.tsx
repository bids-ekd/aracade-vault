"use client";

import { useEffect, useRef } from "react";
import { AsteroidsEngine, type AsteroidsInput } from "@/components/games/asteroids/engine";
import type { GameCanvasProps } from "@/lib/games/types";

const WIDTH = 800;
const HEIGHT = 600;
const KEY_CODES = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"];

export function AsteroidsCanvas({ paused, skin, onStateChange, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverFiredRef = useRef(false);

  const pausedRef = useRef(paused);
  const heldRef = useRef({ left: false, right: false, thrust: false });
  const shootQueuedRef = useRef(false);
  // La skin del primer render, para construir el motor ya con la paleta buena
  // (el efecto de creación corre una sola vez y no puede depender de `skin`
  // sin remontar el motor). Los cambios posteriores van por setSkin().
  const skinInicialRef = useRef(skin);

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

    engineRef.current = new AsteroidsEngine(WIDTH, HEIGHT, skinInicialRef.current);

    return () => {
      engineRef.current = null;
    };
  }, []);

  // Cambio de skin o de modo claro/oscuro: se reaplica sobre el MISMO motor.
  // Nada de `key={skin}` ni de remontar el canvas — eso reiniciaría la partida
  // (el remonte es el mecanismo de reinicio de components/game-player.tsx).
  // Si el juego está en pausa el loop no corre, así que se repinta a mano para
  // que el cambio se vea igual.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSkin(skin);
    if (pausedRef.current) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) engine.draw(ctx);
    }
  }, [skin]);

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
