"use client";

// ===== touch-controls.tsx — panel DOM genérico de botones táctiles =====
//
// Componente puro sin lógica de juego: no sabe qué significa "thrust" ni
// ningún otro `id` de botón, solo dispara onPress(id)/onRelease(id) sobre el
// botón tocado. Cada motor define sus propios TouchButtonConfig al
// integrarlo (ver asteroids-canvas.tsx) — pensado para reusarse en Tetris,
// Arkanoid y Snake en specs futuros.
//
// Nunca dibuja sobre el <canvas>: es un panel DOM en flujo normal (no
// `position: absolute` sobre el canvas) — el consumidor lo ubica debajo de
// la pantalla del juego, layout tipo GameBoy, nunca superpuesto. `position`
// en TouchButtonConfig es opcional y puramente de layout: ubica un botón
// dentro del grid tipo D-pad de `.touch-controls-left` (ver globals.css);
// los botones sin `position` simplemente se apilan en fila.
//
// Usa Pointer Events (no touchstart/touchend) con setPointerCapture en cada
// botón: así, si el dedo se desliza fuera del botón mientras sigue apretado,
// el pointerup/pointercancel igual llega a ese mismo botón (no se "pierde"
// el release). Cada botón maneja su propio pointerId de forma independiente,
// así que sostener dos botones a la vez (p. ej. empuje + disparo) funciona
// sin que un listener global tenga que desambiguar qué dedo es cuál.
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export type TouchButtonConfig = {
  id: string; // libre, p. ej. "rotate-left" | "thrust" | "shoot"
  label: string; // glifo corto mostrado en el botón, p. ej. "◄" / "▲" / "●"
  ariaLabel: string;
  side: "left" | "right"; // qué mitad del panel ocupa
  position?: "up" | "down" | "left" | "right" | "center"; // celda del grid tipo D-pad, ver .touch-controls-left
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
    // setPointerCapture puede tirar NotFoundError en algunos navegadores si
    // el pointer ya dejó de estar activo para cuando corre el handler (p.
    // ej. un tap muy rápido). Sin este try/catch, esa excepción cortaba la
    // función ANTES de llegar a onPress(id) — el toque no disparaba nada.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    onPress(id);
  };
  const handlePointerUp = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onRelease(id);
  };

  const renderButton = (btn: TouchButtonConfig) => {
    const style: CSSProperties | undefined = btn.position ? { gridArea: btn.position } : undefined;
    return (
      <button
        key={btn.id}
        type="button"
        className="touch-btn"
        aria-label={btn.ariaLabel}
        // data-position (no la prop `position` en sí) es lo que CSS usa para
        // dibujar cada brazo del D-pad con su propia forma — ver
        // .touch-controls-left [data-position] en globals.css.
        data-position={btn.position}
        style={style}
        onPointerDown={handlePointerDown(btn.id)}
        onPointerUp={handlePointerUp(btn.id)}
        onPointerCancel={handlePointerUp(btn.id)}
      >
        {btn.label}
      </button>
    );
  };

  return (
    <div className="touch-controls">
      <div className="touch-controls-side touch-controls-left">{left.map(renderButton)}</div>
      <div className="touch-controls-side touch-controls-right">{right.map(renderButton)}</div>
    </div>
  );
}
