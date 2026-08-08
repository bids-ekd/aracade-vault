"use client";

import { useEffect, useRef } from "react";
import {
  ArkanoidEngine,
  type ArkanoidInput,
  type ArkanoidSfx,
} from "@/components/games/arkanoid/engine";
import type { GameCanvasProps } from "@/lib/games/types";

const WIDTH = 800;
const HEIGHT = 600;
const KEY_CODES = ["ArrowLeft", "ArrowRight"];

const SOUND_SRC: Record<ArkanoidSfx, string> = {
  bounce: "/games/arkanoid/sounds/ball-bounce.mp3",
  break: "/games/arkanoid/sounds/break-sound.mp3",
};

export function ArkanoidCanvas({ paused, onStateChange, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ArkanoidEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverFiredRef = useRef(false);

  const pausedRef = useRef(paused);
  const heldRef = useRef({ left: false, right: false });
  // Mouse edge-triggered: se arma en cada mousemove sobre el canvas (coordenada
  // lógica 800×600) y se consume una sola vez en el siguiente frame de update();
  // si no hubo un mousemove nuevo, vuelve a `null` y el paddle queda al control
  // exclusivo del teclado — mismo criterio que "shoot" en Asteroides o el input
  // de Tetris, aplicado al mouse.
  const mouseXQueuedRef = useRef<number | null>(null);

  // Dos <audio> precargados al montar, uno por cada sfx que reporta el motor.
  // El motor nunca instancia Audio — solo dice qué sonó; este componente decide cómo.
  const soundsRef = useRef<Record<ArkanoidSfx, HTMLAudioElement> | null>(null);

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

    engineRef.current = new ArkanoidEngine(WIDTH, HEIGHT);

    return () => {
      engineRef.current = null;
    };
  }, []);

  // Audio: instancias precargadas una única vez por montaje. Cada frame, por
  // cada entrada de getState().sfx, se reproduce un cloneNode() — mismo patrón
  // que el original, permite sonidos superpuestos (dos rebotes seguidos, etc.).
  useEffect(() => {
    const bounce = new Audio(SOUND_SRC.bounce);
    const brk = new Audio(SOUND_SRC.break);
    bounce.preload = "auto";
    brk.preload = "auto";
    soundsRef.current = { bounce, break: brk };
    return () => {
      soundsRef.current = null;
    };
  }, []);

  // Teclado: mientras está pausado, el input se ignora por completo (solo se
  // frena el scroll de la página con preventDefault). Sin atajo `P`/`Escape` de
  // pausa ni selector de nivel — la pausa es exclusivamente el botón de la plataforma.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!KEY_CODES.includes(e.code)) return;
      e.preventDefault();
      if (pausedRef.current) return;
      if (e.code === "ArrowLeft") heldRef.current.left = true;
      else if (e.code === "ArrowRight") heldRef.current.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!KEY_CODES.includes(e.code)) return;
      e.preventDefault();
      if (pausedRef.current) return;
      if (e.code === "ArrowLeft") heldRef.current.left = false;
      else if (e.code === "ArrowRight") heldRef.current.right = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Mouse: mousemove sobre el canvas traduce clientX a coordenada lógica. Se usa
  // el ancho lógico fijo (WIDTH = 800) en vez de canvas.width (que incluye el
  // DPR) como numerador — el mismo cálculo de scaleX que el original
  // (canvas.width / rect.width), adaptado para un canvas DPR-aware sin pasar
  // dos veces por el factor de escala.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      if (pausedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      mouseXQueuedRef.current = ((e.clientX - rect.left) * WIDTH) / rect.width;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  // Loop: mientras `paused` es true no se agenda ningún requestAnimationFrame
  // (nada se mueve, ni teclado ni mouse responden). Al reanudar, `lastTimeRef`
  // se resetea para no arrastrar un dt inflado por el tiempo que estuvo congelado.
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

        const mouseX = mouseXQueuedRef.current;
        mouseXQueuedRef.current = null;
        const input: ArkanoidInput = { ...heldRef.current, mouseX };

        engine.update(dt, input);
        engine.draw(ctx);

        const state = engine.getState();
        onStateChangeRef.current({
          score: state.score,
          lives: state.lives,
          level: state.level,
          status: state.status,
        });

        for (const sfx of state.sfx) {
          const audio = soundsRef.current?.[sfx];
          if (!audio) continue;
          const clone = audio.cloneNode(true) as HTMLAudioElement;
          clone.play().catch(() => {});
        }

        if ((state.status === "gameover" || state.status === "won") && !gameOverFiredRef.current) {
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
      aria-label="Arkanoid"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
