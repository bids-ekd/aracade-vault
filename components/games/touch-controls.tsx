"use client";

// ===== touch-controls.tsx — overlay DOM genérico de botones táctiles =====
//
// Componente puro sin lógica de juego: no sabe qué significa "thrust" ni
// ningún otro `id` de botón, solo dispara onPress(id)/onRelease(id) sobre el
// botón tocado. Cada motor define sus propios TouchButtonConfig al
// integrarlo (ver asteroids-canvas.tsx) — pensado para reusarse en Tetris,
// Arkanoid y Snake en specs futuros.
//
// Nunca dibuja sobre el <canvas>: es overlay DOM (position: absolute) con
// pointer-events solo en los botones, no en el contenedor, para no tapar
// clicks/taps sobre el resto de la pantalla de juego.
//
// Usa Pointer Events (no touchstart/touchend) con setPointerCapture en cada
// botón: así, si el dedo se desliza fuera del botón mientras sigue apretado,
// el pointerup/pointercancel igual llega a ese mismo botón (no se "pierde"
// el release). Cada botón maneja su propio pointerId de forma independiente,
// así que sostener dos botones a la vez (p. ej. empuje + disparo) funciona
// sin que un listener global tenga que desambiguar qué dedo es cuál.
import type { PointerEvent as ReactPointerEvent } from "react";

export type TouchButtonConfig = {
  id: string; // libre, p. ej. "rotate-left" | "thrust" | "shoot"
  label: string; // glifo corto mostrado en el botón, p. ej. "◄" / "▲" / "●"
  ariaLabel: string;
  side: "left" | "right"; // qué mitad del overlay ocupa
};

export type TouchControlsProps = {
  buttons: TouchButtonConfig[];
  onPress: (id: string) => void;
  onRelease: (id: string) => void;
};

export function TouchControls({ buttons, onPress, onRelease }: TouchControlsProps) {
  const left = buttons.filter((btn) => btn.side === "left");
  const right = buttons.filter((btn) => btn.side === "right");

  const handlePointerDown = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onPress(id);
  };
  const handlePointerUp = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onRelease(id);
  };

  return (
    <div className="touch-controls">
      <div className="touch-controls-side touch-controls-left">
        {left.map((btn) => (
          <button
            key={btn.id}
            type="button"
            className="touch-btn"
            aria-label={btn.ariaLabel}
            onPointerDown={handlePointerDown(btn.id)}
            onPointerUp={handlePointerUp(btn.id)}
            onPointerCancel={handlePointerUp(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div className="touch-controls-side touch-controls-right">
        {right.map((btn) => (
          <button
            key={btn.id}
            type="button"
            className="touch-btn"
            aria-label={btn.ariaLabel}
            onPointerDown={handlePointerDown(btn.id)}
            onPointerUp={handlePointerUp(btn.id)}
            onPointerCancel={handlePointerUp(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
