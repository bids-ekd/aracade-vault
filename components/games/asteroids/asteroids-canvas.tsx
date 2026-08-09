"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AsteroidsEngine, type AsteroidsInput } from "@/components/games/asteroids/engine";
import { TouchControls, type TouchButtonConfig } from "@/components/games/touch-controls";
import { useTouchPanelPortal } from "@/components/games/touch-panel-portal";
import { useTouchDevice } from "@/components/games/use-touch-device";
import type { GameCanvasProps } from "@/lib/games/types";

const WIDTH = 800;
const HEIGHT = 600;
const KEY_CODES = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"];

// Piloto del patrón táctil (SPEC 11): mismo AsteroidsInput que ya consume el
// teclado, engine.ts no sabe que estos botones existen. `id` es un string
// libre de este juego, no un enum compartido — ver touch-controls.tsx.
// `position` arma la cruz/D-pad del cluster izquierdo (ver .touch-controls-left
// en globals.css); "shoot" no necesita position porque es el único botón de
// su lado.
const ASTEROIDS_TOUCH_BUTTONS: TouchButtonConfig[] = [
  { id: "thrust", label: "▲", ariaLabel: "Empuje", side: "left", position: "up" },
  { id: "rotate-left", label: "◄", ariaLabel: "Rotar izquierda", side: "left", position: "left" },
  { id: "rotate-right", label: "►", ariaLabel: "Rotar derecha", side: "left", position: "right" },
  { id: "shoot", label: "●", ariaLabel: "Disparo", side: "right" },
];

export function AsteroidsCanvas({ paused, skin, onStateChange, onGameOver }: GameCanvasProps) {
  const isTouch = useTouchDevice();
  // Nodo DOM del panel de controles, provisto por game-player.tsx — vive
  // FUERA de .crt (layout tipo GameBoy). null en desktop, o mientras ese
  // nodo todavía no se montó. Ver touch-panel-portal.tsx.
  const touchPanelEl = useTouchPanelPortal();
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

  // Escriben sobre los mismos heldRef/shootQueuedRef que ya alimenta el
  // teclado (ver los handlers de keydown/keyup más arriba): el disparo es
  // edge-triggered (se encola una sola vez en onPress, onRelease lo ignora),
  // igual que Space sin repeat. Mientras está en pausa se ignora, igual que
  // el teclado.
  const handleTouchPress = (id: string) => {
    if (pausedRef.current) return;
    if (id === "rotate-left") heldRef.current.left = true;
    else if (id === "rotate-right") heldRef.current.right = true;
    else if (id === "thrust") heldRef.current.thrust = true;
    else if (id === "shoot") shootQueuedRef.current = true;
  };
  const handleTouchRelease = (id: string) => {
    if (pausedRef.current) return;
    if (id === "rotate-left") heldRef.current.left = false;
    else if (id === "rotate-right") heldRef.current.right = false;
    else if (id === "thrust") heldRef.current.thrust = false;
  };

  // El canvas se renderiza exactamente igual que antes de SPEC 11 (sin
  // wrapper, sin cambios de layout): el panel de controles NO vive acá
  // adentro, va por createPortal() a touchPanelEl —el nodo que
  // game-player.tsx monta FUERA de .crt, layout tipo GameBoy— así que
  // .game-arena/.crt-screen no necesitan reservarle espacio.
  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Asteroides"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {isTouch &&
        touchPanelEl &&
        createPortal(
          <TouchControls
            buttons={ASTEROIDS_TOUCH_BUTTONS}
            onPress={handleTouchPress}
            onRelease={handleTouchRelease}
          />,
          touchPanelEl,
        )}
    </>
  );
}
